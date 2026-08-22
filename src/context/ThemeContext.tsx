import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getColorTheme, setColorTheme as persistColorTheme, type ColorTheme } from "../lib/colorTheme";

interface ThemeContextValue {
  theme: ColorTheme;
  setTheme: (theme: ColorTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ColorTheme>(() => getColorTheme());

  useEffect(() => {
    persistColorTheme(theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
