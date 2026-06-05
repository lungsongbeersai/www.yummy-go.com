import type { SaveBranchInput } from "@/services/branch";
import type { ApiEntity } from "@/services/shared/types";
import type { SaveStoreInput } from "@/services/store";

export type StoreBranchKind = "store" | "branch";
export type StoreBranchRow = ApiEntity | null | undefined;
export type StoreMissingField = "name" | "email" | null;
export type BranchMissingField = "store" | "name" | null;

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

export function storeBranchId(row: StoreBranchRow, kind: StoreBranchKind) {
  return storeBranchValue(row, kind === "store" ? "store_uuid" : "branch_uuid");
}

export function storeBranchName(row: StoreBranchRow, kind: StoreBranchKind) {
  if (kind === "store") {
    return storeBranchValue(row, "store_name", storeBranchValue(row, "store_name_la", storeBranchValue(row, "store_name_eng", "-")));
  }
  return storeBranchValue(row, "branch_name", storeBranchValue(row, "branch_name_la", storeBranchValue(row, "branch_name_eng", "-")));
}

export function storeBranchMediaKey(row: StoreBranchRow, kind: StoreBranchKind) {
  return kind === "store" ? storeBranchValue(row, "store_logo") : storeBranchValue(row, "branch_qr");
}

export function isStorePlc(row: StoreBranchRow) {
  return storeBranchNumber(row, "store_status", 2) === 1;
}

export function isStoreActive(row: StoreBranchRow) {
  return storeBranchNumber(row, "store_active", 1) === 1;
}

export function formatPercent(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function branchVatSummary(row: StoreBranchRow) {
  const active = storeBranchNumber(row, "vat_status", 2) === 1;
  const percent = Math.max(0, storeBranchNumber(row, "vat_name", 0));
  return { active, percent, percentLabel: `${formatPercent(percent)}%` };
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
  editing,
  email,
  logo,
  nameEng,
  nameLa,
  status
}: {
  active: string;
  editing: StoreBranchRow;
  email: string;
  logo?: File | null;
  nameEng: string;
  nameLa: string;
  status: string;
}): SaveStoreInput {
  const id = storeBranchId(editing, "store");
  const payload: SaveStoreInput = {
    store_name_la: nameLa.trim(),
    store_name_eng: nameEng.trim(),
    store_email: email.trim(),
    store_status: Number(status || 2),
    store_active: Number(active || 1)
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
  qr,
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
  qr?: File | null;
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
    vat_status: Number(vatStatus || 2),
    vat_name: Number(percentOrZero(vatPercent)),
    charge_status: Number(chargeStatus || 2),
    charge_name: Number(percentOrZero(chargePercent))
  };
  if (qr) payload.branch_qr = qr;
  return payload;
}

function percentOrZero(value: string) {
  return value.trim() || "0";
}
