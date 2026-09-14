export const NOTIFICATION_SILENT_KEY = "edushare-notifications-silent";

export function notificationsAreSilent() {
  return typeof window !== "undefined" && window.localStorage.getItem(NOTIFICATION_SILENT_KEY) === "1";
}

export function setNotificationsSilent(silent: boolean) {
  window.localStorage.setItem(NOTIFICATION_SILENT_KEY, silent ? "1" : "0");
  window.dispatchEvent(new CustomEvent("edushare-notification-preferences"));
}
