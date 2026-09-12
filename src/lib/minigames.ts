export const GAME_COOLDOWN_MS = 8_000;
export const MAX_XP_PER_GAME = 25;

export function arcadeLevel(xp: number): number {
  return Math.floor((xp ?? 0) / 50);
}

export const BOT_HELP =
  'eduBot — !coinflip !rps !slots !trivia+!answer !wordle+!guess !duel <name> [bet] [game] (!accept/!decline) !xp !friend <name> !ai <question> !em "<youtube link>" !chatre !del (staff). Losing costs XP now.';

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

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  { q: "[Minecraft] In what year did Minecraft receive its full 1.0 release?", options: ["2009", "2010", "2011", "2012"], correctIndex: 2 },
  { q: "[Minecraft] Which mob drops gunpowder when defeated?", options: ["Creeper", "Zombie", "Enderman", "Blaze"], correctIndex: 0 },
  { q: "[Minecraft] Which block is used to build a Nether portal frame?", options: ["Blackstone", "Obsidian", "Deepslate", "Coal Block"], correctIndex: 1 },
  { q: "[Minecraft] What item helps locate a stronghold?", options: ["Compass", "Echo Shard", "Eye of Ender", "Amethyst Shard"], correctIndex: 2 },
  { q: "[Minecraft] What does sand become when smelted?", options: ["Glass", "Terracotta", "Concrete", "Quartz"], correctIndex: 0 },
  { q: "[Minecraft] What currency do villagers use for trading?", options: ["Diamonds", "Gold Ingots", "Lapis Lazuli", "Emeralds"], correctIndex: 3 },
  { q: "[Minecraft] How many hearts does a player have by default?", options: ["5", "8", "10", "20"], correctIndex: 2 },
  { q: "[Minecraft] Which dimension is home to the Ender Dragon?", options: ["The End", "The Nether", "The Overworld", "The Deep Dark"], correctIndex: 0 },
  { q: "[Minecraft] How many bookshelves are needed for maximum enchanting-table power?", options: ["10", "12", "15", "20"], correctIndex: 2 },
  { q: "[Minecraft] Which tool is normally used to mine stone fastest?", options: ["Axe", "Shovel", "Hoe", "Pickaxe"], correctIndex: 3 },

  { q: "[Science] What is the chemical formula for water?", options: ["CO2", "H2O", "O2", "NaCl"], correctIndex: 1 },
  { q: "[Science] Which planet is the largest in our solar system?", options: ["Earth", "Saturn", "Jupiter", "Neptune"], correctIndex: 2 },
  { q: "[Science] What gas do plants absorb during photosynthesis?", options: ["Oxygen", "Nitrogen", "Hydrogen", "Carbon dioxide"], correctIndex: 3 },
  { q: "[Science] What is the largest organ of the human body?", options: ["Heart", "Skin", "Liver", "Lungs"], correctIndex: 1 },
  { q: "[Science] How many bones are normally in an adult human skeleton?", options: ["186", "206", "226", "246"], correctIndex: 1 },
  { q: "[Science] At sea level, water boils at what temperature in Celsius?", options: ["90°C", "95°C", "100°C", "110°C"], correctIndex: 2 },
  { q: "[Science] Which travels faster in a vacuum?", options: ["Sound", "Light", "They travel equally", "Neither can travel"], correctIndex: 1 },
  { q: "[Science] What force keeps planets in orbit around the Sun?", options: ["Magnetism", "Friction", "Gravity", "Electricity"], correctIndex: 2 },
  { q: "[Science] What is the center of an atom called?", options: ["Nucleus", "Membrane", "Cell", "Orbit"], correctIndex: 0 },
  { q: "[Science] Which blood cells primarily carry oxygen?", options: ["White blood cells", "Platelets", "Red blood cells", "Stem cells"], correctIndex: 2 },

  { q: "[Geography] What is the capital of Japan?", options: ["Kyoto", "Tokyo", "Osaka", "Sapporo"], correctIndex: 1 },
  { q: "[Geography] Which is Earth's largest ocean?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], correctIndex: 3 },
  { q: "[Geography] On which continent is Egypt located?", options: ["Africa", "Asia", "Europe", "South America"], correctIndex: 0 },
  { q: "[Geography] Mount Everest is part of which mountain range?", options: ["Andes", "Alps", "Himalayas", "Rockies"], correctIndex: 2 },
  { q: "[Geography] Which country has a maple leaf on its flag?", options: ["Canada", "Norway", "Finland", "Austria"], correctIndex: 0 },
  { q: "[Geography] What is the capital of Australia?", options: ["Sydney", "Melbourne", "Perth", "Canberra"], correctIndex: 3 },
  { q: "[Geography] The Sahara Desert is primarily on which continent?", options: ["Asia", "Africa", "Australia", "North America"], correctIndex: 1 },
  { q: "[Geography] Which imaginary line divides Earth into Northern and Southern Hemispheres?", options: ["Prime Meridian", "Tropic of Cancer", "Equator", "International Date Line"], correctIndex: 2 },
  { q: "[Geography] Which country is shaped like a boot?", options: ["Greece", "Italy", "Portugal", "Chile"], correctIndex: 1 },
  { q: "[Geography] Which U.S. state is made up entirely of islands?", options: ["Alaska", "Florida", "Hawaii", "Rhode Island"], correctIndex: 2 },

  { q: "[History] In what year did humans first land on the Moon?", options: ["1959", "1965", "1969", "1972"], correctIndex: 2 },
  { q: "[History] Which ancient civilization built the pyramids at Giza?", options: ["Romans", "Egyptians", "Vikings", "Aztecs"], correctIndex: 1 },
  { q: "[History] The first ancient Olympic Games were held in which country?", options: ["Italy", "Egypt", "Greece", "France"], correctIndex: 2 },
  { q: "[History] The Renaissance began in which European country?", options: ["Italy", "England", "Spain", "Germany"], correctIndex: 0 },
  { q: "[History] Who developed a famous movable-type printing press in 15th-century Europe?", options: ["Isaac Newton", "Galileo Galilei", "Johannes Gutenberg", "Leonardo da Vinci"], correctIndex: 2 },
  { q: "[History] The Great Wall is located in which country?", options: ["India", "China", "Japan", "Mongolia"], correctIndex: 1 },
  { q: "[History] What number does the Roman numeral X represent?", options: ["5", "10", "50", "100"], correctIndex: 1 },
  { q: "[History] The United States Declaration of Independence was adopted in which year?", options: ["1492", "1776", "1812", "1865"], correctIndex: 1 },

  { q: "[Computing] Which two digits are used in binary?", options: ["0 and 1", "1 and 2", "2 and 3", "8 and 9"], correctIndex: 0 },
  { q: "[Computing] What does CPU stand for?", options: ["Computer Power Unit", "Central Processing Unit", "Core Program Utility", "Central Pixel Unit"], correctIndex: 1 },
  { q: "[Computing] What does URL stand for?", options: ["Universal Routing Link", "Uniform Resource Locator", "User Response Line", "Unified Reference List"], correctIndex: 1 },
  { q: "[Computing] Which keyboard shortcut commonly undoes the last action?", options: ["Ctrl+C", "Ctrl+V", "Ctrl+Z", "Ctrl+P"], correctIndex: 2 },
  { q: "[Computing] Which component stores data temporarily while programs are running?", options: ["RAM", "Monitor", "Keyboard", "Power supply"], correctIndex: 0 },
  { q: "[Computing] Who invented the World Wide Web?", options: ["Bill Gates", "Steve Jobs", "Tim Berners-Lee", "Alan Turing"], correctIndex: 2 },
  { q: "[Computing] What kind of attack uses fake messages or websites to steal information?", options: ["Rendering", "Phishing", "Compiling", "Caching"], correctIndex: 1 },
  { q: "[Computing] HTML is mainly used to do what?", options: ["Structure web pages", "Edit videos", "Train robots", "Compress audio"], correctIndex: 0 },

  { q: "[Math] What is 12 squared?", options: ["24", "122", "144", "148"], correctIndex: 2 },
  { q: "[Math] What is the square root of 144?", options: ["10", "11", "12", "14"], correctIndex: 2 },
  { q: "[Math] Which of these numbers is prime?", options: ["21", "27", "29", "33"], correctIndex: 2 },
  { q: "[Math] How many degrees are in a triangle's interior angles?", options: ["90", "180", "270", "360"], correctIndex: 1 },
  { q: "[Math] How many sides does a hexagon have?", options: ["5", "6", "7", "8"], correctIndex: 1 },
  { q: "[Math] Which fraction equals 0.75?", options: ["1/4", "1/2", "2/3", "3/4"], correctIndex: 3 },
  { q: "[Math] What is 7 × 8?", options: ["54", "56", "58", "64"], correctIndex: 1 },
  { q: "[Math] What is the mean of 4, 6, and 8?", options: ["5", "6", "7", "8"], correctIndex: 1 },

  { q: "[Language] Which word is a synonym for rapid?", options: ["Slow", "Fast", "Quiet", "Heavy"], correctIndex: 1 },
  { q: "[Language] Which word is an antonym of ancient?", options: ["Old", "Historic", "Modern", "Ruined"], correctIndex: 2 },
  { q: "[Language] Which writer created Romeo and Juliet?", options: ["William Shakespeare", "Charles Dickens", "Jane Austen", "Mark Twain"], correctIndex: 0 },
  { q: "[Language] A noun most commonly names what?", options: ["An action", "A person, place, thing, or idea", "A description", "A comparison"], correctIndex: 1 },

  { q: "[Animals] Which of these animals is a mammal?", options: ["Shark", "Octopus", "Whale", "Trout"], correctIndex: 2 },
  { q: "[Animals] How many hearts does an octopus have?", options: ["1", "2", "3", "4"], correctIndex: 2 },
  { q: "[Animals] What is the fastest land animal?", options: ["Cheetah", "Lion", "Horse", "Greyhound"], correctIndex: 0 },
  { q: "[Animals] What is the largest known animal on Earth?", options: ["African elephant", "Blue whale", "Giraffe", "Giant squid"], correctIndex: 1 },
  { q: "[Animals] Which of these is an amphibian?", options: ["Lizard", "Frog", "Turtle", "Snake"], correctIndex: 1 },

  { q: "[Art & Music] Who painted the Mona Lisa?", options: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Claude Monet"], correctIndex: 2 },
  { q: "[Art & Music] How many keys are on a standard modern piano?", options: ["66", "76", "88", "100"], correctIndex: 2 },
  { q: "[Art & Music] Which artist created The Great Wave off Kanagawa?", options: ["Hokusai", "Rembrandt", "Michelangelo", "Dalí"], correctIndex: 0 },
  { q: "[Art & Music] Beethoven is best known for which kind of work?", options: ["Sculpture", "Architecture", "Classical music", "Photography"], correctIndex: 2 },
];

let triviaBag: TriviaQuestion[] = [];
let lastTriviaQuestion = "";

function refillTriviaBag() {
  triviaBag = [...TRIVIA_QUESTIONS];
  for (let i = triviaBag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [triviaBag[i], triviaBag[j]] = [triviaBag[j], triviaBag[i]];
  }
  if (triviaBag.length > 1 && triviaBag.at(-1)?.q === lastTriviaQuestion) {
    [triviaBag[0], triviaBag[triviaBag.length - 1]] = [triviaBag[triviaBag.length - 1], triviaBag[0]];
  }
}

export function pickTriviaQuestion(): TriviaQuestion {
  if (triviaBag.length === 0) refillTriviaBag();
  const question = triviaBag.pop() ?? TRIVIA_QUESTIONS[0];
  lastTriviaQuestion = question.q;
  return question;
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
