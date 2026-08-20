import { useEffect, useState } from "react";

// Forces a re-render on an interval so time-based derivations (like isOnline())
// stay accurate even when nothing new arrives from Firestore to trigger one.
export function useNow(intervalMs = 15_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
