// Local printer-agent identity cache + transport (P3.4 split of printer.ts):
// checking/connecting to the agent, dispatching a single job or a batch to it,
// and rendering/sending native mobile jobs over physical TCP. Depends on
// config-api.ts (getPrinters, renderMobileEscpos) — not vice versa.
import axios from "axios";
import { Capacitor } from "@capacitor/core";
import { ServiceError } from "@/lib/api";
import { AGENT_URL } from "@/config/printer-agent";
import {
  AGENT_SECRET,
  agentBase as printerAgentBase,
  assertAgentOk,
  printerRequestTimeoutMs,
  getPrinterErrorMessage,
  textValue
} from "@/services/printer/helpers";
import { getBrowserPrinterIdentity, isBrowserPrinterAgentId } from "@/services/printer/browser-device";
import { getPrinters, renderMobileEscpos } from "@/services/printer/config-api";
import { printMobileEscposOverTcp } from "@/services/printer/mobile-tcp";
import type {
  AgentInfo,
  AgentInfoResponse,
  CheckPrinterAgentConnectionResult,
  PrintJob,
  PrintOpsAgentResponse,
  PrintOpsBatchAgentResponse,
  PrinterDeviceContext,
  PrinterDeviceContextParams
} from "@/services/printer/types";

const PRINTER_IDENTITY_MISSING = "Printer device identity missing";
const LOCAL_AGENT_IDENTITY_KEY = "yummy_local_printer_agent_identity";
const MAX_AGENT_JOBS_PER_BATCH = 10;

function localAgentStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readCachedLocalAgentInfo(): AgentInfo | null {
  const raw = textValue(localAgentStorage()?.getItem(LOCAL_AGENT_IDENTITY_KEY));
  if (!raw) return null;

  try {
    const record = JSON.parse(raw) as Partial<AgentInfo>;
    const agentId = textValue(record.agent_id);
    const deviceCode = textValue(record.device_code);
    if (!agentId || !deviceCode) return null;

    return {
      ...record,
      agent_id: agentId,
      agent_name: textValue(record.agent_name) || agentId,
      device_code: deviceCode,
      platform: textValue(record.platform)
    };
  } catch {
    return null;
  }
}

function saveCachedLocalAgentInfo(agent: AgentInfo) {
  const agentId = textValue(agent.agent_id);
  const deviceCode = textValue(agent.device_code);
  if (!agentId || !deviceCode) return;

  localAgentStorage()?.setItem(
    LOCAL_AGENT_IDENTITY_KEY,
    JSON.stringify({
      agent_id: agentId,
      agent_name: textValue(agent.agent_name) || agentId,
      device_code: deviceCode,
      platform: textValue(agent.platform) || undefined
    })
  );
}

function getAgentFromPayload(payload: AgentInfoResponse | AgentInfo | null | undefined): AgentInfo | null {
  const maybe = payload as AgentInfoResponse | null | undefined;
  const agent = maybe?.data ?? maybe?.agent ?? payload;
  if (!agent || typeof agent !== "object") return null;
  const record = agent as AgentInfo;
  const agentId = textValue(record.agent_id);
  if (!agentId) return null;
  return {
    ...record,
    agent_id: agentId,
    agent_name: textValue(record.agent_name) || agentId,
    device_code: textValue(record.device_code) || undefined,
    platform: textValue(record.platform)
  };
}

export async function getLocalAgentInfo(agentUrl = AGENT_URL) {
  const { data } = await axios.get<AgentInfoResponse | AgentInfo>(`${printerAgentBase(AGENT_URL, agentUrl)}/agent/info`, {
    headers: { "x-agent-secret": AGENT_SECRET },
    timeout: 5000
  });
  assertAgentOk(data as AgentInfoResponse, "Printer agent not ready");

  const agent = getAgentFromPayload(data);
  if (!agent) throw new ServiceError("Local printer agent identity missing", 500);
  const cached = readCachedLocalAgentInfo();
  const merged = {
    ...agent,
    device_code: textValue(agent.device_code) || textValue(cached?.device_code) || undefined
  };
  saveCachedLocalAgentInfo(merged);
  return merged;
}

export async function getLocalPrinterAgentInfo(agentUrl = AGENT_URL) {
  try {
    return await getLocalAgentInfo(agentUrl);
  } catch (error) {
    const cached = readCachedLocalAgentInfo();
    if (cached) return cached;
    throw error;
  }
}

