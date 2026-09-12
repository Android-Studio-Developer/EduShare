const MOTION_KEY = "edushare-reduce-motion";
const TEXT_KEY = "edushare-text-size";
const CONTRAST_KEY = "edushare-high-contrast";

export type TextSize = "normal" | "large";

export function isReduceMotion() {
  return localStorage.getItem(MOTION_KEY) === "1";
}

export function isLowPowerDevice() {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4)
    || (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 4)
    || nav.connection?.saveData === true;
}

export function getTextSize(): TextSize {
  return localStorage.getItem(TEXT_KEY) === "large" ? "large" : "normal";
}

export function isHighContrast() {
  return localStorage.getItem(CONTRAST_KEY) === "1";
}

export function setReduceMotion(value: boolean) {
  localStorage.setItem(MOTION_KEY, value ? "1" : "0");
  if (value) document.documentElement.setAttribute("data-reduce-motion", "1");
  else document.documentElement.removeAttribute("data-reduce-motion");
}

export function setTextSize(value: TextSize) {
  localStorage.setItem(TEXT_KEY, value);
  if (value === "large") document.documentElement.setAttribute("data-text-size", "large");
  else document.documentElement.removeAttribute("data-text-size");
}

export function setHighContrast(value: boolean) {
  localStorage.setItem(CONTRAST_KEY, value ? "1" : "0");
  if (value) document.documentElement.setAttribute("data-high-contrast", "1");
  else document.documentElement.removeAttribute("data-high-contrast");
}
