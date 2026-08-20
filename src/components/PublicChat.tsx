import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { BarChart3, File as FileIcon, Globe2, Minus, Paperclip, Pin, Plus, Send, Trash2, X } from "lucide-react";
import botIconUrl from "../assets/icons/boticon.svg";
import { useAuth } from "../context/AuthContext";
import { clearPublicChatFiles, clearPublicMessages, deletePublicMessage, sendPublicMessage, subscribeToPublicMessages, togglePublicPin, togglePublicReaction, votePublicPoll } from "../lib/chat";
import { isAppwriteConfigured, uploadChatFile } from "../lib/appwrite";
import { flagDeletedMessage } from "../lib/moderation";
import { createNotification } from "../lib/notifications";
import { awardBotXp, isOnline, subscribeToAllProfiles, subscribeToProfile } from "../lib/profiles";
import { askAi, checkLocalProfanity, formatBanRemaining, getChatBanRemaining, screenChatMessageRemote } from "../lib/aiModeration";
import { claimDuelReward, createDuel, declineDuel, resolveDuel, subscribeToMyDuels } from "../lib/duels";
import { sendFriendRequest } from "../lib/friends";
import { subscribeToBalance } from "../lib/shop";
import { clearTyping, setTyping, subscribeToTyping, type Typer } from "../lib/typing";
import pingSoundUrl from "../pages/discord_ping_sound_effect.mp3";
import {
  answerTrivia,
  arcadeLevel,
  BOT_HELP,
  DUEL_GAMES,
  DUEL_LOSE_XP,
  DUEL_WIN_XP,
  evaluateWordleGuess,
  formatTriviaQuestion,
  GAME_COOLDOWN_MS,
  pickTriviaQuestion,
  pickWordleWord,
  playCoinflip,
  playRps,
  playSlots,
  type TriviaQuestion,
  WORDLE_MAX_GUESSES,
  wordleWinXp,
} from "../lib/minigames";
import { rankNameClass } from "../lib/ranks";
import type { ChatMessage, Duel, UserProfile } from "../types";
import Button from "./Button";
import ProfileCard from "./ProfileCard";
import RankBadge from "./RankBadge";

function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const MENTION_RE = /@[\w.]+/g;
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

function renderWithMentions(text: string, myName: string, myUsername: string) {
  const parts = text.split(MENTION_RE);
  const mentions = text.match(MENTION_RE) ?? [];
  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    nodes.push(part);
    const mention = mentions[i];
    if (mention) {
      const target = mention.slice(1).toLowerCase();
      const isSpecial = target === "everyone" || target === "here";
      const isMe = target === myName.toLowerCase() || (!!myUsername && target === myUsername);
      nodes.push(
        <span
          key={i}
          className={`rounded px-1 font-semibold ${isSpecial ? "bg-amber-500/25 text-amber-200" : isMe ? "bg-brand-500/30 text-brand-200" : "bg-white/10 text-white/80"}`}
        >
          {mention}
        </span>,
      );
    }
  });
  return nodes;
}

function formatTypers(names: string[]) {
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  return `${names.length} people are typing`;
}

