import type { ApiEntity } from "@/services/shared/types";

export const BROWSER_MOBILE_AGENT_ID = "mobile";
export const BROWSER_DESKTOP_AGENT_ID = "desktop";
export const BROWSER_PRINTER_AGENT_ID = BROWSER_MOBILE_AGENT_ID;
export const BROWSER_PRINTER_AGENT_URL = "http://127.0.0.1:7777";
export const BROWSER_DEVICE_CODE_KEY = "yummy_browser_device_code";

export interface BrowserPrinterIdentity extends ApiEntity {
  agent_id: string;
  agent_name: string;
  device_code: string;
  platform: string;
}

interface BrowserUserAgentData {
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<{
    model?: string;
    platform?: string;
  }>;
}

interface BrowserNavigator {
  userAgent?: string;
  maxTouchPoints?: number;
  userAgentData?: BrowserUserAgentData;
}

let memoryDeviceCode = "";

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

function fallbackUuid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createBrowserDeviceCode() {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : fallbackUuid();

  return uuid;
}

function storage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function currentNavigator(): BrowserNavigator | null {
  return typeof navigator === "undefined" ? null : navigator;
}

function currentUserAgent() {
  return currentNavigator()?.userAgent ?? "";
}

function slugValue(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "device"
  );
}

function isIpadLike(userAgent: string) {
  const touchMac =
    typeof navigator !== "undefined" &&
    /Macintosh/i.test(userAgent) &&
    navigator.maxTouchPoints > 1;

  return /iPad/i.test(userAgent) || touchMac;
}

function fallbackDeviceName(userAgent: string, platform = "", mobile?: boolean) {
  const source = `${platform} ${userAgent}`;

  if (/Android/i.test(source)) return mobile === false ? "Android Device" : "Android Phone";
  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (isIpadLike(userAgent)) return "iPad";
  if (/Windows/i.test(source)) return "Windows Laptop";
  if (/Macintosh|Mac OS X|macOS/i.test(source)) return "Mac Laptop";
  if (/Linux/i.test(source)) return "Linux Device";
  return "Device";
}

function browserAgentId(userAgent: string, platform = "", mobile = false) {
  const source = `${platform} ${userAgent}`;
  if (mobile || /Android|iPhone|iPad/i.test(source) || isIpadLike(userAgent)) {
    return BROWSER_MOBILE_AGENT_ID;
  }

  return BROWSER_DESKTOP_AGENT_ID;
}

async function getDeviceHints() {
  const userAgentData = currentNavigator()?.userAgentData;

  if (!userAgentData?.getHighEntropyValues) {
    return {
      mobile: userAgentData?.mobile ?? false,
      platform: userAgentData?.platform ?? "",
      model: ""
    };
  }

  try {
    const highEntropy = await userAgentData.getHighEntropyValues(["model", "platform"]);
    return {
      mobile: userAgentData.mobile ?? false,
      platform: textValue(highEntropy.platform) || textValue(userAgentData.platform),
      model: textValue(highEntropy.model)
    };
  } catch {
    return {
      mobile: userAgentData.mobile ?? false,
      platform: textValue(userAgentData.platform),
      model: ""
    };
  }
}

export function isBrowserPrinterAgentId(agentId: unknown) {
  const value = textValue(agentId);
  return value === BROWSER_MOBILE_AGENT_ID || value === BROWSER_DESKTOP_AGENT_ID;
}

export function getBrowserAgentName(
  userAgent = currentUserAgent(),
  hints: { model?: string; platform?: string; mobile?: boolean } = {}
) {
  const model = textValue(hints.model);
  if (model) return model;

  return fallbackDeviceName(userAgent, hints.platform, hints.mobile);
}

export function getBrowserDeviceCode(deviceName = getBrowserAgentName()) {
  const local = storage();
  const saved = textValue(local?.getItem(BROWSER_DEVICE_CODE_KEY));
  if (saved) return saved;

  if (!local && memoryDeviceCode) return memoryDeviceCode;

  const code = `${slugValue(deviceName)}-web-${createBrowserDeviceCode()}`;
  memoryDeviceCode = code;
  local?.setItem(BROWSER_DEVICE_CODE_KEY, code);
  return code;
}

export async function getBrowserPrinterIdentity(): Promise<BrowserPrinterIdentity> {
  const userAgent = currentUserAgent();
  const hints = await getDeviceHints();
  const agentName = getBrowserAgentName(userAgent, hints);

  return {
    agent_id: browserAgentId(userAgent, hints.platform, hints.mobile),
    agent_name: agentName,
    device_code: getBrowserDeviceCode(agentName),
    platform: "browser"
  };
}
