// Local device identity for Android's direct sync push (see write-fallback.ts
// and offline-transport-monitor.ts). Pure storage — no network here. The
// secret only ever needs to prove "the same device that was registered is
// pushing", the same trust level as the JWT this app already keeps in
// localStorage (see CLAUDE.md Non-negotiable #10), so a native secure-storage
// plugin buys nothing a new APK build+install cycle would be worth here.

const DEVICE_STORAGE_KEY = "yummy-go:offline-sync-device";
const SECRET_BYTE_LENGTH = 32; // -> 64 hex chars, well over Backend's 24-char minimum

export interface OfflineSyncDevice {
  deviceCode: string;
  agentSecret: string;
}

function randomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isValidDevice(value: unknown): value is OfflineSyncDevice {
  const record = value as Partial<OfflineSyncDevice> | null;
  return !!record &&
    typeof record.deviceCode === "string" && record.deviceCode.length > 0 &&
    typeof record.agentSecret === "string" && record.agentSecret.length >= 24;
}

export function getOfflineSyncDeviceAuth(): OfflineSyncDevice | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidDevice(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function persistDevice(device: OfflineSyncDevice) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(device));
  } catch {
    // Storage full/unavailable — the caller still has the value in memory for
    // this session; the next app start mints a fresh one if it never landed.
  }
}

/**
 * One device identity per browser install, minted once and reused across
 * logins/logouts. Registering it against a branch (see
 * `offline-transport-monitor.ts`) still happens per login, since Backend
 * ties the row to a branch — this only owns "does a local identity exist".
 */
export function ensureOfflineSyncDevice(): OfflineSyncDevice {
  const existing = getOfflineSyncDeviceAuth();
  if (existing) return existing;
  const created: OfflineSyncDevice = {
    deviceCode: `android-${randomHex(6)}`,
    agentSecret: randomHex(SECRET_BYTE_LENGTH),
  };
  persistDevice(created);
  return created;
}
