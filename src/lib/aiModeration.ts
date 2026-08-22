import { OWNER_EMAIL } from "./moderation";

// Same-origin keeps school networks from calling the AI provider directly and
// prevents AGNES_API_KEY from ever entering the browser bundle.
const AGNES_API_ENDPOINT = "/api/chat";
const BAN_KEY = "edushare-mod-application-ban-until";
const BAN_DURATION = 2 * 60 * 60 * 1000;
const CHAT_BAN_PREFIX = "edushare-chat-ban-until:";

interface ScreeningResult {
  spam: boolean;
  reason: string;
}

interface AgnesResponse {
  text?: string;
  error?: string;
}

export function getApplicationBanRemaining() {
  const until = Number(localStorage.getItem(BAN_KEY) ?? 0);
  return Math.max(0, until - Date.now());
}

function applyApplicationBan() {
  localStorage.setItem(BAN_KEY, String(Date.now() + BAN_DURATION));
}

export function formatBanRemaining(ms: number) {
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes} more minute(s)`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} more hour(s)` : `${hours}h ${rest}m more`;
}

const FAIL_OPEN: ScreeningResult = {
  spam: false,
  reason: "AI screening unavailable, allowed by default.",
};

const LEET_MAP: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "$": "s",
  "@": "a",
  "!": "i",
};

const PROFANITY = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "nigger",
  "nigga",
  "cunt",
  "whore",
  "slut",
  "faggot",
  "retard",
  "rape",
];

function normalizeForProfanity(text: string) {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => LEET_MAP[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]/g, "");
}

function localProfanityCheck(text: string): ScreeningResult | null {
  const normalized = normalizeForProfanity(text);
  const hit = PROFANITY.find((word) => normalized.includes(word));
  return hit ? { spam: true, reason: `Blocked word detected: "${hit}"` } : null;
}

async function callAgnesOnce(
  message: string,
  options: { preamble?: string; temperature?: number },
): Promise<string | null> {
  let response: Response;

  try {
    response = await fetch(AGNES_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        preamble: options.preamble,
        temperature: options.temperature,
      }),
    });
  } catch (error) {
    console.error("Agnes API request failed:", error);
    return null;
  }

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error(`Agnes API returned ${response.status}:`, details);
    return null;
  }

  try {
    const data = (await response.json()) as AgnesResponse;
    const text = data.text?.trim();
    return text || null;
  } catch (error) {
    console.error("Could not parse Agnes API response:", error);
    return null;
  }
}

// The endpoint is a third-party Cloudflare Worker outside this codebase —
// a single transient failure (cold start, brief rate limit) shouldn't read
// as "the AI is down" to the user, so retry once before giving up.
async function callAgnes(
  message: string,
  options: { preamble?: string; temperature?: number } = {},
): Promise<string | null> {
  const first = await callAgnesOnce(message, options);
  if (first) return first;
  return callAgnesOnce(message, options);
}

function parseScreeningResult(text: string | null): ScreeningResult | null {
  if (!text) return null;

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]) as Partial<ScreeningResult>;
    if (typeof parsed.spam !== "boolean") return null;

    return {
      spam: parsed.spam,
      reason:
        typeof parsed.reason === "string" && parsed.reason.trim()
          ? parsed.reason.trim().slice(0, 220)
          : parsed.spam
            ? "Blocked by AI moderation."
            : "Allowed by AI moderation.",
    };
  } catch {
    return null;
  }
}

export async function screenModeratorApplication(
  answers: Record<string, string>,
): Promise<ScreeningResult> {
  const localHit = localProfanityCheck(Object.values(answers).join(" "));
  if (localHit) {
    applyApplicationBan();
    return localHit;
  }

  const text = await callAgnes(JSON.stringify(answers), {
    preamble:
      'You are eduShare\'s moderator-application spam detector. Decide whether the application is spam, a raid, random filler, repeated nonsense, abusive content, or clearly does not answer the questions. Do not reject merely for weak grammar, short sentences, or being young. Return ONLY compact JSON in exactly this shape: {"spam":true|false,"reason":"short explanation"}. Do not use markdown or code fences.',
    temperature: 0,
  });

  const result = parseScreeningResult(text) ?? FAIL_OPEN;
  if (result.spam) applyApplicationBan();
  return result;
}

export async function askAi(question: string): Promise<string> {
  const cleanQuestion = question.trim().slice(0, 1200);
  if (!cleanQuestion) return "Usage: !ai <question>";

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const text = await callAgnes(cleanQuestion, {
    preamble:
      `You are eduBot, a friendly helper in an educational Minecraft community. The current date is ${today}. Answer the user's question directly in 1-2 short sentences. Use plain text only, no markdown. Keep responses safe and age-appropriate.`,
    temperature: 0.7,
  });

  if (!text) return "Couldn't reach Agnes AI right now — try again in a bit.";
  return text.length > 290 ? `${text.slice(0, 289)}…` : text;
}

function isOwnerEmail(email?: string | null) {
  return email?.toLowerCase() === OWNER_EMAIL;
}

// The owner is exempt from AI-moderation chat bans — same "unbannable"
// guarantee as the real ban system, just applied to this separate,
// client-side localStorage mute instead of the Firestore banned field.
export function getChatBanRemaining(userId: string, email?: string | null) {
  if (isOwnerEmail(email)) return 0;
  return Math.max(
    0,
    Number(localStorage.getItem(`${CHAT_BAN_PREFIX}${userId}`) ?? 0) - Date.now(),
  );
}

function setChatBan(userId: string, email?: string | null) {
  if (isOwnerEmail(email)) return;
  localStorage.setItem(`${CHAT_BAN_PREFIX}${userId}`, String(Date.now() + BAN_DURATION));
}

// Instant, local-only — safe to await on the hot path before sending.
export function checkLocalProfanity(message: string): ScreeningResult | null {
  return localProfanityCheck(message);
}

// Hits the remote AI endpoint (can take seconds, even longer on a cold
// start) — call this AFTER the message is already sent, never before, or
// every message send blocks on network latency. Deletes/bans retroactively.
export async function screenChatMessageRemote(
  userId: string,
  message: string,
  email?: string | null,
): Promise<ScreeningResult> {
  const text = await callAgnes(message, {
    preamble:
      'You are eduShare\'s classroom chat safety filter. Flag messages containing harassment, slurs, sexual content, threats, scams, deliberate spam/raids, or personal contact information. Do not flag normal Minecraft discussion, mild disagreement, or harmless slang. Return ONLY compact JSON in exactly this shape: {"spam":true|false,"reason":"short explanation"}. Do not use markdown or code fences.',
    temperature: 0,
  });

  const result = parseScreeningResult(text) ?? FAIL_OPEN;
  if (result.spam) {
    setChatBan(userId, email);
  }
  return result;
}

export async function screenChatMessage(
  userId: string,
  message: string,
  email?: string | null,
): Promise<ScreeningResult> {
  const localHit = checkLocalProfanity(message);
  if (localHit) {
    setChatBan(userId, email);
    return localHit;
  }
  return screenChatMessageRemote(userId, message, email);
}
