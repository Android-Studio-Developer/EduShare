const KEY = "edushare-color-theme";

export const COLOR_THEMES = [
  { id: "royal", label: "Royal", description: "Electric blue and violet", colors: ["#6d7cff", "#a78bfa", "#0b1020"] },
  { id: "emerald", label: "Emerald", description: "Fresh mint and teal", colors: ["#10b981", "#2dd4bf", "#071612"] },
  { id: "sunset", label: "Sunset", description: "Warm orange and coral", colors: ["#f97316", "#fb7185", "#1b0d0b"] },
  { id: "rose", label: "Rose", description: "Playful pink and plum", colors: ["#ec4899", "#c084fc", "#170a16"] },
  { id: "frost", label: "Frost", description: "Cool cyan and arctic blue", colors: ["#06b6d4", "#60a5fa", "#07131a"] },
] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number]["id"];

export function getColorTheme(): ColorTheme {
  const stored = localStorage.getItem(KEY);
  return COLOR_THEMES.some((theme) => theme.id === stored) ? stored as ColorTheme : "royal";
}

export function setColorTheme(theme: ColorTheme) {
  localStorage.setItem(KEY, theme);
  document.documentElement.setAttribute("data-color-theme", theme);
}
