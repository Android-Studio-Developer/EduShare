import { useEffect, useRef, useState } from "react";
import { Calculator as CalculatorIcon } from "lucide-react";
import LazyYoutubeEmbed from "../components/LazyYoutubeEmbed";
import { loadDesmosScript, type DesmosCalculator } from "../lib/desmos";

export default function Calculator() {
  const mountRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<DesmosCalculator | null>(null);
  const triggeredRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [bruhMode, setBruhMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadDesmosScript()
      .then(() => {
        if (cancelled || !mountRef.current || !window.Desmos) return;
        const calculator = window.Desmos.GraphingCalculator(mountRef.current, {
          expressions: true,
          keypad: true,
        });
        calculatorRef.current = calculator;
        calculator.observeEvent("change", () => {
          const hasBruh = calculator
            .getExpressions()
            .some((expr) => (expr.latex ?? "").toLowerCase().includes("bruh"));
          if (hasBruh && !triggeredRef.current) {
            triggeredRef.current = true;
            setBruhMode(true);
          } else if (!hasBruh) {
            triggeredRef.current = false;
          }
        });
        setReady(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load Desmos."));
    return () => {
      cancelled = true;
      calculatorRef.current?.destroy();
      calculatorRef.current = null;
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <div className="flex items-center gap-3">
        <CalculatorIcon size={26} className="text-brand-400" />
        <div>
          <h1 className="text-2xl font-semibold text-white">Calculator</h1>
          <p className="text-sm text-white/45">Graphing calculator, powered by Desmos.</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
        <div ref={mountRef} className="h-[560px] w-full" />
        {!ready && !error && <p className="p-6 text-center text-sm text-white/40">Loading calculator…</p>}
        {error && <p className="p-6 text-center text-sm text-red-400">{error}</p>}
      </div>

      {bruhMode && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="text-4xl font-black tracking-tight text-amber-300">BOOYAH!</p>
            <p className="mt-1 text-sm text-white/50">You typed bruh in a calculator. You know what happens now.</p>
            <div className="mt-4">
              <LazyYoutubeEmbed videoId="dQw4w9WgXcQ" label="You brought this on yourself" />
            </div>
            <button
              type="button"
              onClick={() => setBruhMode(false)}
              className="cursor-target mt-4 rounded-xl border border-border px-4 py-2 text-sm text-white/60 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
