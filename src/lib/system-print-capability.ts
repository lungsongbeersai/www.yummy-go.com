export function canUseSystemPrintFallback(
  electronApi: Pick<ElectronAPI, "getDisplays"> | undefined =
    typeof window === "undefined" ? undefined : window.electronAPI,
  browserAvailable = typeof window !== "undefined",
) {
  // Installed/idle status is not a reliable connectivity signal on Windows or
  // macOS. Desktop printing stays owned by Printer Agent and fails closed
  // instead of opening a surprise OS dialog after a transaction. A normal web
  // browser retains its explicit print-dialog fallback.
  return browserAvailable && !electronApi;
}
