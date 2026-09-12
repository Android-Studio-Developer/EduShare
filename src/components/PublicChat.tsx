import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { BarChart3, Bell, BellOff, CheckCheck, Clock3, File as FileIcon, Globe2, Minus, Paperclip, Pin, Plus, Reply, Send, SmilePlus, Trash2, Wifi, WifiOff, X } from "lucide-react";
import botIconUrl from "../assets/icons/boticon.svg";
import { useAuth } from "../context/AuthContext";
import { clearPublicChatFiles, clearPublicMessages, deletePublicMessage, extractYoutubeId, sendPublicMessage, subscribeToPublicMessages, togglePublicPin, togglePublicReaction, votePublicPoll } from "../lib/chat";
import { isAppwriteConfigured, uploadChatFile } from "../lib/appwrite";
import { flagDeletedMessage, isStaffRole } from "../lib/moderation";
import { createNotification } from "../lib/notifications";
import { awardBotXp, isOnline, subscribeToAllProfiles, subscribeToProfile } from "../lib/profiles";
import { askAi, checkLocalProfanity, createAmbientChatReply, formatBanRemaining, getChatBanRemaining, screenChatMessageRemote } from "../lib/aiModeration";
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
import { nameStyle } from "../lib/cosmetics";
import type { ChatMessage, CustomEmoji, Duel, UserProfile } from "../types";
import Button from "./Button";
import ProfileCard from "./ProfileCard";
import LazyYoutubeEmbed from "./LazyYoutubeEmbed";
import RankBadge from "./RankBadge";
import GuildTag from "./GuildTag";
import { subscribeToGuilds } from "../lib/guilds";
import { recordDeveloperBotEvent, subscribeToDeveloperBots, verifyWithDeveloperBot } from "../lib/developers";
import type { DeveloperBot, Guild } from "../types";
import MentionInput from "./MentionInput";

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
const URL_RE = /(https?:\/\/[^\s]+)/g;
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

function renderMentionsOnly(text: string, myName: string, myUsername: string, keyPrefix: string) {
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
          key={`${keyPrefix}-${i}`}
          className={`rounded px-1 font-semibold ${isSpecial ? "bg-amber-500/25 text-amber-200" : isMe ? "bg-brand-500/30 text-brand-200" : "bg-white/10 text-white/80"}`}
        >
          {mention}
        </span>,
      );
    }
  });
  return nodes;
}

// Splits on URLs first (so links render as clickable anchors), then runs
// @mention highlighting on whatever plain text is left between them.
function renderEmojiText(text: string, myName: string, myUsername: string, emojis: CustomEmoji[], keyPrefix: string) {
  const exact = text.trim().match(/^:([a-z0-9_]{1,20}):$/i);
  const exactEmoji = exact ? emojis.find((emoji) => emoji.name === exact[1].toLowerCase()) : undefined;
  if (exactEmoji) return <img src={exactEmoji.url} alt={`:${exactEmoji.name}:`} title={`:${exactEmoji.name}:`} className="my-1 h-24 w-24 object-contain"/>;
  return text.split(/(:[a-z0-9_]{1,20}:)/gi).map((part, index) => {
    const match = part.match(/^:([a-z0-9_]{1,20}):$/i);
    const emoji = match ? emojis.find((item) => item.name === match[1].toLowerCase()) : undefined;
    return emoji ? <img key={`${keyPrefix}-emoji-${index}`} src={emoji.url} alt={`:${emoji.name}:`} title={`:${emoji.name}:`} className="mx-0.5 inline-block h-8 w-8 align-middle object-contain"/> : <span key={`${keyPrefix}-text-${index}`}>{renderMentionsOnly(part, myName, myUsername, `${keyPrefix}-${index}`)}</span>;
  });
}

