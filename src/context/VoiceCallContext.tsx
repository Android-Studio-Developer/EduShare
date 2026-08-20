import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useVoiceChannel } from "../hooks/useVoiceChannel";

type VoiceCallValue = ReturnType<typeof useVoiceChannel> & {
  deafened: boolean;
  setDeafened: Dispatch<SetStateAction<boolean>>;
};

const VoiceCallContext = createContext<VoiceCallValue | null>(null);

// Mounted once at the app root (outside the router), so the WebRTC
// connection this owns survives page navigation instead of tearing down —
// useVoiceChannel's cleanup effect fires whenever the component that calls
// it unmounts, which used to be Voice.tsx itself on every route change.
export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const voice = useVoiceChannel();
  const [deafened, setDeafened] = useState(false);

  return <VoiceCallContext.Provider value={{ ...voice, deafened, setDeafened }}>{children}</VoiceCallContext.Provider>;
}

export function useVoiceCall() {
  const ctx = useContext(VoiceCallContext);
  if (!ctx) throw new Error("useVoiceCall must be used within VoiceCallProvider");
  return ctx;
}
