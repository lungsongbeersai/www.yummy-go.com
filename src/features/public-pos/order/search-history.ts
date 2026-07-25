import {
  PUBLIC_SEARCH_HISTORY_LIMIT,
  PUBLIC_SEARCH_HISTORY_STORAGE_PREFIX,
} from "@/features/public-pos/order/constants";

export function publicSearchHistoryKey(
  branchUuid: string | null | undefined,
  lang: string,
) {
  return `${PUBLIC_SEARCH_HISTORY_STORAGE_PREFIX}:${branchUuid?.trim() || "global"}:${lang}`;
}

export function addPublicSearchHistoryItem(history: string[], query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return normalizePublicSearchHistory(history);

  return normalizePublicSearchHistory([normalizedQuery, ...history]);
}

export function normalizePublicSearchHistory(history: string[]) {
  const seen = new Set<string>();
  const nextHistory: string[] = [];

  history.forEach((item) => {
    const query = item.trim();
    const lookupKey = query.toLocaleLowerCase();
    if (!query || seen.has(lookupKey)) return;

    seen.add(lookupKey);
    nextHistory.push(query);
  });

  return nextHistory.slice(0, PUBLIC_SEARCH_HISTORY_LIMIT);
}

export function readPublicSearchHistory(key: string) {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.localStorage.getItem(key);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    if (!Array.isArray(parsedValue)) return [];

    return normalizePublicSearchHistory(
      parsedValue.filter((item): item is string => typeof item === "string"),
    );
  } catch {
    return [];
  }
}

export function writePublicSearchHistory(key: string, history: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(normalizePublicSearchHistory(history)),
    );
  } catch {
    // Ignore localStorage failures in private or restricted browser contexts.
  }
}

export function clearPublicSearchHistory(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore localStorage failures in private or restricted browser contexts.
  }
}
