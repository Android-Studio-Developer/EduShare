const KEY = "edushare-bg-v2";
export type BackgroundChoice = "galaxy" | "dots";

export function getBackgroundChoice(): BackgroundChoice {
  return localStorage.getItem(KEY) === "dots" ? "dots" : "galaxy";
}

export function setBackgroundChoice(choice: BackgroundChoice) {
  localStorage.setItem(KEY, choice);
}
