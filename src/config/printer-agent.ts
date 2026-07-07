export const AGENT_URL =
  process.env.NEXT_PUBLIC_PRINTER_AGENT_URL ?? "http://127.0.0.1:7777";

export const BROWSER_MOBILE_AGENT_ID = "mobile";
export const BROWSER_DESKTOP_AGENT_ID = "desktop";
export const BROWSER_PRINTER_AGENT_ID = BROWSER_MOBILE_AGENT_ID;
export const BROWSER_PRINTER_AGENT_URL = "http://127.0.0.1:7777";
export const BROWSER_DEVICE_CODE_KEY = "yummy_browser_device_code";

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

export function isBrowserPrinterAgentId(agentId: unknown) {
  const value = textValue(agentId);
  return value === BROWSER_MOBILE_AGENT_ID || value === BROWSER_DESKTOP_AGENT_ID;
}

export function parseInterfaceValue(interfaceValue: string) {
  if (interfaceValue.startsWith("tcp://")) {
    const [ip, port] = interfaceValue.replace("tcp://", "").split(":");
    return { mode: "network" as const, ip, port: Number(port || 9100) };
  }

  return {
    mode: "usb" as const,
    systemPrinterName: interfaceValue.replace(/^cups:|^win:/, ""),
  };
}

export function tcpInterfaceValue(ip: string | undefined, port = 9100) {
  const value = String(ip ?? "").trim();
  if (!value) return "";
  if (value.startsWith("tcp://")) return value;

  const nextPort = Number.isFinite(port) && port > 0 ? port : 9100;
  return `tcp://${value}:${nextPort}`;
}
