import { useState } from "react";
import { Play } from "lucide-react";

// YouTube's default embed preview shows the video's own (often loud,
// clickbait-y) thumbnail before playback. This swaps that for a plain,
// on-brand placeholder and only mounts the real iframe once clicked.
export default function LazyYoutubeEmbed({ videoId, label }: { videoId: string; label: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface-2">
      {loaded ? (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title={label}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          className="cursor-target flex h-full w-full flex-col items-center justify-center gap-2 text-white/50 hover:text-white"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
            <Play size={16} className="ml-0.5" />
          </span>
          <span className="text-xs font-medium">{label}</span>
        </button>
      )}
    </div>
  );
}
