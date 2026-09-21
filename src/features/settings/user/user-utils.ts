import type { ApiEntity } from "@/services/shared/types";
import type { Role, SaveUserInput, User } from "@/services/user";

export function userValue(row: ApiEntity | null | undefined, key: string, fallback = "") {
  const raw = row?.[key];
  if (raw === null || raw === undefined || raw === "") return fallback;
  return String(raw);
}

export function userId(row: User | null | undefined) {
  return userValue(row, "login_uuid");
}

export function roleId(row: Role | User | null | undefined) {
  return userValue(row, "roles_id_fk", userValue(row, "roles_id", userValue(row, "role_id")));
}

export function roleName(row: Role | User | null | undefined) {
  return userValue(row, "roles_name", userValue(row, "role_name", userValue(row, "roles_name_la", userValue(row, "roles_name_eng", "-"))));
}

export function branchName(row: ApiEntity | null | undefined) {
  return userValue(row, "branch_name", userValue(row, "branch_name_la", userValue(row, "branch_name_eng", "-")));
}

export function zoneName(row: ApiEntity | null | undefined, unassigned = "-") {
  if (!userValue(row, "zone_uuid_fk", userValue(row, "zone_uuid"))) return unassigned;
  return userValue(row, "zone_name", userValue(row, "zone_name_la", userValue(row, "zone_name_eng", unassigned)));
}

export function isProtectedUser(row: User) {
  const raw = row.btn_disabled ?? row.btn_disible;
  if (raw === null || raw === undefined) return false;
  const status = String(raw).trim().toLowerCase();
  return Boolean(status) && status !== "null";
}

export function userInitials(email: string) {
  const name = email.split("@")[0]?.trim() || email.trim();
  return (name.slice(0, 2) || "U").toUpperCase();
}

export function userActiveLabel(status: string, active: string, inactive: string) {
  return Number(status || 1) === 1 ? active : inactive;
}

export function userActiveBadgeClass(status: string) {
  return Number(status || 1) === 1
    ? "border-primary/25 bg-primary/10 text-primary"
    : "border-muted-foreground/20 bg-muted text-muted-foreground";
}

export function userRoleOptions(editing: User | null, roleOptions: Role[]) {
  const editingRoleId = roleId(editing);
  if (!editingRoleId || roleOptions.some((role) => roleId(role) === editingRoleId)) return roleOptions;
  return [{ roles_id_fk: editingRoleId, roles_name: roleName(editing) }, ...roleOptions] as Role[];
}

const BULK_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface BulkEmailParseResult {
  duplicates: string[];
  invalidLines: string[];
  valid: string[];
}

// แยกอีเมวที่วางแบบหลายแถว (1 ແຖວ/ອີເມວ) ອອກເປັນລາຍການທີ່ໃຊ້ໄດ້, ລາຍການບໍ່ຖືກຮູບແບບ,
// ແລະ ລາຍການທີ່ຊ້ຳກັນ (case-insensitive) — ໃຊ້ກວດກ່ອນສ້າງຜູ້ໃຊ້ຫຼາຍຄົນພ້ອມກັນ
export function parseBulkEmails(raw: string): BulkEmailParseResult {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const duplicates: string[] = [];
  const invalidLines: string[] = [];
  const valid: string[] = [];

  for (const line of lines) {
    if (!BULK_EMAIL_RE.test(line)) {
      invalidLines.push(line);
      continue;
    }
    const key = line.toLowerCase();
    if (seen.has(key)) {
      if (!duplicates.includes(line)) duplicates.push(line);
      continue;
    }
    seen.add(key);
    valid.push(line);
  }

  return { duplicates, invalidLines, valid };
}

export function buildUserSaveInput({
  active,
  branchUuid,
  editing,
  email,
  password,
  profile,
  selectedRoleId,
  zoneUuid
}: {
  active: string;
  branchUuid: string;
  editing: User | null;
  email: string;
  password: string;
  profile: FormDataEntryValue | null;
  selectedRoleId: string;
  zoneUuid: string;
}): SaveUserInput {
  const id = userId(editing);
  const input: SaveUserInput = {
    branch_uuid_fk: branchUuid,
    roles_id_fk: Number(selectedRoleId),
    login_email: email.trim(),
    login_active: Number(active || 1),
    zone_uuid_fk: zoneUuid.trim() || ""
  };
  if (id) input.login_uuid = id;
  if (password.trim()) input.login_password = password.trim();
  if (profile instanceof File && profile.size) input.login_profile = profile;
  return input;
}
