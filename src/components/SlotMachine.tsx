import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { getIcon, ICON_PALETTE } from "../lib/icons";

interface SlotMachineProps {
  code: string[];
  spinning: boolean;
  onSettled?: () => void;
}

function randomIconId() {
  return ICON_PALETTE[Math.floor(Math.random() * ICON_PALETTE.length)].id;
}

export default function SlotMachine({ code, spinning, onSettled }: SlotMachineProps) {
  const [display, setDisplay] = useState<string[]>(code.map(() => randomIconId()));
  const [settled, setSettled] = useState<boolean[]>(code.map(() => false));
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach(clearInterval);
    timers.current = [];

    if (!spinning) {
      setDisplay(code.map(() => randomIconId()));
      setSettled(code.map(() => false));
      return;
    }

    let settledCount = 0;
    code.forEach((finalIconId, i) => {
      const spinDuration = 550 + i * 220;
      const interval = window.setInterval(() => {
        setDisplay((d) => {
          const next = [...d];
          next[i] = randomIconId();
          return next;
        });
      }, 75);
      timers.current.push(interval);

      const stopTimeout = window.setTimeout(() => {
        clearInterval(interval);
        setDisplay((d) => {
          const next = [...d];
          next[i] = finalIconId;
          return next;
        });
        setSettled((s) => {
          const next = [...s];
          next[i] = true;
          return next;
        });
        settledCount += 1;
        if (settledCount === code.length) onSettled?.();
      }, spinDuration);
      timers.current.push(stopTimeout);
    });

    return () => {
      timers.current.forEach(clearInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning, code.join(",")]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-border bg-surface p-6">
      {display.map((iconId, i) => {
        const icon = getIcon(iconId);
        return (
          <div
            key={i}
            className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-2 shadow-inner sm:h-20 sm:w-20"
          >
            <motion.div
              key={`${i}-${iconId}-${settled[i]}`}
              initial={{ y: settled[i] && spinning ? -22 : 0, opacity: settled[i] && spinning ? 0 : 1 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 22 }}
              className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                settled[i] ? "opacity-100" : "opacity-45"
              }`}
            >
              <img src={icon.src} alt={icon.label} className="pixel-icon h-8 w-8 object-contain sm:h-9 sm:w-9" />
            </motion.div>
            {settled[i] && spinning && (
              <motion.div
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="pointer-events-none absolute inset-0 bg-brand-400/40"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
