export const STORE_CATEGORIES = ["restaurant", "cafe", "mala", "pho", "pub", "bar"] as const;

export type StoreCategory = (typeof STORE_CATEGORIES)[number];

export function normalizeStoreCategory(value: unknown): StoreCategory {
  return STORE_CATEGORIES.find((category) => category === value) ?? "restaurant";
}