export default function PublicChat({ tall = false }: { tall?: boolean }) {
  const { user, role } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [filterMessage, setFilterMessage] = useState("");
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [pendingTrivia, setPendingTrivia] = useState<TriviaQuestion | null>(null);
  const [pendingWordle, setPendingWordle] = useState<{ answer: string; guesses: number } | null>(null);
  const [myDuels, setMyDuels] = useState<{ asChallenger: Duel[]; asOpponent: Duel[] }>({ asChallenger: [], asOpponent: [] });
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);
  const [typers, setTypers] = useState<Typer[]>([]);
  const [uploading, setUploading] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAiCallRef = useRef(0);
  const lastTypingSentRef = useRef(0);
  const typingClearRef = useRef<number | null>(null);
  const seenMessageIdsRef = useRef<Set<string> | null>(null);
  const pingAudioRef = useRef<HTMLAudioElement | null>(null);

  // Firebase Auth's displayName is frozen at signup — the live, renameable
  // name lives on the Firestore profile doc. Always prefer that for anything
  // shown to other people (chat author, duel labels, typing indicator, etc.).
  const myName = myProfile?.displayName || user?.displayName || undefined;

  useEffect(() => {
    pingAudioRef.current = new Audio(pingSoundUrl);
    pingAudioRef.current.preload = "auto";
  }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeToTyping((list) => setTypers(list.filter((t) => t.id !== user.uid && Date.now() - t.updatedAt < 6000)));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (seenMessageIdsRef.current === null) {
      seenMessageIdsRef.current = new Set(messages.map((m) => m.id));
      return;
    }
    const myNameLower = (myName ?? "").toLowerCase();
    const myUsernameLower = myProfile?.usernameLower ?? "";
    const fresh = messages.filter((m) => !seenMessageIdsRef.current!.has(m.id));
    messages.forEach((m) => seenMessageIdsRef.current!.add(m.id));
    if (!myNameLower && !myUsernameLower) return;
    const pinged = fresh.some(
      (m) =>
        m.authorId !== user.uid &&
        (m.text.match(MENTION_RE) ?? []).some((mn) => {
          const target = mn.slice(1).toLowerCase();
          return target === myNameLower || (!!myUsernameLower && target === myUsernameLower) || target === "everyone" || target === "here";
        }),
    );
    if (pinged) void pingAudioRef.current?.play().catch(() => {});
  }, [messages, user]);

  useEffect(() => {
    return () => {
      if (user) void clearTyping(user.uid);
      if (typingClearRef.current) window.clearTimeout(typingClearRef.current);
    };
  }, [user]);

  function handleTextChange(value: string) {
    setText(value);
    if (!user) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current > 2500) {
      lastTypingSentRef.current = now;
      void setTyping(user.uid, myName ?? "Someone");
    }
    if (typingClearRef.current) window.clearTimeout(typingClearRef.current);
    typingClearRef.current = window.setTimeout(() => void clearTyping(user.uid), 4000);
  }

  useEffect(() => {
    const unsub = subscribeToPublicMessages(setMessages, 100);
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    return subscribeToProfile(user.uid, setMyProfile);
  }, [user]);

  useEffect(() => subscribeToAllProfiles(setAllProfiles), []);

  useEffect(() => {
    if (!user) return;
    return subscribeToBalance(user.uid, setWalletBalance);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return subscribeToMyDuels(user.uid, (asChallenger, asOpponent) => setMyDuels({ asChallenger, asOpponent }));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    myDuels.asChallenger.forEach((d) => {
      if (d.status === "resolved" && !d.challengerHandled) {
        const won = d.winnerId === user.uid;
        void claimDuelReward(d.id, user.uid, won ? DUEL_WIN_XP : DUEL_LOSE_XP, d.bet > 0 ? (won ? d.bet : -d.bet) : 0).catch(() => {});
      }
    });
  }, [myDuels.asChallenger, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function toggleReaction(m: ChatMessage, emoji: string) {
    if (!user) return;
    const has = (m.reactions?.[emoji] ?? []).includes(user.uid);
    void togglePublicReaction(m.id, emoji, user.uid, !has);
  }

  function togglePin(m: ChatMessage) {
    void togglePublicPin(m.id, !m.pinned);
  }

  async function handleDelete(m: ChatMessage) {
    const isStaffRemoval = (role === "owner" || role === "moderator") && user?.uid !== m.authorId;
    await deletePublicMessage(m.id);
    if (isStaffRemoval && user) {
      await flagDeletedMessage({
        source: "publicChat",
        serverId: "global",
        serverName: "Global Chat",
        text: m.text,
        authorId: m.authorId,
        authorName: m.authorName,
        deletedById: user.uid,
        deletedByName: myName ?? "Moderator",
      });
      setFilterMessage("Message removed and reported to moderators.");
    }
  }

  async function botReply(text: string) {
    if (!user) return;
    await sendPublicMessage(user.uid, "eduBot", text, "none", { isBot: true });
  }

  function findRecentAuthor(name: string): { id: string; name: string; photoUrl: string } | null {
    const target = name.trim().toLowerCase();
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (!m.isBot && m.authorName.toLowerCase() === target) {
        return { id: m.authorId, name: m.authorName, photoUrl: m.authorPhotoUrl ?? "" };
      }
    }
    return null;
  }

  function notifyMentioned(text: string, myUid: string, myName: string) {
    const mentions = (text.match(MENTION_RE) ?? []).map((mn) => mn.slice(1).toLowerCase());
    const notified = new Set<string>();
    const notify = (recipientId: string, title: string) => {
      if (recipientId === myUid || notified.has(recipientId)) return;
      notified.add(recipientId);
      void createNotification({ recipientId, type: "mention", title, message: text.slice(0, 100), link: "/chat" });
    };

    if (mentions.includes("everyone") && (role === "owner" || role === "moderator")) {
      allProfiles.forEach((p) => notify(p.id, `${myName} pinged @everyone in Global Chat`));
      return;
    }
    if (mentions.includes("here")) {
      allProfiles.filter((p) => isOnline(p)).forEach((p) => notify(p.id, `${myName} pinged @here in Global Chat`));
      return;
    }
    mentions.forEach((mn) => {
      const byUsername = allProfiles.find((p) => p.usernameLower === mn);
      const target = byUsername ?? findRecentAuthor(mn);
      if (!target) return;
      notify(target.id, `${myName} mentioned you in Global Chat`);
    });
  }

  async function runCommand(raw: string) {
    if (!user) return;
    await sendPublicMessage(user.uid, myName ?? "Anonymous", raw, myProfile?.rank ?? "none", {
      authorPhotoUrl: myProfile?.photoUrl ?? "",
    });

    const [cmdRaw, ...rest] = raw.slice(1).trim().split(/\s+/);
    const cmd = cmdRaw.toLowerCase();
    const arg = rest.join(" ");

    if (cmd === "help" || cmd === "commands") return botReply(BOT_HELP);

    if (cmd === "xp" || cmd === "level") {
      const xp = myProfile?.botXp ?? 0;
      return botReply(`${myName ?? "You"} — ${xp} XP · Arcade Level ${arcadeLevel(xp)}`);
    }

    if (cmd === "duel") {
      if (!arg.trim()) return botReply(`Usage: !duel <player name> [bet] [game] — games: ${DUEL_GAMES.map((g) => g.id).join(", ")}, bet is optional credits (max 100). They must have spoken in this chat recently.`);
      const words = arg.trim().split(/\s+/);
      const lastWord = words[words.length - 1].toLowerCase();
      const matchedGame = DUEL_GAMES.find((g) => g.id === lastWord);
      const game = matchedGame ?? DUEL_GAMES[0];
      const afterGame = matchedGame && words.length > 1 ? words.slice(0, -1) : words;
      const lastOfRest = afterGame[afterGame.length - 1];
      const parsedBet = afterGame.length > 1 && /^\d+$/.test(lastOfRest) ? Number(lastOfRest) : null;
      const nameArg = parsedBet !== null ? afterGame.slice(0, -1).join(" ") : afterGame.join(" ");
      const bet = Math.min(parsedBet ?? 0, 100);
      if (bet > walletBalance) return botReply(`You only have ${walletBalance} credits — can't bet ${bet}.`);
      const target = findRecentAuthor(nameArg);
      if (!target) return botReply(`Haven't seen "${nameArg.trim()}" talk here recently.`);
      if (target.id === user.uid) return botReply("You can't duel yourself.");
      await createDuel(user.uid, myName ?? "Player", target.id, target.name, game.label, bet);
      const betText = bet > 0 ? ` for ${bet} credits` : "";
      return botReply(`${myName ?? "Someone"} challenges ${target.name} to a ${game.label} duel${betText}! ${target.name} — type !accept or !decline.`);
    }

    if (cmd === "accept" || cmd === "decline") {
      const pending = myDuels.asOpponent
        .filter((d) => d.status === "pending")
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      if (!pending) return botReply("No pending duel challenges for you.");
      if (cmd === "decline") {
        await declineDuel(pending.id);
        return botReply(`${myName ?? "They"} declined the duel from ${pending.challengerName}.`);
      }
      const iWin = Math.random() < 0.5;
      const winnerId = iWin ? user.uid : pending.challengerId;
      const winnerName = iWin ? myName ?? "Player" : pending.challengerName;
      const loserId = iWin ? pending.challengerId : user.uid;
      const loserName = iWin ? pending.challengerName : myName ?? "Player";
      const myCreditsDelta = pending.bet > 0 ? (iWin ? pending.bet : -pending.bet) : 0;
      await resolveDuel(pending.id, user.uid, winnerId, winnerName, loserId, loserName, iWin ? DUEL_WIN_XP : DUEL_LOSE_XP, myCreditsDelta);
      const betText = pending.bet > 0 ? ` ${pending.challengerName} ${iWin ? "loses" : "wins"} ${pending.bet} credits.` : "";
      await botReply(
        `${pending.game ?? "Coinflip"} duel: ${pending.challengerName} vs ${myName ?? "Player"} — ${winnerName} wins! +${DUEL_WIN_XP} XP, ${loserName} ${DUEL_LOSE_XP} XP.${betText}`,
      );
      return;
    }

    if (cmd === "friend") {
      if (!arg.trim()) return botReply("Usage: !friend <player name> — they must have spoken in this chat recently.");
      const target = findRecentAuthor(arg);
      if (!target) return botReply(`Haven't seen "${arg.trim()}" talk here recently.`);
      if (target.id === user.uid) return botReply("You can't friend yourself.");
      try {
        await sendFriendRequest(user.uid, myName ?? "Player", myProfile?.photoUrl ?? "", target.id, target.name, target.photoUrl);
        return botReply(`Friend request sent to ${target.name}.`);
      } catch {
        return botReply(`Could not send a friend request to ${target.name} — maybe you're already friends or it's pending.`);
      }
    }

    if (cmd === "ai") {
      if (!arg.trim()) return botReply("Usage: !ai <question>");
      const waitMs = 8000 - (Date.now() - lastAiCallRef.current);
      if (waitMs > 0) return botReply(`Slow down — wait ${Math.ceil(waitMs / 1000)}s before asking again.`);
      lastAiCallRef.current = Date.now();
      const answer = await askAi(arg);
      return botReply(answer);
    }

    if (cmd === "chatre") {
      if (role !== "owner" && role !== "moderator") return botReply("Only staff can reset Global Chat.");
      await clearPublicMessages();
      return botReply("Global Chat has been reset.");
    }

    if (cmd === "del") {
      if (role !== "owner" && role !== "moderator") return botReply("Only staff can delete shared files.");
      const count = await clearPublicChatFiles();
      return botReply(count > 0 ? `Deleted ${count} shared file(s) from Global Chat.` : "No shared files to delete.");
    }

    if (cmd === "wordle") {
      if (arg.trim().toLowerCase() === "giveup" && pendingWordle) {
        const answer = pendingWordle.answer;
        setPendingWordle(null);
        return botReply(`Gave up — the word was ${answer}.`);
      }
      if (pendingWordle) {
        return botReply(`Wordle already in progress — guess ${pendingWordle.guesses + 1}/${WORDLE_MAX_GUESSES}. Type !guess <word>, or !wordle giveup to end it.`);
      }
      setPendingWordle({ answer: pickWordleWord(), guesses: 0 });
      return botReply(`Wordle started — guess a 5-letter word with !guess <word>. ${WORDLE_MAX_GUESSES} tries. # = right spot, ~ = wrong spot, - = not in word.`);
    }

    if (cmd === "guess") {
      if (!pendingWordle) return botReply("No active Wordle — start one with !wordle.");
      const word = arg.trim();
      if (!/^[a-zA-Z]{5}$/.test(word)) return botReply("Guess must be a 5-letter word — like `!guess crane`.");
      const waitMs = GAME_COOLDOWN_MS - (Date.now() - (myProfile?.lastGameAt ?? 0));
      if (waitMs > 0) return botReply(`Slow down — wait ${Math.ceil(waitMs / 1000)}s before your next guess.`);
      const { pattern, exact } = evaluateWordleGuess(word, pendingWordle.answer);
      const guesses = pendingWordle.guesses + 1;
      if (exact) {
        setPendingWordle(null);
        const xp = wordleWinXp(guesses);
        await botReply(`${word.toUpperCase()} ${pattern} — solved in ${guesses}/${WORDLE_MAX_GUESSES}! +${xp} XP`);
        return awardBotXp(user.uid, xp);
      }
      if (guesses >= WORDLE_MAX_GUESSES) {
        const answer = pendingWordle.answer;
        setPendingWordle(null);
        await botReply(`${word.toUpperCase()} ${pattern} — out of guesses! The word was ${answer}. -5 XP`);
        return awardBotXp(user.uid, -5);
      }
      setPendingWordle({ answer: pendingWordle.answer, guesses });
      return botReply(`${word.toUpperCase()} ${pattern} — guess ${guesses}/${WORDLE_MAX_GUESSES}`);
    }

    const xpCommands = new Set(["coinflip", "rps", "slots", "answer"]);
    if (!xpCommands.has(cmd) && cmd !== "trivia") {
      return botReply(`Unknown command. ${BOT_HELP}`);
    }

    if (xpCommands.has(cmd)) {
      const waitMs = GAME_COOLDOWN_MS - (Date.now() - (myProfile?.lastGameAt ?? 0));
      if (waitMs > 0) return botReply(`Slow down — wait ${Math.ceil(waitMs / 1000)}s before your next game.`);
    }

    if (cmd === "trivia") {
      const q = pickTriviaQuestion();
      setPendingTrivia(q);
      return botReply(formatTriviaQuestion(q));
    }

    let result: { text: string; xp: number };
    if (cmd === "coinflip") result = playCoinflip();
    else if (cmd === "rps") result = playRps(arg);
    else if (cmd === "slots") result = playSlots();
    else {
      if (!pendingTrivia) return botReply("No active trivia question — type `!trivia` first.");
      result = answerTrivia(pendingTrivia, arg);
      setPendingTrivia(null);
    }

    await botReply(result.text);
    if (result.xp !== 0) await awardBotXp(user.uid, result.xp);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim().slice(0, 500);
    if (!trimmed || !user) return;
    setSending(true);
    setFilterMessage("");
    if (typingClearRef.current) window.clearTimeout(typingClearRef.current);
    void clearTyping(user.uid);
    try {
      const remaining = getChatBanRemaining(user.uid, user.email);
      if (remaining > 0) {
        setFilterMessage(`AI moderation paused your chat for ${formatBanRemaining(remaining)}.`);
        return;
      }
      if (trimmed.startsWith("!")) {
        await runCommand(trimmed);
        setText("");
        return;
      }
      const localHit = checkLocalProfanity(trimmed);
      if (localHit) {
        setFilterMessage(`Message blocked: ${localHit.reason}. Chat is paused for 2 hours.`);
        return;
      }
      const sentRef = await sendPublicMessage(user.uid, myName ?? "Anonymous", trimmed, myProfile?.rank ?? "none", {
        authorPhotoUrl: myProfile?.photoUrl ?? "",
      });
      notifyMentioned(trimmed, user.uid, myName ?? "Someone");
      setText("");

      // AI screening happens after send so it never blocks the message on
      // network latency — flagged messages get pulled back retroactively.
      void screenChatMessageRemote(user.uid, trimmed, user.email).then((screening) => {
        if (screening.spam) {
          void deletePublicMessage(sentRef.id);
          setFilterMessage(`Your message was removed by AI moderation: ${screening.reason}. Chat is paused for 2 hours.`);
        }
      });
    } catch (error) {
      setFilterMessage(error instanceof Error ? error.message : "Could not check that message.");
    } finally {
      setSending(false);
    }
  }

  async function handleCreatePoll(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const question = pollQuestion.trim().slice(0, 200);
    const options = pollOptions.map((o) => o.trim()).filter(Boolean).slice(0, 4);
    if (!question || options.length < 2) {
      setFilterMessage("Poll needs a question and at least 2 options.");
      return;
    }
    setSending(true);
    setFilterMessage("");
    try {
      await sendPublicMessage(user.uid, myName ?? "Anonymous", question, myProfile?.rank ?? "none", {
        authorPhotoUrl: myProfile?.photoUrl ?? "",
        poll: { question, options, votes: {} },
      });
      setPollQuestion("");
      setPollOptions(["", ""]);
      setPollOpen(false);
    } catch (error) {
      setFilterMessage(error instanceof Error ? error.message : "Could not create that poll.");
    } finally {
      setSending(false);
    }
  }

  function handleVote(messageId: string, optionIndex: number) {
    if (!user) return;
    void votePublicPoll(messageId, optionIndex, user.uid);
  }

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (file.size > 25 * 1024 * 1024) {
      setFilterMessage("Files must be under 25MB.");
      return;
    }
    setUploading(true);
    setFilterMessage("");
    try {
      const remaining = getChatBanRemaining(user.uid, user.email);
      if (remaining > 0) {
        setFilterMessage(`AI moderation paused your chat for ${formatBanRemaining(remaining)}.`);
        return;
      }
      const uploaded = await uploadChatFile(file);
      await sendPublicMessage(user.uid, myName ?? "Anonymous", `Shared a file: ${file.name}`, myProfile?.rank ?? "none", {
        authorPhotoUrl: myProfile?.photoUrl ?? "",
        fileId: uploaded.fileId,
        fileUrl: uploaded.url,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });
    } catch (error) {
      setFilterMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-6 py-3">
        <Globe2 size={16} className="text-brand-400" />
        <h3 className="font-mono text-sm font-semibold text-white">Global Chat</h3>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-white/30">
          AI mod on
        </span>
      </div>

      {messages.some((m) => m.pinned) && (
        <div className="border-b border-border bg-surface-2/40 px-4 py-2">
          <p className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-white/40"><Pin size={10} /> Pinned</p>
          <div className="mt-1 space-y-1">
            {messages.filter((m) => m.pinned).map((m) => (
              <p key={m.id} className="truncate text-xs text-white/60">{m.authorName}: {m.text}</p>
            ))}
          </div>
        </div>
      )}

      <div ref={scrollRef} className={`${tall ? "h-[28rem]" : "max-h-56"} space-y-2.5 overflow-x-hidden overflow-y-auto p-4`}>
        {messages.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/30">No messages yet — say hi.</p>
        ) : (
          messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="group flex items-start gap-2"
            >
              {m.isBot ? (
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500/20">
                  <img src={botIconUrl} alt="" className="h-full w-full object-cover" />
                </span>
              ) : m.authorPhotoUrl ? (
                <img
                  src={m.authorPhotoUrl}
                  alt=""
                  onClick={() => setOpenProfileId(m.authorId)}
                  className="cursor-target mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded-full object-cover"
                />
              ) : (
                <span
                  onClick={() => !m.isBot && setOpenProfileId(m.authorId)}
                  className="cursor-target mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-brand-500/15 font-mono text-[10px] font-bold text-brand-300"
                >
                  {m.authorName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span
                    onClick={() => !m.isBot && setOpenProfileId(m.authorId)}
                    className={`cursor-target truncate text-xs font-semibold ${!m.isBot ? "cursor-pointer" : ""} ${m.authorRank && m.authorRank !== "none" ? rankNameClass(m.authorRank) : "text-white"}`}
                  >
                    {m.authorName}
                  </span>
                  {m.isBot && <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-indigo-300">APP</span>}
                  <RankBadge rank={m.authorRank} />
                  <span className="shrink-0 text-[10px] text-white/30">{timeAgo(m.createdAt)}</span>
                </div>
                {m.poll ? (
                  <div className="mt-1 max-w-xs rounded-xl border border-border bg-surface-2/60 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      <BarChart3 size={13} className="shrink-0 text-brand-400" /> {m.poll.question}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {m.poll.options.map((option, index) => {
                        const votes = m.poll?.votes?.[String(index)] ?? [];
                        const total = m.poll ? Object.values(m.poll.votes ?? {}).reduce((sum, v) => sum + v.length, 0) : 0;
                        const pct = total ? Math.round((votes.length / total) * 100) : 0;
                        const mine = !!user && votes.includes(user.uid);
                        return (
                          <button
                            key={index}
                            type="button"
                            disabled={!user}
                            onClick={() => handleVote(m.id, index)}
                            className={`cursor-target relative w-full overflow-hidden rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                              mine ? "border-brand-500/60 text-white" : "border-border text-white/70 hover:border-white/20"
                            }`}
                          >
                            <span className="absolute inset-y-0 left-0 bg-brand-500/20" style={{ width: `${pct}%` }} />
                            <span className="relative flex items-center justify-between gap-2">
                              <span className="truncate">{option}</span>
                              <span className="shrink-0 text-white/40">{pct}% ({votes.length})</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm break-words text-white/70 [overflow-wrap:anywhere]">{renderWithMentions(m.text, myName ?? "", myProfile?.usernameLower ?? "")}</p>
                )}
                {m.fileUrl && (
                  m.fileType?.startsWith("image/") ? (
                    <a href={m.fileUrl} target="_blank" rel="noreferrer" className="cursor-target mt-1.5 block w-fit">
                      <img src={m.fileUrl} alt={m.fileName ?? ""} className="max-h-64 max-w-full rounded-xl border border-border object-cover" />
                    </a>
                  ) : (
                    <a
                      href={m.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="cursor-target mt-1.5 flex w-fit items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-white/70 hover:border-brand-400/40 hover:text-white"
                    >
                      <FileIcon size={14} className="shrink-0 text-brand-300" />
                      <span className="truncate">{m.fileName}</span>
                      {typeof m.fileSize === "number" && <span className="shrink-0 text-white/30">{(m.fileSize / 1024 / 1024).toFixed(1)}MB</span>}
                    </a>
                  )
                )}
                {m.reactions && Object.entries(m.reactions).some(([, uids]) => uids.length > 0) && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {Object.entries(m.reactions)
                      .filter(([, uids]) => uids.length > 0)
                      .map(([emoji, uids]) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => toggleReaction(m, emoji)}
                          className={`cursor-target rounded-full border px-1.5 py-0.5 text-[11px] ${uids.includes(user?.uid ?? "") ? "border-brand-400/50 bg-brand-500/15" : "border-border bg-surface-2"}`}
                        >
                          {emoji} {uids.length}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="ml-auto flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => toggleReaction(m, emoji)}
                    aria-label={`React ${emoji}`}
                    className="cursor-target rounded-lg p-1 text-xs hover:bg-white/10"
                  >
                    {emoji}
                  </button>
                ))}
                {(role === "owner" || role === "moderator") && (
                  <button
                    type="button"
                    onClick={() => togglePin(m)}
                    aria-label="Pin message"
                    className="cursor-target rounded-lg p-1.5 text-white/25 hover:bg-white/10 hover:text-white"
                  >
                    {m.pinned ? <Pin size={12} className="text-amber-300" /> : <Pin size={12} />}
                  </button>
                )}
                {(role === "owner" || role === "moderator" || user?.uid === m.authorId) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(m)}
                    aria-label="Delete message"
                    className="cursor-target rounded-lg p-1.5 text-white/25 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {typers.length > 0 && (
        <p className="flex items-center gap-1.5 px-4 pb-1 text-[11px] text-white/40">
          {formatTypers(typers.map((t) => t.displayName))}
          <span className="flex gap-0.5">
            <span className="h-1 w-1 animate-bounce rounded-full bg-white/40 [animation-delay:0ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-white/40 [animation-delay:150ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-white/40 [animation-delay:300ms]" />
          </span>
        </p>
      )}

      {user ? (
        <div className="border-t border-border p-3">
          {pollOpen ? (
            <form onSubmit={handleCreatePoll} className="space-y-2 rounded-xl border border-border bg-surface-2/60 p-3">
              <div className="flex items-center gap-2">
                <BarChart3 size={14} className="shrink-0 text-brand-400" />
                <input
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Ask a question..."
                  maxLength={200}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
                />
                <button type="button" onClick={() => setPollOpen(false)} className="cursor-target shrink-0 rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white">
                  <X size={14} />
                </button>
              </div>
              {pollOptions.map((option, index) => (
                <input
                  key={index}
                  value={option}
                  onChange={(e) => setPollOptions(pollOptions.map((o, i) => (i === index ? e.target.value : o)))}
                  placeholder={`Option ${index + 1}`}
                  maxLength={80}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
                />
              ))}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {pollOptions.length < 4 && (
                    <button type="button" onClick={() => setPollOptions([...pollOptions, ""])} className="cursor-target flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white">
                      <Plus size={12} /> Option
                    </button>
                  )}
                  {pollOptions.length > 2 && (
                    <button type="button" onClick={() => setPollOptions(pollOptions.slice(0, -1))} className="cursor-target flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white">
                      <Minus size={12} /> Option
                    </button>
                  )}
                </div>
                <Button type="submit" size="sm" disabled={sending}>Create poll</Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <button type="button" onClick={() => setPollOpen(true)} aria-label="Create poll" className="cursor-target shrink-0 rounded-xl border border-border p-2 text-white/50 hover:border-brand-500/50 hover:text-white">
                <BarChart3 size={14} />
              </button>
              <input
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Say something, or try !coinflip, !rps, !slots, !trivia, !duel..."
                maxLength={500}
                className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
              />
              {isAppwriteConfigured && (
                <>
                  <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach file"
                  >
                    <Paperclip size={14} />
                  </Button>
                </>
              )}
              <Button type="submit" size="sm" disabled={sending || !text.trim()}>
                <Send size={14} />
              </Button>
            </form>
          )}
          {uploading && <p className="mt-2 text-xs text-white/40">Uploading…</p>}
          {filterMessage && <p className="mt-2 text-xs text-amber-300">{filterMessage}</p>}
          <p className="mt-1.5 text-[10px] text-white/25">Type !help for eduBot arcade commands.</p>
        </div>
      ) : (
        <div className="border-t border-border p-3 text-center text-xs text-white/40">
          Log in to join global chat.
        </div>
      )}
      {openProfileId && <ProfileCard userId={openProfileId} onClose={() => setOpenProfileId(null)} />}
    </div>
  );
}
