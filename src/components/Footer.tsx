import { Download, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import eduShareMark from "../assets/edushare-mark.svg";

export default function Footer() {
  return (
    <footer className="border-t border-white/[.07] bg-white/[.015] py-10 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-white/40 sm:flex-row">
        <div className="flex items-center gap-2">
          <img src={eduShareMark} alt="eduShare" className="h-7 w-7" />
          <span>eduShare — built for Minecraft Education classrooms.</span>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/changelog" className="cursor-target flex items-center gap-1.5 text-white/50 transition-colors hover:text-brand-400">
            <Sparkles size={13} /> Changelog
          </Link>
          <a
            href="/downloads/edushare-cosmetic-pack.mcaddon"
            download
            className="cursor-target flex items-center gap-1.5 text-white/50 transition-colors hover:text-brand-400"
          >
            <Download size={13} /> Cosmetic pack (.mcaddon)
          </a>
          <p>Not affiliated with Mojang or Microsoft.</p>
        </div>
      </div>
    </footer>
  );
}
