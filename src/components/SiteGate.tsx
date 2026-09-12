import { useEffect, useRef } from "react";
import { loadDesmosScript, type DesmosCalculator } from "../lib/desmos";

const GATE_CODE = "bruh";
const GATE_TITLE = "Graphing Calculator";
const CALCULATOR_FAVICON = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="12" fill="#1a1a1a"/>
    <path d="M10 44 22 31l9 7 14-21 9 8" fill="none" stroke="#4285f4" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M10 52h44" stroke="#9aa0a6" stroke-width="3" stroke-linecap="round"/>
  </svg>
`)}`;

function normalizedExpression(latex = "") {
  return latex.toLowerCase().replace(/[^a-z]/g, "");
}

function getFaviconLink() {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  return link;
}

export default function SiteGate({ onUnlock }: { onUnlock: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<DesmosCalculator | null>(null);
  const unlockRef = useRef(onUnlock);
  const typedBufferRef = useRef("");
  const unlockedRef = useRef(false);

  useEffect(() => {
    unlockRef.current = onUnlock;
  }, [onUnlock]);

  useEffect(() => {
    const favicon = getFaviconLink();
    const originalTitle = document.title;
    const originalFavicon = favicon.href;
    document.title = GATE_TITLE;
    favicon.href = CALCULATOR_FAVICON;

    return () => {
      document.title = originalTitle;
      favicon.href = originalFavicon;
    };
  }, []);

  useEffect(() => {
    function unlock() {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      unlockRef.current();
    }

    function checkCalculator() {
      const enteredCode = calculatorRef.current
        ?.getExpressions()
        .some((expression) => normalizedExpression(expression.latex) === GATE_CODE);
      if (enteredCode) unlock();
    }

    function trackTyping(event: KeyboardEvent) {
      if (event.key.length !== 1) return;
      typedBufferRef.current = `${typedBufferRef.current}${event.key.toLowerCase()}`.slice(-GATE_CODE.length);
      if (typedBufferRef.current === GATE_CODE) unlock();
    }

    window.addEventListener("keydown", trackTyping, true);
    let cancelled = false;

    loadDesmosScript()
      .then(() => {
        if (cancelled || !mountRef.current || !window.Desmos) return;
        const calculator = window.Desmos.GraphingCalculator(mountRef.current, {
          expressions: true,
          keypad: true,
        });
        calculatorRef.current = calculator;
        calculator.observeEvent("change", checkCalculator);
      })
      .catch(() => {
        // The capture listener still accepts the code if Desmos is unavailable.
      });

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", trackTyping, true);
      calculatorRef.current?.destroy();
      calculatorRef.current = null;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "#2a2a2a" }}>
      <div
        className="flex h-11 shrink-0 items-center gap-2 px-4"
        style={{ background: "#1a1a1a", fontFamily: "'Roboto', 'Helvetica Neue', sans-serif", color: "#e8eaed" }}
      >
        <span style={{ fontWeight: 500, fontSize: 15 }}>Calculator</span>
        <span style={{ fontSize: 12, color: "#9aa0a6" }}>Untitled Graph</span>
      </div>
      <div ref={mountRef} className="min-h-0 flex-1" />
    </div>
  );
}
