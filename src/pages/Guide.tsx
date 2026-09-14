import type { ReactNode } from "react";
import { BookOpen } from "lucide-react";
import { PURCHASABLE_RANKS, RANK_CREDIT_COST, RANK_LABEL, RANK_LEVEL_REQUIRED, RANK_PERKS, rankNameClass, STAFF_RANKS } from "../lib/ranks";

const COMMANDS: { cmd: string; desc: string }[] = [
  { cmd: "!coinflip", desc: "Flip a coin — small XP either way." },
  { cmd: "!rps rock|paper|scissors", desc: "Play rock-paper-scissors against eduBot." },
  { cmd: "!slots", desc: "Spin the slot machine — match all three for a jackpot." },
  { cmd: "!trivia", desc: "Get a trivia question, then answer with !answer a/b/c/d." },
  { cmd: "!wordle", desc: "Start a 6-guess word game, then guess with !guess <word>." },
  { cmd: "!duel <name> [bet] [game]", desc: "Challenge someone active in chat, optionally betting credits and picking coinflip/rps/dice — they respond with !accept or !decline." },
  { cmd: "!friend <name>", desc: "Send a friend request to someone active in chat." },
  { cmd: "!ai <question>", desc: "Ask eduBot's AI a quick question." },
  { cmd: "!xp", desc: "Check your arcade XP and level." },
  { cmd: "!chatre", desc: "Staff only — wipes Global Chat. Also works in a Voice channel's chat to wipe just that channel." },
  { cmd: "!del", desc: "Staff only — deletes every shared file from Global Chat." },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-mono text-lg font-bold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-white/70">{children}</div>
    </section>
  );
}

export default function Guide() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <div className="flex items-center gap-3">
        <BookOpen size={26} className="text-brand-400" />
        <div>
          <h1 className="font-mono text-2xl font-bold text-white">Site Guide</h1>
          <p className="text-sm text-white/45">Everything SpawnDex can do, in one place.</p>
        </div>
      </div>

      <Section title="Getting started">
        <p>SpawnDex is a directory of Minecraft servers with a community hub built in — chat, voice, friends, ranks, and an arcade bot. Browse servers from the home page, or dive into the community features below.</p>
      </Section>

      <Section title="Ranks & levels">
        <p>Every 5 minutes spent on the site earns a level. Ranks unlock either by reaching the required level for free, or by buying them with SpawnDex Credits.</p>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-white/40">
              <tr>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Level</th>
                <th className="px-3 py-2">Credits</th>
                <th className="px-3 py-2">Perks</th>
              </tr>
            </thead>
            <tbody>
              {PURCHASABLE_RANKS.map((rank) => (
                <tr key={rank} className="border-t border-border">
                  <td className={`px-3 py-2 font-mono font-semibold ${rankNameClass(rank)}`}>{RANK_LABEL[rank]}</td>
                  <td className="px-3 py-2 text-white/60">{RANK_LEVEL_REQUIRED[rank]}</td>
                  <td className="px-3 py-2 text-white/60">{RANK_CREDIT_COST[rank]}</td>
                  <td className="px-3 py-2 text-white/50">{(RANK_PERKS[rank] ?? []).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-white/40">Staff ranks ({STAFF_RANKS.map((r) => RANK_LABEL[r]).join(", ")}) are granted by owners, not purchased.</p>
      </Section>

      <Section title="SpawnDex Credits">
        <p>Credits are earned, not free — claim +15 once a day from your Profile page, or passively earn +8 for every 5 minutes you stay active on the site. Betting and winning duels/games against eduBot is another way to build a stash. You can also send credits directly to another player from their profile card.</p>
      </Section>

      <Section title="Global Chat & eduBot">
        <p>Chat with the whole community. Mention someone with @username to ping them (set your username under Profile — it's first-come, first-served), or use @everyone / @here to ping the whole room / everyone currently online. React to any message, and staff can pin important ones. Use these commands:</p>
        <div className="space-y-1.5">
          {COMMANDS.map((c) => (
            <p key={c.cmd} className="flex flex-wrap gap-x-2">
              <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-brand-300">{c.cmd}</code>
              <span className="text-white/60">{c.desc}</span>
            </p>
          ))}
        </div>
      </Section>

      <Section title="Community servers">
        <p>Servers are Discord-style friend spaces. Open Servers, create a server if you have MVP++ or staff access, then set a banner, invite members by username, assign member/mod/admin tags, and add text or voice channels. Server owners can kick members or ban a username from chatting in that server. SpawnDex does not expose IP addresses for server bans.</p>
      </Section>

      <Section title="Developer bots & EduPy">
        <p>Developer Portal bots run in Global Chat and in servers where an owner installed them from the Bot Marketplace. Use <code>@bot command args</code> or <code>/bot command args</code>. EduPy supports Python-shaped <code>if</code>, <code>elif</code>, and <code>else</code> branches without running unsafe arbitrary code.</p>
        <pre className="overflow-x-auto rounded-2xl border border-border bg-black/30 p-4 text-xs leading-6 text-white/70"><code>{`command help:
    if args == "rules":
        say "Read #rules first."
    elif args contains "join":
        say "Ask staff for the join code."
    else:
        say "Try: help rules or help join"

@verify
def verify(user, args):
    return f"Verified {user}!"`}</code></pre>
        <p><code>{'{user}'}</code> becomes the name of the member who used the command. <code>{'{args}'}</code> becomes everything after the command, so <code>/helper hello Steve</code> can reply with <code>Hey HashtagPro, you said Steve</code>.</p>
      </Section>

      <Section title="Polls">
        <p>Every registered server's chat has a poll button next to the message box — ask a question with 2-4 options, and anyone in that server's chat can vote. Votes update live and you can change your pick any time.</p>
      </Section>

      <Section title="Party & Guild">
        <p>Team up under More → Party & Guild. Parties are quick and small (up to 10 people, auto-disband after 24 hours, leader can disband early). Guilds are bigger and permanent (up to 100 people, owner must manually disband). Both let the owner/leader promote a member to co-owner/co-leader. VIP++ owners and co-owners can style their guild's name with custom colors, a chroma gradient, or a shadow glow.</p>
      </Section>

      <Section title="Voice Chat">
        <p>Discord-style voice channels — join, talk live, and use channel text chat. Every new channel message is automatically read aloud in American English to everyone connected. MVP+ and staff can create new channels. Click a shared screen to focus it, or click any participant's avatar to view their profile.</p>
      </Section>

      <Section title="Friends & messages">
        <p>Send friend requests from Players, chat, or with !friend in Global Chat. Once accepted, click "Message" on a friend to open a private chat — reply to specific messages, pin important ones, react, share files, and delete your own messages.</p>
      </Section>

      <Section title="Your profile">
        <p>Set a display name, username (used for @pings), avatar, bio, and favorite games. VIP++ and above can add an animated banner effect to their profile card. Click any avatar site-wide to open someone's profile card.</p>
        <p>Prefer a different look? Toggle between V1 and V2 interface fonts under Profile → Interface.</p>
      </Section>
    </div>
  );
}
