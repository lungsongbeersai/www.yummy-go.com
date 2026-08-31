export function printerPrintModeForPlatform(
  platform: unknown,
  native = false,
) {
  if (native) return "mobile_wifi";

  const value = String(platform ?? "").trim().toLowerCase();
  if (value.includes("darwin") || value.includes("mac")) return "mac_agent";
  if (value.includes("win")) return "windows_agent";
  if (value.includes("android") || value.includes("ios")) return "mobile_wifi";

  return undefined;
}
