import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, ScrollText, ShieldCheck, Sparkles } from "lucide-react";
import SlotMachine from "./SlotMachine";
import Button from "./Button";
import BorderGlow from "./BorderGlow";
import { getIcon } from "../lib/icons";

interface RulesGateProps {
  rules: string[];
  code: string[];
  onReveal?: () => void;
}

export default function RulesGate({ rules, code, onReveal }: RulesGateProps) {
  const [agreed, setAgreed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [settled, setSettled] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleReveal() {
    if (!agreed || revealed) return;
    setRevealed(true);
    onReveal?.();
  }

  async function handleCopy() {
    const readable = code.map((id) => getIcon(id).label).join(", ");
    await navigator.clipboard.writeText(readable);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <BorderGlow
      backgroundColor="#0f1116"
      borderRadius={20}
      glowRadius={36}
      glowColor="258 90% 76%"
      colors={["#a78bfa", "#8b5cf6", "#38bdf8"]}
      animated
    >
    <div className="overflow-hidden rounded-[20px]">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-6 py-4">
        <ScrollText size={17} className="text-brand-400" />
        <h3 className="font-mono font-semibold text-white">Server Rules</h3>
      </div>

      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div
            key="rules"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-6"
          >
            <ul className="space-y-3">
              {rules.map((rule, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 text-sm text-white/75"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-[11px] font-bold text-brand-400">
                    {i + 1}
                  </span>
                  {rule}
                </motion.li>
              ))}
            </ul>

            <label className="cursor-target mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-2/50 p-4 transition-colors hover:border-brand-500/40">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand-500"
              />
              <span className="text-sm text-white/80">
                I agree to follow the rules above while playing on this server.
              </span>
            </label>

            <Button
              className="mt-5 w-full"
              size="lg"
              disabled={!agreed}
              onClick={handleReveal}
            >
              <ShieldCheck size={17} />
              Agree &amp; Reveal Join Code
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-5 p-6"
          >
            <div className="flex items-center gap-2 text-sm text-brand-300">
              <Sparkles size={15} />
              {settled ? "Your code is ready" : "Spinning up your code..."}
            </div>

            <SlotMachine code={code} spinning={revealed} onSettled={() => setSettled(true)} />

            <AnimatePresence>
              {settled && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full"
                >
                  <Button variant="secondary" className="w-full" onClick={handleCopy}>
                    {copied ? <Check size={16} className="text-brand-400" /> : <Copy size={16} />}
                    {copied ? "Copied!" : "Copy join code"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </BorderGlow>
  );
}
