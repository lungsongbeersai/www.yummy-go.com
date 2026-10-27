export type ContractPackageMonths = 1 | 3 | 6 | 12;

interface BranchContractViewer {
  store_status?: unknown;
  status?: unknown;
}

interface CurrentBranchContractViewer extends BranchContractViewer {
  branch_uuid?: unknown;
  contract_end_on?: unknown;
  contract_days_remaining?: unknown;
}

export interface CurrentBranchContractStatus {
  endOn: string;
  daysRemaining: number;
  tone: "normal" | "warning" | "expired";
}

function isContractCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function currentBranchContractStatus(user?: CurrentBranchContractViewer | null): CurrentBranchContractStatus | null {
  if (!canViewBranchContractPackage(user) || typeof user?.branch_uuid !== "string" || !user.branch_uuid.trim() ||
    !isContractCalendarDate(user.contract_end_on) || typeof user.contract_days_remaining !== "number" ||
    !Number.isSafeInteger(user.contract_days_remaining)) return null;
  const daysRemaining = user.contract_days_remaining;
  return {
    endOn: user.contract_end_on,
    daysRemaining,
    tone: daysRemaining < 0 ? "expired" : daysRemaining <= 30 ? "warning" : "normal",
  };
}

export function contractDateLabel(value: string, language: string): string {
  if (!isContractCalendarDate(value)) return "";
  return new Intl.DateTimeFormat(language.toLowerCase().startsWith("en") ? "en-US" : "lo-LA", {
    day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function canViewBranchContractPackage(user?: BranchContractViewer | null): boolean {
  return user?.store_status === 1 || user?.store_status === "1";
}

export function canEditBranchContract(user?: BranchContractViewer | null): boolean {
  const role = user?.status;
  return canViewBranchContractPackage(user) && (role === 1 || role === 2 || role === "1" || role === "2");
}

export function branchContractPackageMonths(value: unknown): ContractPackageMonths | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const months = Number(value);
  return months === 1 || months === 3 || months === 6 || months === 12 ? months : null;
}

export function contractToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Vientiane", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function contractEndOn(start: string, months: ContractPackageMonths): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !branchContractPackageMonths(months)) return "";
  const [year, month, day] = start.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return "";
  // UTC calendar dates avoid timezone/DST drift; clamp month-end just as PostgreSQL intervals do.
  const initial = new Date(0);
  initial.setUTCFullYear(year, month, 0);
  if (day > initial.getUTCDate()) return "";
  const end = new Date(0);
  end.setUTCFullYear(year, month - 1 + months, 1);
  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth();
  if (endYear > 9999) return "";
  const lastDay = new Date(0);
  lastDay.setUTCFullYear(endYear, endMonth + 1, 0);
  end.setUTCDate(Math.min(day, lastDay.getUTCDate()));
  return end.toISOString().slice(0, 10);
}
