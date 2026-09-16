import type { SaveTasteInput, Taste } from "@/services/taste";

export function tasteValue(row: Taste | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

export function tasteId(row: Taste | null | undefined) {
  return tasteValue(row, "taste_uuid");
}

export function tasteName(row: Taste | null | undefined) {
  return tasteValue(row, "taste_name", tasteValue(row, "taste_name_la", tasteValue(row, "taste_name_eng", "-")));
}

export function tasteStatus(row: Taste | null | undefined) {
  return tasteValue(row, "taste_status", "1");
}

export function rowStoreUuid(rows: Taste[]) {
  return tasteValue(rows[0] ?? null, "store_uuid_fk");
}

export type TasteMissingField = "store" | "name" | "status" | null;

export function missingTasteField({
  nameLa,
  status,
  storeUuid
}: {
  nameLa: string;
  status: string;
  storeUuid: string;
}): TasteMissingField {
  if (!storeUuid.trim()) return "store";
  if (!nameLa.trim()) return "name";
  if (!status.trim()) return "status";
  return null;
}

export function buildTastePayload({
  editing,
  nameEng,
  nameLa,
  status,
  storeUuid
}: {
  editing: Taste | null;
  nameEng: string;
  nameLa: string;
  status: string;
  storeUuid: string;
}): SaveTasteInput {
  const payload: SaveTasteInput = {
    store_uuid_fk: storeUuid,
    taste_name_la: nameLa.trim(),
    taste_name_eng: nameEng.trim(),
    taste_status: Number(status || 1)
  };
  const id = tasteId(editing);
  if (id) payload.taste_uuid = id;
  return payload;
}

// ใช้เฉพาะตอน persist ลำดับจากการลาก — ส่ง payload เต็มจากค่าที่มีอยู่แล้วของแถวนั้น (แค่สลับ
// taste_sort) กัน API เคลียร์ชื่อ/สถานะทิ้งถ้า endpoint create ไม่รองรับ partial update
export function buildTasteSortPayload(row: Taste, sort: number): SaveTasteInput {
  return {
    taste_uuid: tasteId(row),
    store_uuid_fk: tasteValue(row, "store_uuid_fk"),
    taste_name_la: tasteValue(row, "taste_name_la", tasteValue(row, "taste_name")),
    taste_name_eng: tasteValue(row, "taste_name_eng"),
    taste_status: Number(tasteStatus(row)),
    taste_sort: sort
  };
}
