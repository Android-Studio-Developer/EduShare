const CHUNK_RECOVERY_KEY = "edushare:chunk-recovery";
const RECOVERY_GUARD_MS = 30_000;

const CHUNK_ERROR_PATTERNS = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
  "expected a javascript-or-wasm module script",
  "chunkloaderror",
  "loading chunk",
];

function errorMessage(value: unknown): string {
  if (value instanceof Error) return `${value.name} ${value.message}`.toLowerCase();
  if (typeof value === "string") return value.toLowerCase();
  return "";
}

export function isChunkLoadError(value: unknown): boolean {
  const message = errorMessage(value);
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

export function recoverFromChunkLoadError(value: unknown): boolean {
  if (!isChunkLoadError(value)) return false;

  const lastAttempt = Number(window.sessionStorage.getItem(CHUNK_RECOVERY_KEY) || 0);
  if (Date.now() - lastAttempt < RECOVERY_GUARD_MS) return false;

  window.sessionStorage.setItem(CHUNK_RECOVERY_KEY, String(Date.now()));
  window.location.reload();
  return true;
}

export function clearChunkRecoveryGuard(): void {
  window.sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
}
