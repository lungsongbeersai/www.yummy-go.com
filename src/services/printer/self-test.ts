import axios from "axios";
import { AGENT_URL } from "@/config/printer-agent";
import { ServiceError } from "@/lib/api";
import { isCapacitorMobileApp } from "@/lib/capacitor-platform";
import { getLocalAgentInfo } from "@/services/printer/agent-transport";
import {
  AGENT_SECRET,
  agentBase,
  getPrinterDeliveryState,
  textValue,
} from "@/services/printer/helpers";
import {
  completeMobilePrinterSelfTest,
  printMobilePrinterSelfTestOverTcp,
} from "@/services/printer/mobile-tcp";
import { printerSelfTestCommandProfile } from "@/services/printer/self-test-profile";
import type {
  AgentInfo,
  PrinterSelfTestInput,
  PrinterSelfTestCompletionResult,
  PrinterSelfTestResult,
  PrinterSelfTestStatusResult,
} from "@/services/printer/types";

function notSentError(message: string, statusCode: number) {
  return Object.assign(new ServiceError(message, statusCode), {
    delivery_state: "not_sent" as const,
  });
}

function validTcpHost(host: string) {
  if (/^[\d.]+$/.test(host)) {
    const octets = host.split(".");
    return octets.length === 4 && octets.every(
      (octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255,
    );
  }

  const hostname = host.replace(/\.$/, "");
  return hostname.length <= 253 && hostname.split(".").every(
    (label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label),
  );
}

function selfTestInterface(input: PrinterSelfTestInput) {
  const value = textValue(input.interface_value);
  if (input.connect_type === "tcp") {
    const match = value.match(/^tcp:\/\/([^:/\s]+):(\d+)$/i);
    const port = Number(match?.[2]);
    if (
      !match || !validTcpHost(match[1]) ||
      !Number.isInteger(port) || port < 1 || port > 65535
    ) {
      throw notSentError("Enter a valid TCP printer host and port (1–65535).", 400);
    }
    return `tcp://${match[1]}:${port}`;
  }

  if (
    input.connect_type !== "usb" ||
    !/^(?:cups|win):[^\x00-\x1f\x7f]+$/.test(value) ||
    !value.slice(value.indexOf(":") + 1).trim()
  ) {
    throw notSentError("Select a USB printer from the Local Printer Agent.", 400);
  }
  return value;
}

function errorStatus(error: unknown) {
  if (!error || typeof error !== "object") return 0;
  const response = "response" in error ? error.response : null;
  return response && typeof response === "object" && "status" in response
    ? Number(response.status) || 0
    : "statusCode" in error ? Number(error.statusCode) || 0 : 0;
}

function isSelfTestInProgress(error: unknown) {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "PRINTER_SELF_TEST_IN_PROGRESS") return true;
  const response = "response" in error ? error.response : null;
  const data = response && typeof response === "object" && "data" in response
    ? response.data
    : null;
  return Boolean(data && typeof data === "object" && "code" in data && data.code === "PRINTER_SELF_TEST_IN_PROGRESS");
}

function selfTestOperationId(value: unknown) {
  return typeof value === "string" && /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value) ? value : undefined;
}

function selfTestErrorOperationId(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const response = "response" in error ? error.response : null;
  const data = response && typeof response === "object" && "data" in response ? response.data : error;
  return data && typeof data === "object" && "self_test_id" in data ? selfTestOperationId(data.self_test_id) : undefined;
}

function selfTestError(error: unknown, beforeDispatch = false) {
  const status = errorStatus(error);
  const operationId = beforeDispatch ? undefined : selfTestErrorOperationId(error);
  let message = "Unable to confirm whether the self-test command was sent. Check the printer before trying again.";
  if (status === 404) {
    message = "Update Local Printer Agent to use printer self-test.";
  } else if (status === 409) {
    message = "Local Printer Agent is busy or its identity changed. Check the connection and try again.";
  } else if (status === 401 || status === 403) {
    message = "Local Printer Agent authorization failed.";
  } else if (status === 400) {
    message = "Printer self-test request was rejected. Check the printer connection.";
  }
  return Object.assign(new ServiceError(message, status || 503), {
    ...(isSelfTestInProgress(error) ? { code: "PRINTER_SELF_TEST_IN_PROGRESS" as const } : {}),
    ...(operationId ? { self_test_id: operationId, readiness: "manual_required" as const } : {}),
    delivery_state: beforeDispatch || [400, 401, 403, 404, 409, 501].includes(status)
      ? "not_sent"
      : getPrinterDeliveryState(error),
  });
}

