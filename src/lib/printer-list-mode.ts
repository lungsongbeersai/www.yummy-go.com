import type { Printer } from "@/services/printer";

export function printerListScopeKey(loginUuid: string, deviceCode: string, scopeKey: string) {
  return JSON.stringify([loginUuid, deviceCode, scopeKey]);
}

/** Access-mode classification shared by presentation and its read-only checks. */
export function isLanSharedPrinter(printer: Printer): boolean {
  const mode = String(printer.access_mode || "").trim().toUpperCase();
  if (mode === "INTERNET" || mode === "DIRECT") return false;
  if (mode === "LAN") return true;
  return printer.is_shared === true || String(printer.sharing_mode || "").trim().toUpperCase() === "SHARED";
}
