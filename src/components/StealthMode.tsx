import { useEffect, useState } from "react";
import googleIcon from "./google.svg";

const KEY = "edushare-stealth";
const EVENT = "edushare-stealth-change";
const CLOAK_TITLE = "Google";

export function isStealthEnabled() {
  return localStorage.getItem(KEY) === "1";
}

export function setStealthEnabled(on: boolean) {
  localStorage.setItem(KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(EVENT));
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

export default function StealthMode() {
  const [enabled, setEnabled] = useState(isStealthEnabled());

  useEffect(() => {
    function sync() {
      setEnabled(isStealthEnabled());
    }
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const link = getFaviconLink();
    const originalTitle = document.title;
    const originalFavicon = link.href;

    function cloak() {
      document.title = CLOAK_TITLE;
      link.href = googleIcon;
    }
    function uncloak() {
      document.title = originalTitle;
      link.href = originalFavicon;
    }
    function onVisibility() {
      if (document.hidden) cloak();
      else uncloak();
    }

    window.addEventListener("blur", cloak);
    window.addEventListener("focus", uncloak);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", cloak);
      window.removeEventListener("focus", uncloak);
      document.removeEventListener("visibilitychange", onVisibility);
      uncloak();
    };
  }, [enabled]);

  return null;
}