function renderWithMentions(text: string, myName: string, myUsername: string, emojis: CustomEmoji[] = []) {
  const segments = text.split(URL_RE);
  return segments.map((segment, i) =>
    /^https?:\/\//.test(segment) ? (
      <a key={i} href={segment} target="_blank" rel="noopener noreferrer" className="text-brand-300 underline hover:text-brand-200">
        {segment}
      </a>
    ) : (
      <span key={i}>{renderEmojiText(segment, myName, myUsername, emojis, String(i))}</span>
    ),
  );
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
  useEffect(() => {
    if (!filterMessage) return;
    const timer = window.setTimeout(() => setFilterMessage(""), 6_000);
    return () => window.clearTimeout(timer);
  }, [filterMessage]);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [developerBots, setDeveloperBots] = useState<DeveloperBot[]>([]);
  const [chatStatus, setChatStatus] = useState<"online" | "reconnecting" | "offline">(navigator.onLine ? "online" : "offline");
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
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [replyPing, setReplyPing] = useState(true);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAiCallRef = useRef(0);
  const lastAmbientReplyRef = useRef(0);
  const lastTypingSentRef = useRef(0);
  const typingClearRef = useRef<number | null>(null);
  const seenMessageIdsRef = useRef<Set<string> | null>(null);
  const pingAudioRef = useRef<HTMLAudioElement | null>(null);
  const botRateRef = useRef(new Map<string, number>());

  // Firebase Auth's displayName is frozen at signup — the live, renameable
  // name lives on the Firestore profile doc. Always prefer that for anything
  // shown to other people (chat author, duel labels, typing indicator, etc.).
  const myName = myProfile?.displayName || user?.displayName || undefined;
  const guildById = useMemo(() => new Map(guilds.map((guild) => [guild.id, guild])), [guilds]);

  useEffect(() => {
    pingAudioRef.current = new Audio(pingSoundUrl);
    pingAudioRef.current.preload = "auto";
  }, []);

  useEffect(() => subscribeToGuilds(setGuilds), []);
  useEffect(() => subscribeToDeveloperBots(setDeveloperBots), []);

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
        ((m.replyPing === true && m.replyToAuthorId === user.uid) ||
        (m.text.match(MENTION_RE) ?? []).some((mn) => {
          const target = mn.slice(1).toLowerCase();
          return target === myNameLower || (!!myUsernameLower && target === myUsernameLower) || target === "everyone" || target === "here";
        })),
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
    const online = () => setChatStatus("online");
    const offline = () => setChatStatus("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    const unsub = subscribeToPublicMessages((items) => { setMessages(items); setChatStatus(navigator.onLine ? "online" : "offline"); }, 100, () => setChatStatus(navigator.onLine ? "reconnecting" : "offline"));
    return () => { unsub(); window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
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
    const isStaffRemoval = isStaffRole(role) && user?.uid !== m.authorId;
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

    if (mentions.includes("everyone") && isStaffRole(role)) {
      allProfiles.forEach((p) => notify(p.id, `${myName} pinged @everyone in Global Chat`));
      return;
    }
    if (mentions.includes("here")) {
      allProfiles.filter((p) => isOnline(p)).forEach((p) => notify(p.id, `${myName} pinged @here in Global Chat`));
      return;
    }
    mentions.forEach((mn) => {
      const byUsername = allProfiles.find((p) => p.usernameLower === mn || p.displayName.replace(/\s+/g, "").toLowerCase() === mn);
      const target = byUsername ?? findRecentAuthor(mn);
      if (!target) return;
      notify(target.id, `${myName} mentioned you in Global Chat`);
    });
  }

  async function runCommand(raw: string) {
    if (!user) return;

    const [cmdRaw, ...rest] = raw.slice(1).trim().split(/\s+/);
    const cmd = cmdRaw.toLowerCase();
    const arg = rest.join(" ");

    if (cmd === "em") {
      const youtubeId = extractYoutubeId(arg.trim().replace(/^"|"$/g, ""));
      if (!youtubeId) return botReply('Usage: !em "https://youtube.com/watch?v=..."');
      await sendPublicMessage(user.uid, myName ?? "Anonymous", arg.trim(), myProfile?.rank ?? "none", {
        authorPhotoUrl: myProfile?.photoUrl ?? "",
        youtubeId,
      });
      return;
    }

    await sendPublicMessage(user.uid, myName ?? "Anonymous", raw, myProfile?.rank ?? "none", {
      authorPhotoUrl: myProfile?.photoUrl ?? "",
    });

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
      if (!isStaffRole(role)) return botReply("Only staff can reset Global Chat.");
      await clearPublicMessages();
      return botReply("Global Chat has been reset.");
    }

    if (cmd === "del") {
      if (!isStaffRole(role)) return botReply("Only staff can delete shared files.");
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

  function runDeveloperBot(raw: string) {
    if (!user) return false;
    const mention = raw.match(/^@([a-z0-9_]+)\s+([a-z0-9_-]+)(?:\s+([\s\S]*))?$/i);
    let bot: DeveloperBot | undefined;
    let commandName = "";
    let args = "";
    if (mention) {
      bot = developerBots.find((item) => item.enabled && item.handle.toLowerCase() === mention[1].toLowerCase());
      commandName = mention[2].toLowerCase();
      args = mention[3]?.trim() ?? "";
    } else {
      const slash = raw.match(/^\/([a-z0-9_]+)\s+([a-z0-9_-]+)(?:\s+([\s\S]*))?$/i);
      if (slash) {
        bot = developerBots.find((item) => item.enabled && item.handle.toLowerCase() === slash[1].toLowerCase());
        commandName = slash[2].toLowerCase();
        args = slash[3]?.trim() ?? "";
      }
    }
    if (!mention && !bot) {
      bot = developerBots.find((item) => item.enabled && raw.startsWith(item.prefix));
      if (bot) {
        const [first, ...rest] = raw.slice(bot.prefix.length).trim().split(/\s+/);
        commandName = first?.toLowerCase() ?? "";
        args = rest.join(" ");
      }
    }
    if (!bot) return false;
    const startedAt = Date.now();
    const rateKey = `${bot.id}:${user.uid}`;
    const lastRun = botRateRef.current.get(rateKey) ?? 0;
    if (startedAt - lastRun < 3_000) {
      setText("");
      void recordDeveloperBotEvent(bot.id, { command: commandName || "unknown", invokedById: user.uid, invokedByName: myName ?? "Member", status: "rate_limited", latencyMs: 0 }).catch(() => undefined);
      void sendPublicMessage(user.uid, bot.name, "Slow down—this bot allows one command every 3 seconds.", "none", { authorPhotoUrl: bot.avatarUrl, isBot: true, botId: bot.id, triggeredById: user.uid });
      return true;
    }
    botRateRef.current.set(rateKey, startedAt);
    const command = bot.commands.find((item) => item.name.toLowerCase() === commandName);
    const reply = command
      ? command.response.replace(/\{user\}/gi, myName ?? "Member").replace(/\{args\}/gi, args).slice(0, 500)
      : `Unknown command. Try: ${bot.commands.map((item) => item.name).join(", ")}`;
    setText("");
    const queuedNotice = window.setTimeout(() => setFilterMessage("Message queued — reconnecting to chat…"), 4_000);
    void sendPublicMessage(user.uid, myName ?? "Anonymous", raw, myProfile?.rank ?? "none", { authorPhotoUrl: myProfile?.photoUrl ?? "" })
      .then(async () => {
        if (command?.action === "verify" && bot.verificationEnabled && !myProfile?.verifiedBotIds.includes(bot.id)) await verifyWithDeveloperBot(bot.id, user.uid);
        return sendPublicMessage(user.uid, bot.name, reply, "none", { authorPhotoUrl: bot.avatarUrl, isBot: true, botId: bot.id, triggeredById: user.uid });
      })
      .then(() => {
        window.clearTimeout(queuedNotice); setFilterMessage("");
        void recordDeveloperBotEvent(bot.id, { command: commandName || "unknown", invokedById: user.uid, invokedByName: myName ?? "Member", status: command ? "success" : "unknown_command", latencyMs: Date.now() - startedAt }).catch(() => undefined);
      })
      .catch((error) => {
        window.clearTimeout(queuedNotice);
        setText((current) => current || raw);
        setFilterMessage(error instanceof Error ? error.message : "Could not send that bot command.");
        void recordDeveloperBotEvent(bot.id, { command: commandName || "unknown", invokedById: user.uid, invokedByName: myName ?? "Member", status: "failed", latencyMs: Date.now() - startedAt }).catch(() => undefined);
      });
    return true;
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
      if (runDeveloperBot(trimmed)) return;
      const sendPromise = sendPublicMessage(user.uid, myName ?? "Anonymous", trimmed, myProfile?.rank ?? "none", {
        authorPhotoUrl: myProfile?.photoUrl ?? "",
        replyTo: replyTo ? { id: replyTo.id, authorId: replyTo.authorId, author: replyTo.authorName, text: replyTo.text, ping: replyPing } : undefined,
      });
      const queuedNotice = window.setTimeout(() => setFilterMessage("Message queued — reconnecting to chat…"), 4_000);
      // Firestore can keep a write promise pending while reconnecting even
      // though the message is already queued locally. Release the composer
      // immediately and attach follow-up work to the eventual acknowledgement.
      setText("");
      const sentReply = replyTo;
      const shouldPingReply = replyPing;
      setReplyTo(null);
      setReplyPing(true);
      void sendPromise.then((sentRef) => {
        window.clearTimeout(queuedNotice);
        setFilterMessage("");
        notifyMentioned(trimmed, user.uid, myName ?? "Someone");
        if (sentReply && shouldPingReply && sentReply.authorId !== user.uid) {
          void createNotification({ recipientId: sentReply.authorId, type: "mention", title: `${myName ?? "Someone"} replied to you in Global Chat`, message: trimmed.slice(0, 100), link: "/chat" });
        }
        // AI screening happens after send so it never blocks the composer.
        void screenChatMessageRemote(user.uid, trimmed, user.email).then((screening) => {
          if (screening.spam) {
            void deletePublicMessage(sentRef.id);
            setFilterMessage(`Your message was removed by AI moderation: ${screening.reason}. Chat is paused for 2 hours.`);
            return;
          }
          const directlyAddressed = /(?:^|\s)@?edubot\b/i.test(trimmed);
          const botSpokeRecently = messages.some((message) => message.isBot && Date.now() - message.createdAt < 45_000);
          if (!directlyAddressed && (botSpokeRecently || Date.now() - lastAmbientReplyRef.current < 45_000)) return;
          lastAmbientReplyRef.current = Date.now();
          const context: ChatMessage[] = [...messages.slice(-11), {
            id: sentRef.id,
            text: trimmed,
            authorId: user.uid,
            authorName: myName ?? "Anonymous",
            authorRank: myProfile?.rank ?? "none",
            authorPhotoUrl: myProfile?.photoUrl ?? "",
            createdAt: Date.now(),
          }];
          void createAmbientChatReply(context).then((reply) => {
            if (reply) void sendPublicMessage(user.uid, "eduBot", reply, "none", { isBot: true });
          });
        });
      }).catch((error) => {
        window.clearTimeout(queuedNotice);
        setText((current) => current || trimmed);
        if (sentReply) { setReplyTo(sentReply); setReplyPing(shouldPingReply); }
        setFilterMessage(error instanceof Error ? error.message : "Could not send that message.");
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
        <span className={`ml-auto flex items-center gap-1 text-[11px] ${chatStatus === "online" ? "text-emerald-300/70" : chatStatus === "reconnecting" ? "text-amber-300/70" : "text-red-300/70"}`}>
          {chatStatus === "online" ? <Wifi size={11}/> : <WifiOff size={11}/>} {chatStatus === "online" ? "Connected" : chatStatus === "reconnecting" ? "Reconnecting" : "Offline"}
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

      <div ref={scrollRef} className={`${tall ? "h-[34rem] min-h-[34rem] lg:h-[calc(100vh-15rem)] lg:max-h-[52rem]" : "max-h-56"} space-y-2.5 overflow-x-hidden overflow-y-auto p-4 sm:p-5`}>
        {messages.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/30">No messages yet — say hi.</p>
        ) : (
          messages.map((m) => (
            <motion.div
              key={m.id}
              id={`public-message-${m.id}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="group flex items-start gap-2"
            >
              {m.isBot ? (
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-500/20">
                  <img src={m.authorPhotoUrl || botIconUrl} alt="" className="h-full w-full object-cover" />
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
                {m.replyToId && (
                  <button
                    type="button"
                    onClick={() => document.getElementById(`public-message-${m.replyToId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                    className="cursor-target mb-1 flex max-w-full items-center gap-1.5 text-left text-[10px] text-white/35 hover:text-white/55"
                  >
                    <Reply size={10} className="shrink-0"/>
                    <span className="shrink-0 font-semibold text-brand-300/70">{m.replyToAuthor}</span>
                    <span className="truncate">{m.replyToText}</span>
                    {m.replyPing === false && <BellOff size={9} className="shrink-0" aria-label="Reply sent without ping"/>}
                  </button>
                )}
                <div className="flex flex-wrap items-baseline gap-1.5">
                  {(() => {
                    const authorProfile = m.isBot ? undefined : allProfiles.find((p) => p.id === m.authorId);
                    const cosmetic = nameStyle(authorProfile);
                    const authorGuild = authorProfile?.guildId ? guildById.get(authorProfile.guildId) : undefined;
                    return (
                      <><span
                          onClick={() => !m.isBot && setOpenProfileId(m.authorId)}
                          className={`cursor-target truncate text-xs font-semibold ${!m.isBot ? "cursor-pointer" : ""} ${cosmetic.className || (m.authorRank && m.authorRank !== "none" ? rankNameClass(m.authorRank) : "text-white")}`}
                          style={cosmetic.style}
                        >
                          {m.authorName}
                        </span><GuildTag tag={authorGuild?.tag} icon={authorGuild?.tagIcon} font={authorGuild?.tagFont} imageUrl={authorGuild?.tagImageUrl} color={authorGuild?.tagColor}/></>
                    );
                  })()}
                  {m.isBot && <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-indigo-300">APP</span>}
                  <RankBadge rank={m.authorRank} />
                  <span className="shrink-0 text-[10px] text-white/30">{timeAgo(m.createdAt)}</span>
                  {m.deliveryState === "sending" ? <Clock3 size={10} className="text-amber-300/60" aria-label="Sending"/> : m.authorId === user?.uid ? <CheckCheck size={10} className="text-emerald-300/45" aria-label="Sent"/> : null}
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
                  <p className="text-sm break-words text-white/70 [overflow-wrap:anywhere]">{renderWithMentions(m.text, myName ?? "", myProfile?.usernameLower ?? "", allProfiles.find((profile) => profile.id === m.authorId)?.customEmojis)}</p>
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
                {m.youtubeId && (
                  <div className="mt-1.5 w-full max-w-sm">
                    <LazyYoutubeEmbed videoId={m.youtubeId} label="YouTube video" />
                  </div>
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
                <button
                  type="button"
                  onClick={() => { setReplyTo(m); setReplyPing(true); }}
                  aria-label={`Reply to ${m.authorName}`}
                  className="cursor-target rounded-lg p-1.5 text-white/25 hover:bg-white/10 hover:text-brand-300"
                >
                  <Reply size={12}/>
                </button>
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
                {isStaffRole(role) && (
                  <button
                    type="button"
                    onClick={() => togglePin(m)}
                    aria-label="Pin message"
                    className="cursor-target rounded-lg p-1.5 text-white/25 hover:bg-white/10 hover:text-white"
                  >
                    {m.pinned ? <Pin size={12} className="text-amber-300" /> : <Pin size={12} />}
                  </button>
                )}
                {(isStaffRole(role) || user?.uid === m.authorId) && (
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
          {replyTo && !pollOpen && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-brand-400/15 bg-brand-500/[.06] px-3 py-2 text-xs">
              <Reply size={13} className="shrink-0 text-brand-300"/>
              <span className="min-w-0 flex-1 truncate text-white/55">Replying to <b className="text-white/80">{replyTo.authorName}</b>: {replyTo.text}</span>
              <button
                type="button"
                role="switch"
                aria-checked={replyPing}
                onClick={() => setReplyPing((value) => !value)}
                className={`cursor-target flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 font-semibold ${replyPing ? "border-brand-400/35 bg-brand-500/15 text-brand-200" : "border-white/10 text-white/35"}`}
                title={replyPing ? "The author will be pinged" : "The author will not be pinged"}
              >
                {replyPing ? <Bell size={11}/> : <BellOff size={11}/>} {replyPing ? "Ping on" : "Ping off"}
              </button>
              <button type="button" onClick={() => { setReplyTo(null); setReplyPing(true); }} aria-label="Cancel reply" className="cursor-target shrink-0 rounded-lg p-1 text-white/30 hover:bg-white/10 hover:text-white"><X size={13}/></button>
            </div>
          )}
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
            <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
              <button type="button" onClick={() => setPollOpen(true)} aria-label="Create poll" className="cursor-target shrink-0 rounded-xl border border-border p-2 text-white/50 hover:border-brand-500/50 hover:text-white">
                <BarChart3 size={14} />
              </button>
              <MentionInput
                value={text}
                onChange={handleTextChange}
                profiles={allProfiles}
                includeSpecial
                placeholder="Say something, or try !coinflip, !rps, !slots, !trivia, !duel..."
                maxLength={500}
                className="w-full rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:border-brand-500/50 focus:outline-none"
              />
              {(myProfile?.customEmojis.length ?? 0) > 0 && <>
                <button type="button" onClick={() => setEmojiOpen((open) => !open)} aria-label="Open custom emojis" className="cursor-target shrink-0 rounded-xl border border-border p-2 text-white/50 hover:border-brand-500/50 hover:text-white"><SmilePlus size={14}/></button>
                {emojiOpen && <div className="absolute bottom-[calc(100%+8px)] right-12 z-40 w-64 rounded-2xl border border-border bg-[#141719] p-3 shadow-2xl"><p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-white/35">Your emojis · 96×96</p><div className="grid grid-cols-4 gap-2">{myProfile!.customEmojis.map((emoji) => <button key={emoji.id} type="button" title={`:${emoji.name}:`} onClick={() => { setText((value) => `${value}${value && !value.endsWith(" ") ? " " : ""}:${emoji.name}: `); setEmojiOpen(false); }} className="cursor-target rounded-xl border border-white/5 bg-white/[.03] p-1.5 hover:border-brand-400/40 hover:bg-brand-500/10"><img src={emoji.url} alt={`:${emoji.name}:`} className="h-10 w-10 object-contain"/></button>)}</div></div>}
              </>}
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
          {filterMessage && <p className="chat-system-notice mt-2 text-xs text-amber-300">{filterMessage}</p>}
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
