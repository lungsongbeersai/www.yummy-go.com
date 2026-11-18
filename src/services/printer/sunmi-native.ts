import { Capacitor } from "@capacitor/core";
import { ServiceError } from "@/lib/api";
import type { AgentInfo, PrintJob } from "@/services/printer/types";
import { SUNMI_PRINTER_INTERFACE, SUNMI_PRINT_MODE, SUNMI_PRINTER_AGENT_ID } from "@/config/sunmi-printer";
import { createSessionGuard } from "@/stores/session-store-registry";
export { SUNMI_PRINTER_INTERFACE, SUNMI_PRINT_MODE, SUNMI_PRINTER_AGENT_ID } from "@/config/sunmi-printer";

export interface SunmiPrinterInfo {
  supported: boolean;
  connected: boolean;
  ready: boolean;
  model: string;
  paperWidthMm: number | null;
  stateCode: number | null;
  deviceCode: string;
  interfaceValue: string;
  serialNumber?: string;
  serviceVersion?: string;
}

interface SunmiPrintResult {
  deliveryState: "printed";
  jobId: string;
  replayed: boolean;
}

interface SunmiPrinterPlugin {
  getInfo(): Promise<SunmiPrinterInfo>;
  printEscpos(input: {
    jobId: string;
    escposBase64: string;
    expectedDeviceCode: string;
  }): Promise<SunmiPrintResult>;
}

interface SunmiPrintTarget {
  agent_id?: string | null;
  device_code?: string | null;
  interface_value?: string | null;
  print_mode?: string | null;
  connect_type?: string | null;
}

let plugin: SunmiPrinterPlugin | null = null;
let printerQueue: Promise<void> = Promise.resolve();

function text(value: unknown) {
  return String(value ?? "").trim();
}

function failure(message: string, statusCode: number, deliveryState: "not_sent" | "unknown" = "not_sent") {
  return Object.assign(new ServiceError(message, statusCode), { delivery_state: deliveryState });
}

export function isSunmiBuiltinPrinterTarget(target: SunmiPrintTarget | null | undefined) {
  return Boolean(target && (
    text(target.connect_type).toLowerCase() === "sunmi" ||
    text(target.print_mode).toLowerCase() === SUNMI_PRINT_MODE ||
    text(target.interface_value).toLowerCase().startsWith("sunmi:") ||
    text(target.agent_id) === SUNMI_PRINTER_AGENT_ID
  ));
}

function hasNativePlugin() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform?.() === "android" &&
    Capacitor.isPluginAvailable?.("SunmiPrinter") === true;
}

async function nativePlugin() {
  if (!hasNativePlugin()) throw failure("Install the SUNMI-enabled Android app to use its built-in printer.", 501);
  if (!plugin) {
    const { registerPlugin } = await import("@capacitor/core");
    plugin = registerPlugin<SunmiPrinterPlugin>("SunmiPrinter");
  }
  return plugin;
}

export async function getSunmiBuiltinPrinterIdentity(readyOnly = false): Promise<AgentInfo | null> {
  if (!hasNativePlugin()) return null;
  const info = await (await nativePlugin()).getInfo().catch((error: unknown) => {
    throw failure(error instanceof Error ? error.message : "SUNMI printer availability could not be read.", 503);
  });
  if (!info.supported || (readyOnly && (!info.connected || !info.ready))) return null;
  const { getBrowserPrinterIdentity } = await import("@/services/printer/browser-device");
  const device = await getBrowserPrinterIdentity();
  if (!info.deviceCode || !info.deviceCode.includes("-native-") || info.deviceCode !== device.device_code ||
    info.interfaceValue !== SUNMI_PRINTER_INTERFACE) {
    throw failure("The built-in printer identity does not match this SUNMI device.", 409);
  }
  return {
    agent_id: SUNMI_PRINTER_AGENT_ID,
    agent_name: text(info.model) ? `${text(info.model)} built-in printer` : "SUNMI built-in printer",
    device_code: info.deviceCode,
    platform: "sunmi",
    print_mode: SUNMI_PRINT_MODE,
    supports_sunmi_builtin: true,
    sunmi_ready: info.connected && info.ready,
    sunmi_state_code: info.stateCode,
    ...(info.paperWidthMm === 58 || info.paperWidthMm === 80 ? { paper_width_mm: info.paperWidthMm } : {}),
  };
}

export function sunmiDiagnosticJobId(kind: "test" | "self-test" | "drawer") {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${kind}:${id}`;
}

export function sunmiJobId(job: PrintJob) {
  const id = text(job.print_job_item_uuid) || text(job.job_id) || text(job.meta?.print_job_uuid);
  if (!id) throw failure("SUNMI print job is missing its durable job identity.", 400);
  return `${id}:${text(job.print_config_uuid) || "builtin"}`;
}

function nativeFailure(error: unknown) {
  const record = error && typeof error === "object" ? error as Record<string, unknown> : null;
  const data = record?.data && typeof record.data === "object" ? record.data as Record<string, unknown> : null;
  const state = data?.delivery_state ?? record?.delivery_state;
  const code = text(record?.code);
  const definitelyNotSent = state === "not_sent" || (state !== "unknown" && code === "SUNMI_NOT_SENT");
  const result = failure(error instanceof Error ? error.message : "The SUNMI print result could not be confirmed.", 503,
    definitelyNotSent ? "not_sent" : "unknown");
  return Object.assign(result, { ...(code ? { code } : {}), cause: error });
}

export function printSunmiEscpos(input: {
  target: SunmiPrintTarget;
  escposBase64: string;
  jobId: string;
}): Promise<void> {
  const isCurrentSession = createSessionGuard();
  const request = { ...input, target: { ...input.target } };
  const task = printerQueue.then(async () => {
    if (!isCurrentSession()) throw failure("The printer session changed before this job was sent.", 409);
    if (text(request.target.agent_id) !== SUNMI_PRINTER_AGENT_ID ||
      text(request.target.print_mode) !== SUNMI_PRINT_MODE ||
      text(request.target.interface_value) !== SUNMI_PRINTER_INTERFACE || !text(request.target.device_code)) {
      throw failure("Invalid built-in SUNMI printer destination.", 409);
    }
    if (!text(request.jobId) || !text(request.escposBase64)) throw failure("SUNMI print data or job identity is missing.", 400);
    const bridge = await nativePlugin();
    const { getBrowserPrinterIdentity } = await import("@/services/printer/browser-device");
    const local = await getBrowserPrinterIdentity().catch((error: unknown) => {
      throw failure(error instanceof Error ? error.message : "SUNMI device identity could not be read.", 503);
    });
    if (!local.device_code.includes("-native-") || local.device_code !== text(request.target.device_code)) {
      throw failure("This print job belongs to another SUNMI device.", 409);
    }
    if (!isCurrentSession()) throw failure("The printer session changed before this job was sent.", 409);
    try {
      // The native journal must get the first look at this job. A receipt
      // already confirmed on paper remains confirmed after paper runs out or
      // the service disconnects; getInfo().ready cannot establish that fact.
      const result = await bridge.printEscpos({
        jobId: request.jobId,
        escposBase64: request.escposBase64,
        expectedDeviceCode: text(local.device_code),
      });
      if (result.deliveryState !== "printed" || result.jobId !== request.jobId) {
        throw failure("The SUNMI print completion could not be confirmed.", 503, "unknown");
      }
    } catch (error) {
      // A rejected/expired bridge call may already own paper. Never switch to
      // TCP, another printer or a second physical request after dispatch.
      throw nativeFailure(error);
    }
  });
  printerQueue = task.catch(() => undefined);
  return task;
}
