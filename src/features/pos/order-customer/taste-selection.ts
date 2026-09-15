import { optionalNumber, optionalString } from "@/lib/values";
import type { ProdItem, ProdTaste } from "@/services/pos";

export function isTasteAvailable(taste?: ProdTaste | null) {
  return Boolean(tasteUuid(taste)) && optionalNumber(taste?.tasteStatus) !== 2;
}

export function tasteUuid(taste?: ProdTaste | null) {
  return taste ? optionalString(taste.tasteUuid) ?? "" : "";
}

export function tasteDisplayName(taste: ProdTaste, language = "la") {
  return language === "en"
    ? optionalString(taste.tasteName, taste.tasteNameEng, taste.tasteNameLa) ?? "-"
    : optionalString(taste.tasteName, taste.tasteNameLa, taste.tasteNameEng) ?? "-";
}

export function tasteSelectionLimit(product?: ProdItem | null) {
  const configured = optionalNumber(product?.prodTasteMaxSelect) ?? 0;
  const available = (product?.tastes ?? []).filter(isTasteAvailable).length;
  return configured > 0 ? Math.min(configured, available) : 0;
}

export function selectedTastesFromUuids(
  product: ProdItem | null | undefined,
  selectedUuids: string[],
) {
  const selected = new Set(selectedUuids);
  return (product?.tastes ?? []).filter(
    (taste) => isTasteAvailable(taste) && selected.has(tasteUuid(taste)),
  );
}

export function toggleTasteUuid(
  selectedUuids: string[],
  uuid: string,
  limit: number,
) {
  if (selectedUuids.includes(uuid)) {
    return selectedUuids.filter((selectedUuid) => selectedUuid !== uuid);
  }
  if (limit <= 0 || selectedUuids.length >= limit) return selectedUuids;
  return [...selectedUuids, uuid];
}
