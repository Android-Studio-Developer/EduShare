import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getUiVersion, setUiVersion as persistUiVersion, type UiVersion } from "../lib/uiVersion";

interface UiVersionContextValue {
  uiVersion: UiVersion;
  setUiVersion: (v: UiVersion) => void;
}

const UiVersionContext = createContext<UiVersionContextValue | null>(null);

export function UiVersionProvider({ children }: { children: ReactNode }) {
  const [uiVersion, setUiVersionState] = useState<UiVersion>(() => getUiVersion());

  useEffect(() => {
    persistUiVersion(uiVersion);
  }, [uiVersion]);

  return <UiVersionContext.Provider value={{ uiVersion, setUiVersion: setUiVersionState }}>{children}</UiVersionContext.Provider>;
}

export function useUiVersion() {
  const ctx = useContext(UiVersionContext);
  if (!ctx) throw new Error("useUiVersion must be used within UiVersionProvider");
  return ctx;
}
