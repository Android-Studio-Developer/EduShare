import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getBackgroundChoice, setBackgroundChoice as persistBackgroundChoice, type BackgroundChoice } from "../lib/backgroundChoice";

interface BackgroundContextValue {
  background: BackgroundChoice;
  setBackground: (b: BackgroundChoice) => void;
}

const BackgroundContext = createContext<BackgroundContextValue | null>(null);

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [background, setBackgroundState] = useState<BackgroundChoice>(() => getBackgroundChoice());

  useEffect(() => {
    persistBackgroundChoice(background);
  }, [background]);

  return <BackgroundContext.Provider value={{ background, setBackground: setBackgroundState }}>{children}</BackgroundContext.Provider>;
}

export function useBackground() {
  const ctx = useContext(BackgroundContext);
  if (!ctx) throw new Error("useBackground must be used within BackgroundProvider");
  return ctx;
}
