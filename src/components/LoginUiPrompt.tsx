import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AppWindow, ArrowRight, Palette, Sparkles, X } from "lucide-react";
import { useUiVersion } from "../context/UiVersionContext";
import { LOGIN_UI_PROMPT_EVENT } from "../lib/loginUiPrompt";

export default function LoginUiPrompt() {
  const { uiVersion } = useUiVersion();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(LOGIN_UI_PROMPT_EVENT, show);
    return () => window.removeEventListener(LOGIN_UI_PROMPT_EVENT, show);
  }, []);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ opacity: 0, y: 24, scale: .96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: .97 }}
          transition={{ type: "spring", stiffness: 360, damping: 28 }}
          className="login-ui-prompt"
          role="status"
          aria-live="polite"
        >
          <button type="button" onClick={() => setOpen(false)} className="cursor-target login-ui-prompt-close" aria-label="Dismiss"><X size={14}/></button>
          <div className="flex items-start gap-3">
            <span className="login-ui-prompt-icon"><Palette size={18}/></span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-brand-300">Welcome back</p>
              <h2 className="mt-1 text-base font-bold text-white">Prefer a better look?</h2>
              <p className="mt-1 text-xs leading-relaxed text-white/50">Try V3 Workspace or the new SpawnDex OS. You can switch anytime in Profile.</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className={`login-ui-prompt-option ${uiVersion === "v3" ? "is-active" : ""}`}><Sparkles size={14}/><span><strong>Workspace</strong><small>V3</small></span></div>
            <div className={`login-ui-prompt-option ${uiVersion === "v4" ? "is-active" : ""}`}><AppWindow size={14}/><span><strong>SpawnDex OS</strong><small>V4</small></span></div>
          </div>
          <Link to="/profile#interface-settings" onClick={() => setOpen(false)} className="cursor-target login-ui-prompt-action">Check it out in Profile <ArrowRight size={14}/></Link>
        </motion.aside>
      )}
    </AnimatePresence>,
    document.body,
  );
}
