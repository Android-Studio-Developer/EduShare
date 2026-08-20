export const GAME_COOLDOWN_MS = 8_000;
export const MAX_XP_PER_GAME = 25;

export function arcadeLevel(xp: number): number {
  return Math.floor((xp ?? 0) / 50);
}

export const BOT_HELP =
  "eduBot — !coinflip !rps !slots !trivia+!answer !wordle+!guess !duel <name> [bet] [game] (!accept/!decline) !xp !friend <name> !ai <question> !chatre !del (staff). Losing costs XP now.";

export const DUEL_WIN_XP = 20;
export const DUEL_LOSE_XP = -10;

export const DUEL_GAMES = [
  { id: "coinflip", label: "Coinflip" },
  { id: "rps", label: "Rock Paper Scissors" },
  { id: "dice", label: "Dice Roll" },
] as const;

interface GameResult {
  text: string;
  xp: number;
}

export function playCoinflip(): GameResult {
  const win = Math.random() < 0.5;
  const landed = win ? "heads" : "tails";
  return win
    ? { text: `Coin lands on ${landed} — you win! +8 XP`, xp: 8 }
    : { text: `Coin lands on ${landed} — you lose. -3 XP`, xp: -3 };
}

const RPS_CHOICES = ["rock", "paper", "scissors"] as const;
type RpsChoice = (typeof RPS_CHOICES)[number];

export function playRps(choice: string): GameResult {
  const normalized = choice.toLowerCase().trim();
  if (!RPS_CHOICES.includes(normalized as RpsChoice)) {
    return { text: "Play rock, paper, or scissors: `!rps rock`", xp: 0 };
  }
  const mine = normalized as RpsChoice;
  const bot = RPS_CHOICES[Math.floor(Math.random() * 3)];
  if (mine === bot) return { text: `eduBot also picked ${bot} — tie! +4 XP`, xp: 4 };
  const beats: Record<RpsChoice, RpsChoice> = { rock: "scissors", paper: "rock", scissors: "paper" };
  const won = beats[mine] === bot;
  return won
    ? { text: `eduBot picked ${bot} — you win! +10 XP`, xp: 10 }
    : { text: `eduBot picked ${bot} — you lose. -3 XP`, xp: -3 };
}

const SLOT_SYMBOLS = ["CHERRY", "LEMON", "BELL", "STAR", "GEM"];

export function playSlots(): GameResult {
  const reels = [0, 0, 0].map(() => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]);
  const [a, b, c] = reels;
  const display = reels.join(" | ");
  if (a === b && b === c) return { text: `${display} — JACKPOT! +25 XP`, xp: 25 };
  if (a === b || b === c || a === c) return { text: `${display} — pair! +10 XP`, xp: 10 };
  return { text: `${display} — no match. -3 XP`, xp: -3 };
}

export interface TriviaQuestion {
  q: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  { q: "What year was Minecraft released?", options: ["2009", "2011", "2013", "2015"], correctIndex: 1 },
  { q: "What's the rarest ore in vanilla Minecraft?", options: ["Diamond", "Emerald", "Netherite", "Ancient Debris"], correctIndex: 3 },
  { q: "How many hearts does a player have by default?", options: ["5", "8", "10", "12"], correctIndex: 2 },
  { q: "What mob explodes when it gets close to you?", options: ["Skeleton", "Creeper", "Enderman", "Witch"], correctIndex: 1 },
  { q: "Which of these is NOT a Minecraft dimension?", options: ["Overworld", "Nether", "The End", "The Void"], correctIndex: 3 },
  { q: "What do you combine to make a Beacon?", options: ["Diamond block + Glass + Nether Star", "Gold + Iron + Redstone", "Obsidian + Diamond", "Iron block + Glowstone"], correctIndex: 0 },
  { q: "What's 7 x 8?", options: ["54", "56", "58", "64"], correctIndex: 1 },
  { q: "Which planet is closest to the sun?", options: ["Venus", "Earth", "Mercury", "Mars"], correctIndex: 2 },
];

export function pickTriviaQuestion(): TriviaQuestion {
  return TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
}

export function formatTriviaQuestion(q: TriviaQuestion): string {
  const letters = ["A", "B", "C", "D"];
  return `Trivia: ${q.q} ${q.options.map((o, i) => `${letters[i]}) ${o}`).join("  ")} — answer with !answer a/b/c/d`;
}

export function answerTrivia(pending: TriviaQuestion, letter: string): GameResult {
  const index = "abcd".indexOf(letter.toLowerCase().trim());
  if (index === -1) return { text: "Answer with a, b, c, or d — like `!answer b`", xp: 0 };
  const correct = index === pending.correctIndex;
  const correctLetter = "ABCD"[pending.correctIndex];
  return correct
    ? { text: `Correct! It was ${correctLetter}) ${pending.options[pending.correctIndex]}. +15 XP`, xp: 15 }
    : { text: `Nope, the answer was ${correctLetter}) ${pending.options[pending.correctIndex]}. -3 XP`, xp: -3 };
}

export const WORDLE_MAX_GUESSES = 6;

const WORDLE_WORDS = [
  "CRAFT", "STONE", "WORLD", "BLOCK", "SWORD", "SHELF", "SPAWN", "STEVE", "CREEP", "ARROW",
  "TORCH", "WATER", "OCEAN", "FLAME", "SMELT", "TRADE", "VOICE", "GHOST", "SKULL", "DRAKE",
  "HOUSE", "BEACH", "RIVER", "CLOUD", "PLANT", "BREAD", "APPLE", "GRAPE", "LEMON", "MUSIC",
  "PIANO", "CHESS", "BRAIN", "LIGHT", "NIGHT", "MAGIC", "SPARK", "STORM", "FROST", "GLASS",
  "METAL", "PAPER", "PLANE", "TRAIN", "TRUCK", "HAPPY", "SMILE", "LAUGH", "DANCE", "PARTY",
  "SUGAR", "HONEY", "BERRY", "MANGO", "PEACH", "TIGER", "EAGLE", "SHARK", "WHALE", "HORSE",
] as const;

export function pickWordleWord(): string {
  return WORDLE_WORDS[Math.floor(Math.random() * WORDLE_WORDS.length)];
}

export function evaluateWordleGuess(guess: string, answer: string): { pattern: string; exact: boolean } {
  const g = guess.toUpperCase().split("");
  const a = answer.toUpperCase().split("");
  const result: ("exact" | "present" | "absent")[] = Array(5).fill("absent");
  const used = Array(5).fill(false);
  for (let i = 0; i < 5; i++) {
    if (g[i] === a[i]) {
      result[i] = "exact";
      used[i] = true;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] === "exact") continue;
    const idx = a.findIndex((ch, j) => ch === g[i] && !used[j]);
    if (idx !== -1) {
      result[i] = "present";
      used[idx] = true;
    }
  }
  const symbols = result.map((r) => (r === "exact" ? "#" : r === "present" ? "~" : "-"));
  return { pattern: symbols.join(" "), exact: result.every((r) => r === "exact") };
}

export function wordleWinXp(guessesUsed: number): number {
  return Math.max(25 - (guessesUsed - 1) * 4, 5);
}
