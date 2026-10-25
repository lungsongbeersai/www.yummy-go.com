import { isCapacitorMobileApp } from "@/lib/capacitor-platform";
import { ServiceError } from "@/lib/api";
import { printerPrintModeForPlatform } from "@/lib/printer-platform";
import { registerSessionStoreReset } from "@/stores/session-store-registry";
import {
  getBrowserPrinterIdentity,
  isBrowserPrinterAgentId,
  migrateMobilePrinterDevice,
  rememberNativePrinterDeviceCode,
  resolvePrinterDeviceIdentity,
  registerPrinterAgent,
  type AgentInfo,
  type PrinterDeviceContextParams,
} from "@/services/printer";

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

const nativeMigrationAttempts = new Map<string, Promise<void>>();
interface PosAgentRegistration {
  request: Promise<void>;
  registeredAt: number | null;
}
// Renew before Backend's 120-second SHARED presence window, including the
// first POS action after a background tab resumes without its poll heartbeat.
const POS_AGENT_REGISTRATION_FRESH_MS = 90_000;
const agentRegistrations = new Map<string, PosAgentRegistration>();
registerSessionStoreReset("pos-printer-agent-registration", () => { agentRegistrations.clear(); });

async function ensurePosAgentRegistered(loginUuid: string, agent: AgentInfo) {
  const agentUrl = textValue(agent.agent_url);
  if (!agentUrl || !textValue(agent.agent_id) || !textValue(agent.device_code) || isBrowserPrinterAgentId(agent.agent_id)) return;
  try {
    const url = new URL(agentUrl);
    const octets = url.hostname.split(".");
    // Backend registers reachable IPv4 owners only. Loopback/hostname/IPv6
    // discovery can still serve direct local USB and must not block checkout.
    if (
      !["http:", "https:"].includes(url.protocol) || octets.length !== 4 ||
      !octets.every((value) => /^\d{1,3}$/.test(value) && Number(value) <= 255) ||
      Number(octets[0]) === 127
    ) return;
  } catch {
    return;
  }
  const registration = {
    login_uuid_fk: loginUuid,
    agent_id: textValue(agent.agent_id),
    agent_name: textValue(agent.agent_name),
    agent_url: agentUrl,
    agent_secret_hash: textValue(agent.agent_secret_hash),
    device_code: textValue(agent.device_code),
    platform: textValue(agent.platform),
  };
  const key = JSON.stringify(registration);
  const existing = agentRegistrations.get(key);
  if (existing) {
    if (existing.registeredAt === null) return existing.request;
    const age = Date.now() - existing.registeredAt;
    if (age >= 0 && age < POS_AGENT_REGISTRATION_FRESH_MS) return existing.request;
  }
  // Rebind only this connected physical device before a POS mutation. Concurrent
  // kitchen/invoice/payment calls share one bounded registration per identity.
  const renewal: PosAgentRegistration = {
    registeredAt: null,
    request: registerPrinterAgent(registration, { timeout: 5000 }).then(() => {
      renewal.registeredAt = Date.now();
    }).catch((error: unknown) => {
      if (agentRegistrations.get(key) === renewal) agentRegistrations.delete(key);
      throw new ServiceError(
        "Printer Agent registration could not be completed. Please try again.",
        503,
        error,
        { error_code: "PRINTER_AGENT_REGISTRATION_FAILED", retryable: true },
      );
    }),
  };
  agentRegistrations.set(key, renewal);
  return renewal.request;
}

async function ensureNativeMobilePrinterMigration({
  deviceCode,
  loginUuid,
  previousDeviceCode,
}: {
  deviceCode: string;
  loginUuid: string;
  previousDeviceCode: string;
}) {
  const migrationKey = `${loginUuid}:${deviceCode}:${previousDeviceCode}`;
  const existing = nativeMigrationAttempts.get(migrationKey);
  if (existing) return existing;

  const migration = migrateMobilePrinterDevice({
    login_uuid_fk: loginUuid,
    ...(previousDeviceCode && previousDeviceCode !== deviceCode
      ? { from_device_code: previousDeviceCode }
      : {}),
    to_device_code: deviceCode,
  }).then(() => {
    rememberNativePrinterDeviceCode(deviceCode);
  });

  nativeMigrationAttempts.set(migrationKey, migration);
  try {
    await migration;
  } catch (error) {
    nativeMigrationAttempts.delete(migrationKey);
    throw error;
  }
}

// ตัว resolve ตัวตนเครื่องพิมพ์/agent ที่ใช้ร่วมกันทุก action ฝั่ง POS ที่ยิงคำสั่งพิมพ์
// (confirm to kitchen, send to kitchen, ...) — แยกจาก pos-store.ts เพื่อให้ store อื่น
// (เช่น pos-order-queue-store) เรียกใช้ซ้ำได้โดยไม่ต้อง import pos-store.ts ทั้งไฟล์
export async function resolvePosPrinterContext(
  input: PrinterDeviceContextParams & {
    agent_name?: string;
    lang?: string;
  }
) {
  const native = isCapacitorMobileApp();
  const identity = native
    ? await getBrowserPrinterIdentity()
    : await resolvePrinterDeviceIdentity().then(async (result) => {
        if (result.authorizationFailed) {
          throw new ServiceError(result.error || "Printer Agent authorization failed", 403, undefined, {
            error_code: "PRINTER_AGENT_AUTHORIZATION_FAILED", retryable: true,
          });
        }
        if (!result.ok) throw new Error(result.error);
        if (result.connected !== false) await ensurePosAgentRegistered(input.login_uuid_fk, result.agent);
        return result.agent;
      });
  const deviceCode = textValue(identity.device_code);
  const agentId = textValue(identity.agent_id);

  if (!deviceCode || !agentId) {
    throw new Error("Printer device identity missing");
  }

  const previousDeviceCode = textValue(identity.previous_device_code);
  if (native) {
    await ensureNativeMobilePrinterMigration({
      deviceCode,
      loginUuid: input.login_uuid_fk,
      previousDeviceCode,
    });
  }

  const suppliedIdentityMatches =
    textValue(input.device_code) === deviceCode &&
    (!textValue(input.agent_id) || textValue(input.agent_id) === agentId);

  return {
    device_code: deviceCode,
    agent_id: agentId,
    agent_name: textValue(identity.agent_name) || input.agent_name,
    print_mode:
      (suppliedIdentityMatches ? textValue(input.print_mode) : "") ||
      printerPrintModeForPlatform(identity.platform, native),
  };
}