async function localSelfTestRequest(
  input: PrinterSelfTestInput,
  interfaceValue: string,
  action: "start" | "complete" | "status",
) {
  const complete = action === "complete";
  // Resolve the live local identity every time. Saved printer ownership and
  // cached identities must never relay a USB command to another terminal.
  let agent: AgentInfo;
  try {
    agent = await getLocalAgentInfo();
  } catch (error) {
    throw selfTestError(error, true);
  }
  const agentId = textValue(agent.agent_id);
  const deviceCode = textValue(agent.device_code);
  if (!agentId || !deviceCode) {
    throw notSentError("Local Printer Agent identity missing. Reconnect the Local Printer Agent.", 409);
  }
  if (
    (textValue(input.expected_agent_id) && textValue(input.expected_agent_id) !== agentId) ||
    (textValue(input.expected_device_code) && textValue(input.expected_device_code) !== deviceCode)
  ) {
    throw notSentError("Local Printer Agent identity changed. Refresh the printer list before running self-test.", 409);
  }

  const manufacturerProfile = input.command_profile && input.command_profile !== "epson" ? input.command_profile : null;
  if (action === "start" && manufacturerProfile && (
    !Array.isArray(agent.self_test_profiles) || !agent.self_test_profiles.includes(manufacturerProfile)
  )) {
    throw notSentError("Update Local Printer Agent to use this manufacturer's self-test command.", 501);
  }
  if (action === "status" && agent.supports_self_test_status !== true) {
    return { ok: true, readiness: "manual_required" } satisfies PrinterSelfTestStatusResult;
  }

  try {
    const { data } = await axios.post<unknown>(
      `${agentBase(AGENT_URL)}/printer/self-test${action === "start" ? "" : `/${action}`}`,
      {
        agent_id: agentId,
        device_code: deviceCode,
        interface_value: interfaceValue,
        ...(action === "start" && input.command_profile ? { command_profile: input.command_profile } : {}),
        ...(action !== "start" && input.self_test_id ? { self_test_id: input.self_test_id } : {}),
        ...(complete && agent.supports_self_test_status === true ? { require_self_test_id: true } : {}),
      },
      { headers: { "x-agent-secret": AGENT_SECRET }, timeout: action === "status" ? 10000 : 45000 },
    );
    if (
      !data || typeof data !== "object" ||
      !("ok" in data) || data.ok !== true ||
      (action !== "status" && (!("status" in data) || data.status !== (complete ? "ready" : "command_sent")))
    ) {
      throw new Error("Unexpected printer self-test response");
    }
    if (action === "start" && manufacturerProfile) {
      const result = "result" in data ? data.result : null;
      if (!result || typeof result !== "object" || !("command_profile" in result) || result.command_profile !== manufacturerProfile) {
        // The Agent may have changed after the capability read. The command
        // could already be sent, so keep maintenance and never try a fallback.
        throw new Error("Unable to confirm the selected printer self-test command");
      }
    }
    if (action === "status" || (action === "start" && agent.supports_self_test_status === true)) {
      return selfTestReadiness(data, action === "status" ? input.self_test_id : undefined);
    }
    return null;
  } catch (error) {
    throw selfTestError(error);
  }
}

function selfTestReadiness(data: object, expectedId?: string): PrinterSelfTestStatusResult {
  const readiness = "readiness" in data ? data.readiness : undefined;
  const id = "self_test_id" in data && typeof data.self_test_id === "string" ? data.self_test_id : "";
  const validId = Boolean(selfTestOperationId(id));
  if (readiness === "manual_required") return { ok: true, readiness: "manual_required", ...(validId ? { self_test_id: id } : {}) };
  if ((readiness !== "pending" && readiness !== "ready") || !validId || (expectedId && expectedId !== id)) {
    throw new Error("Unable to confirm this printer self-test operation");
  }
  return { ok: true, readiness, self_test_id: id };
}

export async function printPrinterSelfTest(
  input: PrinterSelfTestInput,
): Promise<PrinterSelfTestResult> {
  const commandProfile = printerSelfTestCommandProfile(input.command_profile);
  const interfaceValue = selfTestInterface(input);
  if (isCapacitorMobileApp()) {
    if (input.connect_type === "usb") {
      throw notSentError("Printer self-test in the mobile app requires Wi-Fi/LAN.", 501);
    }
    try {
      if (input.command_profile === undefined) await printMobilePrinterSelfTestOverTcp(interfaceValue);
      else await printMobilePrinterSelfTestOverTcp(interfaceValue, commandProfile);
    } catch (error) {
      throw selfTestError(error);
    }
  } else {
    const readiness = await localSelfTestRequest(input, interfaceValue, "start");
    return { ok: true, status: "command_sent", ...(readiness ? { readiness: readiness.readiness, ...(readiness.self_test_id ? { self_test_id: readiness.self_test_id } : {}) } : {}) };
  }
  return { ok: true, status: "command_sent" };
}

export async function completePrinterSelfTest(
  input: PrinterSelfTestInput,
): Promise<PrinterSelfTestCompletionResult> {
  const interfaceValue = selfTestInterface(input);
  if (isCapacitorMobileApp()) {
    if (input.connect_type === "usb") {
      throw notSentError("Printer self-test in the mobile app requires Wi-Fi/LAN.", 501);
    }
    try {
      completeMobilePrinterSelfTest(interfaceValue);
    } catch (error) {
      throw selfTestError(error);
    }
  } else {
    await localSelfTestRequest(input, interfaceValue, "complete");
  }
  return { ok: true, status: "ready" };
}

export async function getPrinterSelfTestStatus(input: PrinterSelfTestInput): Promise<PrinterSelfTestStatusResult> {
  const interfaceValue = selfTestInterface(input);
  if (isCapacitorMobileApp() || !input.self_test_id) return { ok: true, readiness: "manual_required" };
  return await localSelfTestRequest(input, interfaceValue, "status") ?? { ok: true, readiness: "manual_required" };
}
