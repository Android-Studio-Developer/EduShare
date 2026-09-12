import { useEffect, useState } from "react";
import { isReduceMotion } from "../lib/accessibility";
import { extractEmbedUrl, isEmbedRequest } from "../lib/embed";
import RippleDistortion from "./RippleDistortion";

export default function ProfileBannerMedia({ value, className = "" }: { value: string; className?: string }) {
  const embedUrl = extractEmbedUrl(value);
  const requestedEmbed = isEmbedRequest(value);
  const [rippleFailed, setRippleFailed] = useState(false);

  useEffect(() => {
    setRippleFailed(false);
  }, [value]);

  if (!value.trim()) return null;

  if (requestedEmbed && !embedUrl) {
    return <div className={`absolute inset-0 grid place-items-center bg-[#111214] text-xs font-semibold text-white/55 ${className}`}>:( trouble iframing — check the URL</div>;
  }

  if (!embedUrl) {
    // Most hotlinked image hosts don't send CORS headers, so the WebGL ripple
    // texture silently fails to load — fall back to a plain <img> (which has
    // no CORS requirement) rather than showing an opaque blank canvas. Also
    // skip the WebGL entirely under Reduce Motion / performance mode.
    if (rippleFailed || isReduceMotion()) {
      return <img src={value} alt="" className={`absolute inset-0 h-full w-full object-cover ${className}`} />;
    }
    return (
      <RippleDistortion
        src={value}
        grayscale={false}
        tintAmount={0}
        quality="low"
        className={className}
        style={{ position: "absolute", inset: 0 }}
        onError={() => setRippleFailed(true)}
      />
    );
  }

  return (
    <div className={`absolute inset-0 overflow-hidden bg-black ${className}`}>
      <iframe
        src={embedUrl}
        title="Profile banner embed"
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-forms allow-same-origin allow-scripts"
        className="h-full w-full border-0"
      />
      <a
        href={embedUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="cursor-target absolute bottom-1.5 right-1.5 z-20 rounded-md bg-black/70 px-2 py-1 text-[9px] font-semibold text-white/70 backdrop-blur hover:text-white"
      >
        :( trouble iframing?
      </a>
    </div>
  );
}
