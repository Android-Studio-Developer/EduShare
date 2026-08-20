const KEY = "edushare-ui-version";
export type UiVersion = "v1" | "v2";

export function getUiVersion(): UiVersion {
  return localStorage.getItem(KEY) === "v1" ? "v1" : "v2";
}

export function setUiVersion(version: UiVersion) {
  localStorage.setItem(KEY, version);
  if (version === "v2") document.documentElement.setAttribute("data-ui-version", "v2");
  else document.documentElement.removeAttribute("data-ui-version");
}