export function printJobAgentBase(job: PrintJob | null | undefined) {
  return printerAgentBase(AGENT_URL, textValue(job?.agent_url) || undefined);
}

export function isPrintJobForAgent(job: PrintJob | null | undefined, agent: AgentInfo) {
  const jobAgentId = textValue(job?.agent_id);
  const localAgentId = textValue(agent.agent_id);
  if (!jobAgentId || !localAgentId || jobAgentId !== localAgentId) return false;

  const jobDeviceCode = textValue(job?.device_code);
  const localDeviceCode = textValue(agent.device_code);
  if (localDeviceCode && (!jobDeviceCode || jobDeviceCode !== localDeviceCode)) return false;

  return true;
}

export function assertPrintJobForAgent(job: PrintJob, agent: AgentInfo) {
  if (!textValue(job.agent_id)) {
    throw new ServiceError("Print job missing agent_id", 409);
  }
  if (!isPrintJobForAgent(job, agent)) {
    throw new ServiceError("Print job belongs to another agent", 409);
  }
}

export function isBrowserDevicePrintJob(job: PrintJob | null | undefined) {
  return isBrowserPrinterAgentId(job?.agent_id) && textValue(job?.device_code).includes("-web-");
}

export async function checkPrinterAgentConnection(agentUrl = AGENT_URL): Promise<CheckPrinterAgentConnectionResult> {
  try {
    const { data } = await axios.get<AgentInfoResponse | AgentInfo>(`${printerAgentBase(AGENT_URL, agentUrl)}/agent/info`, {
      headers: { "x-agent-secret": AGENT_SECRET },
      timeout: 5000
    });
    assertAgentOk(data as AgentInfoResponse, "Printer agent not ready");

    const agent = getAgentFromPayload(data);
    if (!agent) throw new ServiceError("Local printer agent identity missing", 500);
    return { ok: true, agent };
  } catch (error) {
    return { ok: false, error: getPrinterErrorMessage(error) };
  }
}

function hasPrinterDeviceIdentity(agent: AgentInfo | null | undefined) {
  return Boolean(textValue(agent?.agent_id) && textValue(agent?.device_code));
}

export async function resolvePrinterDeviceIdentity(agentUrl = AGENT_URL): Promise<CheckPrinterAgentConnectionResult> {
  try {
    const result = await checkPrinterAgentConnection(agentUrl);
    if (!result.ok) {
      return { ok: true, agent: await getBrowserPrinterIdentity() };
    }
    if (!hasPrinterDeviceIdentity(result.agent)) {
      return { ok: false, error: PRINTER_IDENTITY_MISSING };
    }

    return result;
  } catch (error) {
    return { ok: false, error: getPrinterErrorMessage(error) };
  }
}

export async function printWithLocalAgent(job: PrintJob, localAgent?: AgentInfo) {
  const localBase = printerAgentBase(AGENT_URL);
  const agent = localAgent ?? await getLocalAgentInfo(localBase);
  const isLocalJob = isPrintJobForAgent(job, agent);
  const jobDeviceCode = textValue(job.device_code);
  const localDeviceCode = textValue(agent.device_code);
  if (!textValue(job.agent_id) || !jobDeviceCode) {
    throw new ServiceError("Print job missing agent identity", 409);
  }
  if (!isLocalJob && localDeviceCode && jobDeviceCode === localDeviceCode) {
    throw new ServiceError("Print job belongs to another agent", 409);
  }
  const endpoint = isLocalJob
    ? "/print-ops"
    : "/print-ops-relay";

  const { data } = await axios.post<PrintOpsAgentResponse>(`${localBase}${endpoint}`, job, {
    headers: { "x-agent-secret": AGENT_SECRET },
    timeout: printerRequestTimeoutMs([job])
  });
  assertAgentOk(data, "Print failed");
}

