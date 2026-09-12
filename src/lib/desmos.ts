declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator: (elt: HTMLElement, options?: Record<string, unknown>) => DesmosCalculator;
    };
  }
}

export interface DesmosExpression {
  id: string;
  latex?: string;
}

export interface DesmosCalculator {
  observeEvent: (event: string, callback: () => void) => void;
  getExpressions: () => DesmosExpression[];
  destroy: () => void;
}

const DESMOS_SCRIPT_SRC = "https://www.desmos.com/api/v1.11/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6";

export function loadDesmosScript(): Promise<void> {
  if (window.Desmos) return Promise.resolve();
  const existing = document.querySelector(`script[src="${DESMOS_SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve) => existing.addEventListener("load", () => resolve()));
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = DESMOS_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Desmos."));
    document.head.appendChild(script);
  });
}
