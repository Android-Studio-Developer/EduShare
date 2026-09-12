import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import eduShareIcon from "../assets/edushare-os.svg";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
}

export default function AuthShell({ eyebrow, title, description, icon: Icon, children }: AuthShellProps) {
  return (
    <main className="auth-stage">
      <div className="auth-grid" aria-hidden="true" />

      <Link to="/" className="cursor-target auth-brand" aria-label="Back to SpawnDex home">
        <span className="auth-brand-mark"><img src={eduShareIcon} alt="" /></span>
        <span>
          <strong>SpawnDex</strong>
          <small>learn · play · connect</small>
        </span>
      </Link>

      <div className="auth-layout">
        <motion.section
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: .6, ease: [0.22, 1, 0.36, 1] }}
          className="auth-cosmos-copy"
        >
          <p className="auth-cosmos-kicker"><span /> SpawnDex universe</p>
          <h2>Your Friends.<br /><em>Chat</em></h2>
          <p> SpawnDex 
Chat, Find, Play, Edit!.</p>
          <div className="auth-planet" aria-hidden="true">
            <span className="auth-planet-core" />
            <span className="auth-planet-ring auth-planet-ring-one" />
            <span className="auth-planet-ring auth-planet-ring-two" />
            <i className="auth-moon auth-moon-one" />
            <i className="auth-moon auth-moon-two" />
          </div>
          <div className="auth-signal"><span /><span /><span /> Connected across the stars</div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          className="auth-card"
        >
          <header className="auth-card-header">
            <div className="auth-title-row">
              <span className="auth-title-icon"><Icon size={19} strokeWidth={2} /></span>
              <div>
                <p className="auth-eyebrow">{eyebrow}</p>
                <h1>{title}</h1>
              </div>
            </div>
            <p className="auth-description">{description}</p>
          </header>
          {children}
        </motion.section>
      </div>

      <p className="auth-footnote">Protected by SpawnDex account security</p>
    </main>
  );
}
