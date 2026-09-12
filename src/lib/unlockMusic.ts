const KEY = "edushare-play-on-unlock";
const VOLUME = 0.35;

// Deliberately NOT wired into MusicContext/the visible Lofi/Peak player —
// this has no UI of its own (no track pill, no "Music off" label change,
// no progress bar). It's a separate ambient <audio> instance, on or off via
// this one Profile toggle, independent of whatever the visible player is doing.
const PLAYLIST = ["/wii-music.mp3", "/edushare-bg.mp3"];

let audio: HTMLAudioElement | null = null;
let index = 0;

export function isPlayOnUnlockEnabled(): boolean {
  return localStorage.getItem(KEY) === "1";
}

export function setPlayOnUnlockEnabled(value: boolean) {
  localStorage.setItem(KEY, value ? "1" : "0");
}

function playCurrent() {
  if (!audio) return;
  audio.src = PLAYLIST[index];
  void audio.play().catch(() => {});
}

// Called once, right as the site gate is bypassed — that click/keypress is
// itself a real user gesture, so starting playback here still passes
// browser autoplay-with-sound restrictions.
export function playUnlockMusicOnce() {
  if (!isPlayOnUnlockEnabled()) return;
  if (!audio) {
    audio = new Audio();
    audio.volume = VOLUME;
    // Playlist, not a per-track loop — plays each track once, then advances
    // to the next, wrapping back to the start when it runs out.
    audio.addEventListener("ended", () => {
      index = (index + 1) % PLAYLIST.length;
      playCurrent();
    });
  }
  playCurrent();
}
