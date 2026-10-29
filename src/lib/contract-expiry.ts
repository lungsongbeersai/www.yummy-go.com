export interface ContractExpiryNotice {
  branchUuid?: string;
  endOn?: string;
  daysRemaining?: number;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function calendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function contractExpiryFromPayload(payload: unknown): ContractExpiryNotice | null {
  if (!record(payload) || payload.code !== "BRANCH_CONTRACT_EXPIRED") return null;
  const notice: ContractExpiryNotice = {};
  if (typeof payload.branch_uuid === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.branch_uuid)) {
    notice.branchUuid = payload.branch_uuid.toLowerCase();
  }
  if (calendarDate(payload.contract_end_on)) notice.endOn = payload.contract_end_on;
  if (typeof payload.contract_days_remaining === "number" && Number.isSafeInteger(payload.contract_days_remaining) && payload.contract_days_remaining < 0) {
    notice.daysRemaining = payload.contract_days_remaining;
  }
  return notice;
}

export function contractExpiryFromError(error: unknown): ContractExpiryNotice | null {
  if (!record(error)) return null;
  if (error.statusCode === 401) return contractExpiryFromPayload(error.payload);
  if (record(error.response) && error.response.status === 401) return contractExpiryFromPayload(error.response.data);
  return null;
}

export function isContractExpiredError(error: unknown): boolean {
  return contractExpiryFromError(error) !== null;
}
