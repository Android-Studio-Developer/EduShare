export const LOGIN_UI_PROMPT_EVENT = "edushare:login-ui-prompt";

export function showLoginUiPrompt() {
  window.dispatchEvent(new Event(LOGIN_UI_PROMPT_EVENT));
}
