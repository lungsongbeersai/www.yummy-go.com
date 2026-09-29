import { stripNumberFormat } from "@/lib/number-format";
import type { SaveBranchInput } from "@/services/branch";
import type { ApiEntity } from "@/services/shared/types";
import type { SaveStoreInput, StoreReportSummary } from "@/services/store";

export type StoreBranchKind = "store" | "branch";
export type StoreBranchRow = ApiEntity | null | undefined;
export type StoreMissingField = "name" | "email" | null;
export type BranchMissingField = "store" | "name" | null;
export type StoreType = "plc" | "general" | "test";

export const STORE_STATUS = {
  PLC: 1,
  GENERAL: 2,
  TEST: 3
} as const;

export function storeBranchValue(row: StoreBranchRow, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

export function storeBranchNumber(row: StoreBranchRow, key: string, fallback = 0) {
  const raw = row?.[key];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && raw !== "" && raw !== undefined && raw !== null ? parsed : fallback;
}

export function storeTableStatusValue(value: unknown) {
  return Number(value) === 2 ? 2 : 1;
}

export function lakRoundingVersionValue(value: unknown) {
  return Number(value) === 2 ? 2 : 1;
}

export function storeBranchId(row: StoreBranchRow, kind: StoreBranchKind) {
  return storeBranchValue(row, kind === "store" ? "store_uuid" : "branch_uuid");
}

export function storeBranchName(row: StoreBranchRow, kind: StoreBranchKind) {
  if (kind === "store") {
    return storeBranchValue(row, "store_name", storeBranchValue(row, "store_name_la", storeBranchValue(row, "store_name_eng", "-")));
  }
  return storeBranchValue(row, "branch_name", storeBranchValue(row, "branch_name_la", storeBranchValue(row, "branch_name_eng", "-")));
}

export function storeAuthUserUpdate(row: StoreBranchRow) {
  return {
    store_logo: storeBranchValue(row, "store_logo"),
    store_name: storeBranchName(row, "store"),
    store_table_status: storeTableStatusValue(row?.store_table_status),
    lak_rounding_version: lakRoundingVersionValue(row?.lak_rounding_version),
    deposit_expire_days: depositExpireDaysValue(row?.deposit_expire_days)
  };
}

// ค่าจาก backend อาจเป็น null (ร้านยังไม่ได้ตั้ง default) หรือตัวเลขจาก
// tb_stores.deposit_expire_days แปลงเป็นตัวเลขหรือ null ให้ AuthUser ใช้ตรงๆ
export function depositExpireDaysValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function isStorePlc(row: StoreBranchRow) {
  return storeBranchNumber(row, "store_status", STORE_STATUS.GENERAL) === STORE_STATUS.PLC;
}

export function isStoreTest(row: StoreBranchRow) {
  return storeBranchNumber(row, "store_status", STORE_STATUS.GENERAL) === STORE_STATUS.TEST;
}

export function storeType(row: StoreBranchRow): StoreType {
  if (isStorePlc(row)) return "plc";
  if (isStoreTest(row)) return "test";
  return "general";
}

export function isStoreActive(row: StoreBranchRow) {
  return storeBranchNumber(row, "store_active", 1) === 1;
}

/** The summary cards double as list filters: one per store type, plus open/closed. */
export type StoreCardFilter = StoreType | "active" | "inactive";

export function storeMatchesCardFilter(row: StoreBranchRow, filter: StoreCardFilter | null) {
  if (!filter) return true;
  if (filter === "active") return isStoreActive(row);
  if (filter === "inactive") return !isStoreActive(row);
  return storeType(row) === filter;
}

function summaryCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
}

export function normalizeStoreReportSummary(value: unknown): StoreReportSummary {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    total: summaryCount(source.total),
    general: summaryCount(source.general),
    plc: summaryCount(source.plc),
    test: summaryCount(source.test),
    active: summaryCount(source.active),
    inactive: summaryCount(source.inactive)
  };
}

export function annualDaysRemaining(row: StoreBranchRow) {
  const raw = row?.annual_days_remaining;
  if (raw === null || raw === undefined || raw === "") return null;
  const days = Number(raw);
  return Number.isFinite(days) ? Math.trunc(days) : null;
}

export function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

// VAT 3 แบบ ต้องตรงกับ back-end/api/v1/shared/vat-calculation.js
export const VAT_EXEMPT = 1;
export const VAT_INCLUDED = 2;
export const VAT_EXCLUDED = 3;

