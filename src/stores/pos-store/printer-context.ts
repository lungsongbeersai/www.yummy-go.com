import { isCapacitorMobileApp } from "@/lib/capacitor-platform";
import { printerPrintModeForPlatform } from "@/lib/printer-platform";
import {
  getBrowserPrinterIdentity,
  migrateMobilePrinterDevice,
  rememberNativePrinterDeviceCode,
  resolvePrinterDeviceIdentity,
  type PrinterDeviceContextParams,
} from "@/services/printer";

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

const nativeMigrationAttempts = new Map<string, Promise<void>>();

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
    : await resolvePrinterDeviceIdentity().then((result) => {
        if (!result.ok) throw new Error(result.error);
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
