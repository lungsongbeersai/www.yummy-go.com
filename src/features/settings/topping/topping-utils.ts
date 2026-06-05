import type { SaveToppingInput, Topping } from "@/services/topping";

export function toppingValue(row: Topping | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

export function toppingId(row: Topping | null | undefined) {
  return toppingValue(row, "topping_uuid");
}

export function toppingName(row: Topping | null | undefined) {
  return toppingValue(row, "topping_name", toppingValue(row, "topping_name_la", toppingValue(row, "topping_name_eng", "-")));
}

export type ToppingMissingField = "store" | "name" | null;

export function missingToppingField({ nameLa, storeUuid }: { nameLa: string; storeUuid: string }): ToppingMissingField {
  if (!storeUuid.trim()) return "store";
  if (!nameLa.trim()) return "name";
  return null;
}

export function buildToppingPayload({
  editing,
  nameEng,
  nameLa,
  storeUuid
}: {
  editing: Topping | null;
  nameEng: string;
  nameLa: string;
  storeUuid: string;
}): SaveToppingInput {
  const payload: SaveToppingInput = {
    store_uuid_fk: storeUuid,
    topping_name_la: nameLa.trim(),
    topping_name_eng: nameEng.trim()
  };
  const id = toppingId(editing);
  if (id) payload.topping_uuid = id;
  return payload;
}
