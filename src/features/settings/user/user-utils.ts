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
  const zones = Array.isArray(row?.zones) ? row.zones : [];
  const names = zones
    .map((zone) => {
      if (typeof zone !== "object" || zone === null) return "";
      const entity = zone as ApiEntity;
      return userValue(
        entity,
        "zone_name",
        userValue(entity, "zone_name_la", userValue(entity, "zone_name_eng"))
      );
    })
    .filter(Boolean);
  if (names.length) return [...new Set(names)].join(", ");
  if (!userZoneUuids(row).length) return unassigned;
  return userValue(row, "zone_name", userValue(row, "zone_name_la", userValue(row, "zone_name_eng", unassigned)));
}

export function userZoneUuids(row: ApiEntity | null | undefined) {
  const assigned = Array.isArray(row?.zone_uuid_fks)
    ? row.zone_uuid_fks
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
  if (assigned.length) return [...new Set(assigned)];

  const legacy = userValue(row, "zone_uuid_fk", userValue(row, "zone_uuid"));
  return legacy ? [legacy] : [];
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
const BULK_PASSWORD_MIN_LENGTH = 4;
const BULK_PASSWORD_MAX_BYTES = 72;

export interface BulkCredentialInput {
  email: string;
  password: string;
}

export interface BulkCredentialValidation {
  duplicateEmails: string[];
  incompleteRows: number[];
  invalidEmails: string[];
  invalidPasswordRows: number[];
  valid: BulkCredentialInput[];
}

// Validate each independent email/password row before starting a multi-user
// create. Password bounds mirror Backend bcrypt validation so one bad row does
// not interrupt the rest of a batch after requests have already started.
export function validateBulkCredentials(rows: BulkCredentialInput[]): BulkCredentialValidation {
  const seen = new Set<string>();
  const duplicateEmails: string[] = [];
  const incompleteRows: number[] = [];
  const invalidEmails: string[] = [];
  const invalidPasswordRows: number[] = [];
  const valid: BulkCredentialInput[] = [];

  rows.forEach((row, index) => {
    const email = row.email.trim();
    const password = row.password.trim();
    if (!email && !password) return;
    if (!email || !password) {
      incompleteRows.push(index + 1);
      return;
    }
    if (!BULK_EMAIL_RE.test(email)) {
      invalidEmails.push(email);
      return;
    }
    const passwordBytes = new TextEncoder().encode(password).length;
    if ([...password].length < BULK_PASSWORD_MIN_LENGTH || passwordBytes > BULK_PASSWORD_MAX_BYTES) {
      invalidPasswordRows.push(index + 1);
      return;
    }
    const key = email.toLowerCase();
    if (seen.has(key)) {
      if (!duplicateEmails.includes(email)) duplicateEmails.push(email);
      return;
    }
    seen.add(key);
    valid.push({ email, password });
  });

  return {
    duplicateEmails,
    incompleteRows,
    invalidEmails,
    invalidPasswordRows,
    valid
  };
}

export function buildUserSaveInput({
  active,
  branchUuid,
  editing,
  email,
  password,
  profile,
  selectedRoleId,
  zoneUuids
}: {
  active: string;
  branchUuid: string;
  editing: User | null;
  email: string;
  password: string;
  profile: FormDataEntryValue | null;
  selectedRoleId: string;
  zoneUuids: string[];
}): SaveUserInput {
  const id = userId(editing);
  const input: SaveUserInput = {
    branch_uuid_fk: branchUuid,
    roles_id_fk: Number(selectedRoleId),
    login_email: email.trim(),
    login_active: Number(active || 1),
    zone_uuid_fks: [...new Set(zoneUuids.map((zoneUuid) => zoneUuid.trim()).filter(Boolean))]
  };
  if (id) input.login_uuid = id;
  if (password.trim()) input.login_password = password.trim();
  if (profile instanceof File && profile.size) input.login_profile = profile;
  return input;
}
