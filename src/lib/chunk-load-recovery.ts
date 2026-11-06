const CHUNK_LOAD_ERROR_PATTERNS = [
  /chunkloaderror/i,
  /failed to load chunk/i,
  /loading chunk .+ failed/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
];

function errorText(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  return "";
}

export function isChunkLoadError(error: unknown) {
  const text = errorText(error);
  return CHUNK_LOAD_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

export async function recoverFromChunkLoadError(
  error: unknown,
  options: { automatic?: boolean } = {},
) {
  // A background failure must not discard an open form or checkout. Retry is user initiated.
  if (options.automatic) return false;
  if (!isChunkLoadError(error) || typeof window === "undefined") return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;

  window.location.reload();
  return true;
}
