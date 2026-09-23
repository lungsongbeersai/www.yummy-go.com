const CHUNK_LOAD_ERROR_PATTERNS = [
  /chunkloaderror/i,
  /failed to load chunk/i,
  /loading chunk .+ failed/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
];

const AUTO_RECOVERY_KEY = "yummy-go:chunk-recovery-at";
const AUTO_RECOVERY_COOLDOWN_MS = 60_000;

function errorText(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  return "";
}

export function isChunkLoadError(error: unknown) {
  const text = errorText(error);
  return CHUNK_LOAD_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

function allowAutomaticRecovery() {
  try {
    const previous = Number(window.sessionStorage.getItem(AUTO_RECOVERY_KEY) || 0);
    if (Date.now() - previous < AUTO_RECOVERY_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(AUTO_RECOVERY_KEY, String(Date.now()));
  } catch {
    // Storage can be unavailable in private WebViews. A single reload is still safe.
  }
  return true;
}

export async function recoverFromChunkLoadError(
  error: unknown,
  options: { automatic?: boolean } = {},
) {
  if (!isChunkLoadError(error) || typeof window === "undefined") return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  if (options.automatic && !allowAutomaticRecovery()) return false;

  window.location.reload();
  return true;
}
