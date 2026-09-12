const AMERICAN_ENGLISH = "en-US";
const VOICE_LOAD_TIMEOUT_MS = 1_500;

// Prefer familiar US voices when a browser exposes more than one. The language
// match is the important part; names vary between Chrome, Edge, Safari, and OSes.
const US_VOICE_NAME_PRIORITY = [
  /aria/i,
  /jenny/i,
  /samantha/i,
  /google us english/i,
  /david/i,
  /mark/i,
  /alex/i,
  /ava/i,
];

let activeUtterance: SpeechSynthesisUtterance | null = null;
let finishActivePlayback: (() => void) | null = null;

function normalizeLanguage(language: string) {
  return language.replace("_", "-").toLowerCase();
}

function chooseAmericanVoice(voices: SpeechSynthesisVoice[]) {
  const americanVoices = voices.filter((voice) => normalizeLanguage(voice.lang) === "en-us");
  for (const preferredName of US_VOICE_NAME_PRIORITY) {
    const match = americanVoices.find((voice) => preferredName.test(voice.name));
    if (match) return match;
  }
  return americanVoices[0] ?? voices.find((voice) => normalizeLanguage(voice.lang).startsWith("en-")) ?? null;
}

function getBrowserVoices() {
  const currentVoices = window.speechSynthesis.getVoices();
  if (currentVoices.length > 0) return Promise.resolve(currentVoices);

  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      window.speechSynthesis.removeEventListener("voiceschanged", finish);
      resolve(window.speechSynthesis.getVoices());
    };
    const timeout = window.setTimeout(finish, VOICE_LOAD_TIMEOUT_MS);
    window.speechSynthesis.addEventListener("voiceschanged", finish);
  });
}

export async function playTtsMessage(text: string, volume = 1) {
  const cleanText = text.replace(/\s+/g, " ").trim().slice(0, 500);
  if (!cleanText) return;
  if (!("speechSynthesis" in window)) throw new Error("Text to speech is not supported by this browser.");

  const voice = chooseAmericanVoice(await getBrowserVoices());
  await new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    activeUtterance = utterance;
    finishActivePlayback = resolve;
    utterance.lang = AMERICAN_ENGLISH;
    utterance.voice = voice;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = Math.max(0, Math.min(1, volume));
    utterance.onend = () => {
      if (activeUtterance === utterance) activeUtterance = null;
      finishActivePlayback = null;
      resolve();
    };
    utterance.onerror = (event) => {
      if (activeUtterance === utterance) activeUtterance = null;
      finishActivePlayback = null;
      reject(new Error(`American English text to speech failed (${event.error}).`));
    };
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  });
}

export function stopTtsPlayback() {
  window.speechSynthesis?.cancel();
  activeUtterance = null;
  finishActivePlayback?.();
  finishActivePlayback = null;
}
