const KEY = "edushare-ui-version";
export type UiVersion = "v1" | "v2" | "v3" | "v4" | "v5";

export function getUiVersion(): UiVersion {
  const stored = localStorage.getItem(KEY);
  return stored === "v1" || stored === "v2" || stored === "v3" || stored === "v4" || stored === "v5" ? stored : "v2";
}

export function setUiVersion(version: UiVersion) {
  localStorage.setItem(KEY, version);
  if (version === "v1") document.documentElement.removeAttribute("data-ui-version");
  else document.documentElement.setAttribute("data-ui-version", version);
}
