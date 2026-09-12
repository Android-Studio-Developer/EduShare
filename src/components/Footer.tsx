import { ArrowUpRight, PackageOpen } from "lucide-react";
import { Link } from "react-router-dom";
import eduShareMark from "../assets/edushare-mark.svg";

export default function Footer() {
  return (
    <footer className="border-t border-white/[.07] py-9">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-5 px-6 text-xs text-white/35 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <img src={eduShareMark} alt="SpawnDex" className="h-7 w-7" />
          <span>Community-made for Minecraft Education.</span>
        </div>
        <div className="flex items-center gap-5">
          <Link to="/changelog" className="cursor-target flex items-center gap-1.5 text-white/45 transition-colors hover:text-white">
            Changelog <ArrowUpRight size={12} />
          </Link>
          <Link
            to="/profile#addons"
            className="cursor-target flex items-center gap-1.5 text-white/45 transition-colors hover:text-white"
          >
            <PackageOpen size={13} /> Cosmetic add-on
          </Link>
          <p>Not affiliated with Mojang or Microsoft.</p>
        </div>
      </div>
    </footer>
  );
}