export async function printBatchWithLocalAgent(
  jobs: PrintJob[],
  localAgent?: AgentInfo,
  cutMode: string = "per_ticket"
) {
  if (!jobs.length) return;

  const localBase = printerAgentBase(AGENT_URL);
  const agent = localAgent ?? await getLocalAgentInfo(localBase);
  if (jobs.some((job) => !textValue(job.agent_id) || !textValue(job.device_code))) {
    throw new ServiceError("Print job missing agent identity", 409);
  }
  const localJobs = jobs.filter((job) => isPrintJobForAgent(job, agent));
  if (localJobs.length > 0 && localJobs.length !== jobs.length) {
    throw new ServiceError("Print batch contains local and shared printers", 400);
  }
  const localDeviceCode = textValue(agent.device_code);
  if (
    localJobs.length === 0 &&
    localDeviceCode &&
    jobs.some((job) => textValue(job.device_code) === localDeviceCode)
  ) {
    throw new ServiceError("Print job belongs to another agent", 409);
  }
  const endpoint = localJobs.length === jobs.length
    ? "/print-ops-batch"
    : "/print-ops-batch-relay";

  // Agent จำกัดหนึ่ง physical batch ไว้ 10 ใบเพื่อคุมหน่วยความจำของ raster
  // ส่งก้อนย่อยตามลำดับบนเครื่องเดียวกัน แทนการปล่อยให้ทั้งครัว/บาร์ถูกปฏิเสธ
  // เมื่อออเดอร์หนึ่งมีรายการเกินขีดจำกัด
  for (let offset = 0; offset < jobs.length; offset += MAX_AGENT_JOBS_PER_BATCH) {
    const batchJobs = jobs.slice(offset, offset + MAX_AGENT_JOBS_PER_BATCH);
    const payload = { cut_mode: cutMode, jobs: batchJobs };
    const { data } = await axios.post<PrintOpsBatchAgentResponse>(`${localBase}${endpoint}`, payload, {
      headers: { "x-agent-secret": AGENT_SECRET },
      timeout: printerRequestTimeoutMs(batchJobs)
    });
    assertAgentOk(data, "Print failed");
  }
}

export async function dispatchPrintJob(
  job: PrintJob,
  localAgent?: AgentInfo,
) {
  if (isBrowserDevicePrintJob(job)) {
    if (!Capacitor.isNativePlatform()) {
      throw new ServiceError(
        "Physical printing requires the mobile app or a running Printer Agent",
        501,
      );
    }
    const interfaceValue = textValue(job.interface_value);
    if (!interfaceValue) {
      throw new ServiceError("Mobile printer interface_value missing", 400);
    }
    let escposBase64: string;
    try {
      escposBase64 = await renderMobileEscpos(job);
    } catch (error) {
      // Rendering happens before any bytes are written to the printer. Preserve
      // that fact so a safe retry cannot be mistaken for an uncertain delivery.
      if (error && typeof error === "object") {
        (error as { delivery_state?: string }).delivery_state = "not_sent";
        throw error;
      }
      const wrapped = new ServiceError(getPrinterErrorMessage(error), 500);
      (wrapped as ServiceError & { delivery_state?: string }).delivery_state = "not_sent";
      throw wrapped;
    }
    await printMobileEscposOverTcp({
      interface_value: interfaceValue,
      escpos_base64: escposBase64,
      require_completion_confirmation: true,
    });
    return;
  }

  await printWithLocalAgent(job, localAgent);
}

// Resolves the printer's device/agent identity by cross-referencing the
// configured printer list — lives here (not config-api.ts) because its job is
// device-identity resolution, matching this module's concern; it depends
// *down* into config-api.ts for getPrinters rather than the reverse.
export async function resolvePrinterDeviceContext(params: PrinterDeviceContextParams): Promise<PrinterDeviceContext> {
  const inputDeviceCode = textValue(params.device_code);
  let agent: AgentInfo | null = null;
  if (!inputDeviceCode) {
    try {
      agent = await getLocalAgentInfo();
    } catch (error) {
      agent = readCachedLocalAgentInfo();
      if (!agent) throw error;
    }
  }
  const deviceCode = inputDeviceCode || textValue(agent?.device_code);
  if (!deviceCode) throw new ServiceError("device_code required", 400);

  const printers = await getPrinters({
    login_uuid_fk: params.login_uuid_fk,
    device_code: deviceCode,
    lang: params.lang
  });
  const printer =
    printers.find((item) => params.print_config_uuid && item.print_config_uuid === params.print_config_uuid) ??
    printers.find((item) => textValue(item.agent_id) === textValue(params.agent_id)) ??
    printers.find((item) => item.is_active) ??
    printers[0];
  const resolvedDeviceCode = textValue(printer?.device_code) || textValue(params.device_code) || deviceCode;
  if (!resolvedDeviceCode) throw new ServiceError("device_code required", 400);

  return {
    device_code: resolvedDeviceCode,
    agent_id: textValue(printer?.agent_id) || textValue(params.agent_id) || undefined,
    agent_name: textValue(printer?.agent_name) || textValue(params.agent_name) || undefined,
    print_mode: textValue(printer?.print_mode) || textValue(params.print_mode) || undefined
  };
}
