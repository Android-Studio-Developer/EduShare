import { useMemo, useRef } from "react";
import LetterGlitch from "./LetterGlitch";

// Deterministic pseudo-random per index so particle layout doesn't reshuffle on every render.
function seeded(i: number, salt: number) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function useParticles(count: number, sizeRange: [number, number], durationRange: [number, number], salt = 0) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const size = sizeRange[0] + seeded(i, salt + 1) * (sizeRange[1] - sizeRange[0]);
        const duration = durationRange[0] + seeded(i, salt + 2) * (durationRange[1] - durationRange[0]);
        return {
          left: `${seeded(i, salt + 3) * 100}%`,
          top: `${seeded(i, salt + 5) * 100}%`,
          size,
          duration,
          delay: -seeded(i, salt + 4) * duration,
        };
      }),
    [count, sizeRange[0], sizeRange[1], durationRange[0], durationRange[1], salt],
  );
}

function useSnowflakes(count: number, sizeRange: [number, number], salt: number) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const fallDuration = 6 + seeded(i, salt + 1) * 8;
        const swayDuration = 2 + seeded(i, salt + 2) * 2;
        const driftSign = seeded(i, salt + 3) > 0.5 ? 1 : -1;
        return {
          left: `${seeded(i, salt + 4) * 100}%`,
          size: sizeRange[0] + seeded(i, salt + 5) * (sizeRange[1] - sizeRange[0]),
          fallDuration,
          swayDuration,
          fallDelay: -seeded(i, salt + 6) * fallDuration,
          swayDelay: -seeded(i, salt + 7) * swayDuration,
          drift: driftSign * (20 + seeded(i, salt + 8) * 40),
          sway: driftSign * (6 + seeded(i, salt + 9) * 10),
        };
      }),
    [count, sizeRange[0], sizeRange[1], salt],
  );
}

const INTERACTIVE = new Set(["particle-field", "starfield", "spotlight", "holographic"]);

export default function BannerEffect({ effect }: { effect: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

  const particles = useParticles(effect === "particle-field" ? 26 : 0, [2, 5], [3, 7]);
  const starsFar = useParticles(effect === "starfield" ? 45 : 0, [1, 2], [1.5, 4], 10);
  const starsNear = useParticles(effect === "starfield" ? 16 : 0, [1.5, 3], [1.5, 4], 20);
  const bars = useParticles(effect === "waveform" ? 22 : 0, [4, 4], [0.7, 1.6], 30);
  const snowFar = useSnowflakes(effect === "snow" ? 26 : 0, [2, 4], 40);
  const snowNear = useSnowflakes(effect === "snow" ? 14 : 0, [4, 7], 50);

  if (!effect) return null;

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!INTERACTIVE.has(effect)) return;
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    el.style.setProperty("--mx", `${px - rect.width / 2}px`);
    el.style.setProperty("--my", `${py - rect.height / 2}px`);
    el.style.setProperty("--mxp", `${(px / rect.width) * 100}%`);
    el.style.setProperty("--myp", `${(py / rect.height) * 100}%`);
  }

  function handleMouseLeave() {
    const el = rootRef.current;
    if (!el) return;
    el.style.setProperty("--mx", "0px");
    el.style.setProperty("--my", "0px");
    el.style.setProperty("--mxp", "50%");
    el.style.setProperty("--myp", "50%");
  }

  return (
    <div
      ref={rootRef}
      className={`banner-effect-root fx-${effect}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {effect === "aurora-glow" && <div className="fx-aurora-glow" />}

      {effect === "mesh-gradient" && (
        <>
          <span className="fx-blob" />
          <span className="fx-blob" />
          <span className="fx-blob" />
        </>
      )}

      {effect === "particle-field" && (
        <div className="fx-particle-layer">
          {particles.map((p, i) => (
            <span
              key={i}
              className="fx-particle"
              style={{ left: p.left, top: p.top, width: p.size, height: p.size, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }}
            />
          ))}
        </div>
      )}

      {effect === "light-sweep" && <div className="fx-light-sweep" />}
      {effect === "cyber-grid" && <div className="fx-cyber-grid" />}
      {effect === "liquid-waves" && <div className="fx-liquid-waves" />}

      {effect === "starfield" && (
        <>
          <div className="fx-star-layer fx-star-layer--far">
            {starsFar.map((s, i) => (
              <span key={i} className="fx-star" style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s` }} />
            ))}
          </div>
          <div className="fx-star-layer fx-star-layer--near">
            {starsNear.map((s, i) => (
              <span key={i} className="fx-star" style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s` }} />
            ))}
          </div>
        </>
      )}

      {effect === "spotlight" && <div className="fx-spotlight" />}

      {effect === "waveform" && (
        <div className="fx-waveform">
          {bars.map((b, i) => (
            <span key={i} className="fx-bar" style={{ animationDuration: `${b.duration}s`, animationDelay: `${b.delay}s` }} />
          ))}
        </div>
      )}

      {effect === "holographic" && <div className="fx-holographic" />}

      {effect === "letter-glitch" && (
        <LetterGlitch glitchColors={["#4169e1", "#38bdf8", "#d946ef"]} glitchSpeed={40} outerVignette smooth backgroundColor="transparent" />
      )}

      {effect === "snow" && (
        <>
          {[...snowFar.map((f) => ({ ...f, layer: "far" as const })), ...snowNear.map((f) => ({ ...f, layer: "near" as const }))].map((f, i) => (
            <span
              key={i}
              className={`fx-flake fx-flake--${f.layer}`}
              style={
                {
                  left: f.left,
                  width: f.size,
                  height: f.size,
                  animationDuration: `${f.fallDuration}s, ${f.swayDuration}s`,
                  animationDelay: `${f.fallDelay}s, ${f.swayDelay}s`,
                  "--fx-drift": `${f.drift}px`,
                  "--fx-sway": `${f.sway}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </>
      )}
    </div>
  );
}
