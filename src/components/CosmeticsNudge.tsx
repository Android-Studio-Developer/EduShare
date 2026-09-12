import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { subscribeToProfile } from "../lib/profiles";

const DISMISS_KEY = "edushare-cosmetics-nudge-dismissed";

export default function CosmeticsNudge() {
  const { user } = useAuth();
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToProfile(user.uid, (profile) => {
      setEligible(!!profile && (profile.ownedCosmetics ?? []).length === 0);
    });
  }, [user]);

  useEffect(() => {
    if (!eligible || localStorage.getItem(DISMISS_KEY) === "1") return;
    const timer = window.setTimeout(() => setOpen(true), 4000);
    return () => window.clearTimeout(timer);
  }, [eligible]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ type: "spring", stiffness: 340, damping: 26 }}
          className="fixed bottom-5 right-5 z-[150] w-72 rounded-2xl border border-brand-400/25 bg-surface p-4 shadow-2xl"
          role="status"
          aria-live="polite"
        >
          <button type="button" onClick={dismiss} className="cursor-target absolute right-2.5 top-2.5 text-white/35 hover:text-white" aria-label="Dismiss">
            <X size={14} />
          </button>
          <div className="flex items-start gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-300"><Sparkles size={16} /></span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white">We worked hard on this!</h2>
              <p className="mt-1 text-xs leading-relaxed text-white/50">Fonts, name effects, avatar rings and a rotating profile border are ready to unlock in your profile.</p>
            </div>
          </div>
          <Link to="/profile#cosmetics" onClick={dismiss} className="cursor-target mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-400">
            Check it out <ArrowRight size={13} />
          </Link>
        </motion.aside>
      )}
    </AnimatePresence>,
    document.body,
  );
}