export function branchVatStatusValue(value: unknown) {
  const status = Number(value);
  return status === VAT_INCLUDED || status === VAT_EXCLUDED ? status : VAT_EXEMPT;
}

// สาขาที่ยังไม่ถูก remap ยังเก็บความหมายเดิม (1 = เปิด VAT, 2 = ปิด VAT)
// แยกออกจากความหมายใหม่ได้ด้วย vat_name เหมือนที่ Backend ทำใน
// resolveBranchVatStatus() — ต้องให้ผลตรงกันเสมอ
export function resolveBranchVatStatus(vatStatus: unknown, vatRate: unknown) {
  const status = Number(vatStatus);
  const hasRate = Number(vatRate) > 0;

  if (status === VAT_EXCLUDED) return VAT_EXCLUDED;
  if (status === VAT_INCLUDED) return hasRate ? VAT_INCLUDED : VAT_EXEMPT;
  if (status === VAT_EXEMPT) return hasRate ? VAT_EXCLUDED : VAT_EXEMPT;
  return VAT_EXEMPT;
}

export function branchVatSummary(row: StoreBranchRow) {
  const percent = Math.max(0, storeBranchNumber(row, "vat_name", 0));
  const status = resolveBranchVatStatus(
    storeBranchNumber(row, "vat_status", VAT_EXEMPT),
    percent
  );
  const active = status !== VAT_EXEMPT;
  return { active, percent, percentLabel: `${formatPercent(percent)}%`, status };
}

export function branchChargeSummary(row: StoreBranchRow) {
  const active = storeBranchNumber(row, "charge_status", 2) === 1;
  const percent = Math.max(0, storeBranchNumber(row, "charge_name", 0));
  return { active, percent, percentLabel: `${formatPercent(percent)}%` };
}

export function missingStoreField({ email, nameLa }: { email: string; nameLa: string }): StoreMissingField {
  if (!nameLa.trim()) return "name";
  if (!email.trim()) return "email";
  return null;
}

export function missingBranchField({ name, storeUuid }: { name: string; storeUuid: string }): BranchMissingField {
  if (!storeUuid.trim()) return "store";
  if (!name.trim()) return "name";
  return null;
}

export function buildStorePayload({
  active,
  depositExpireDays,
  editing,
  email,
  logo,
  lakRoundingVersion,
  nameEng,
  nameLa,
  status,
  tableStatus
}: {
  active: string;
  depositExpireDays: string;
  editing: StoreBranchRow;
  email: string;
  logo?: File | null;
  lakRoundingVersion: string;
  nameEng: string;
  nameLa: string;
  status: string;
  tableStatus: string;
}): SaveStoreInput {
  const id = storeBranchId(editing, "store");
  const payload: SaveStoreInput = {
    store_name_la: nameLa.trim(),
    store_name_eng: nameEng.trim(),
    store_email: email.trim(),
    store_status: Number(status || 2),
    store_active: Number(active || 1),
    store_table_status: storeTableStatusValue(tableStatus),
    lak_rounding_version: lakRoundingVersionValue(lakRoundingVersion),
    // ว่าง = ไม่แก้ค่าเดิม (backend เก็บค่าเดิมไว้เหมือน store_table_status) ไม่ใช่ล้างเป็นไม่มี default
    deposit_expire_days: depositExpireDays.trim() ? Number(depositExpireDays) : null
  };
  if (id) payload.store_uuid = id;
  if (logo) payload.store_logo = logo;
  return payload;
}

export function buildBranchPayload({
  address,
  chargePercent,
  chargeStatus,
  editing,
  email,
  name,
  storeUuid,
  tel,
  vatPercent,
  vatStatus
}: {
  address: string;
  chargePercent: string;
  chargeStatus: string;
  editing: StoreBranchRow;
  email: string;
  name: string;
  storeUuid: string;
  tel: string;
  vatPercent: string;
  vatStatus: string;
}): SaveBranchInput {
  const payload: SaveBranchInput = {
    branch_uuid: storeBranchId(editing, "branch"),
    branch_name: name.trim(),
    branch_tel: tel.trim(),
    branch_email: email.trim(),
    branch_address: address.trim(),
    store_uuid_fk: storeUuid.trim(),
    vat_status: branchVatStatusValue(vatStatus),
    vat_name: Number(percentOrZero(vatPercent)),
    charge_status: Number(chargeStatus || 2),
    charge_name: Number(percentOrZero(chargePercent))
  };
  return payload;
}

function percentOrZero(value: string) {
  return stripNumberFormat(value, { decimal: true }) || "0";
}
