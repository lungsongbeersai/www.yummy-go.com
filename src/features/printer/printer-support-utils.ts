import type { PrinterSupportCommand, PrinterSupportResult } from "@/services/printer";

export function printerSupportPending(command: PrinterSupportCommand | null) {
  return command?.status === "queued" || command?.status === "running";
}

export function normalizeVerifiedPrinterMac(value: string): string | null {
  const compact = value.trim().replace(/[:-]/g, "").toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(compact) || /^0{12}$/.test(compact) || /^F{12}$/.test(compact) || (parseInt(compact.slice(0, 2), 16) & 1) !== 0) return null;
  return compact.match(/.{2}/g)?.join("-") ?? null;
}

export function freshPrinterSupportDiagnosis(commands: PrinterSupportCommand[], now: number) {
  const mutationBarrier = commands.filter((command) => command.action !== "diagnose").reduce((latest, command) => {
    const started = Date.parse(command.created_at);
    const finished = command.finished_at ? Date.parse(command.finished_at) : started;
    return Math.max(latest, Number.isFinite(started) && Number.isFinite(finished) ? Math.max(started, finished) : Infinity);
  }, -Infinity);
  return [...commands].filter((command) => {
    const checkedAt = Date.parse(command.result?.checked_at ?? "");
    return command.action === "diagnose" && command.status === "succeeded" && command.result &&
      Date.parse(command.created_at) > mutationBarrier && checkedAt >= mutationBarrier &&
      Number.isFinite(checkedAt) && now >= checkedAt && now - checkedAt <= 300000;
  }).sort((a, b) => Date.parse(b.result?.checked_at ?? "") - Date.parse(a.result?.checked_at ?? ""))[0] ?? null;
}

export function printerSupportProblemKey(code: string | null | undefined) {
  if (!code) return null;
  if (/PRINTER_SUPPORT_SETUP_REQUIRED/i.test(code)) return "printer.support.setupRequired";
  if (/ADMIN_REQUIRED/i.test(code)) return "printer.support.adminRequired";
  if (/UNSUPPORTED|PROTOCOL/i.test(code)) return "printer.support.unsupported";
  if (/STALE|MISMATCH|CONFLICT|NEIGHBOR_CHANGED|TARGET_CHANGED|DIAGNOSIS_REQUIRED|NETWORK_(?:AMBIGUOUS|REQUIRED)/i.test(code)) return "printer.support.recheckRequired";
  if (/PIN_NOT_OWNED/i.test(code)) return "printer.support.pinNotOwned";
  if (/OWNER_REQUIRED/i.test(code)) return "printer.support.ownerRequired";
  if (/DENIED|FORBIDDEN/i.test(code)) return "printer.support.permissionDenied";
  if (/UNKNOWN|UNCERTAIN|ROLLBACK_FAILED/i.test(code)) return "printer.support.uncertain";
  return null;
}

export function printerSupportChangeKey(command: PrinterSupportCommand | null) {
  if (command?.status === "unknown" || /UNKNOWN|UNCERTAIN|ROLLBACK_FAILED/i.test(command?.error_code ?? "") ||
      /UNKNOWN|UNCERTAIN|ROLLBACK_FAILED/i.test(command?.result?.code ?? "")) return "printer.support.changeUnconfirmed";
  return command?.result?.changed ? "printer.support.changed" : "printer.support.unchanged";
}

export function printerSupportTransportReady(command: PrinterSupportCommand | null) {
  return Boolean(command?.status === "succeeded" && command.result?.tcp?.state === "open" &&
    ["NETWORK_DIAGNOSED", "NEIGHBOR_REFRESHED", "NEIGHBOR_PINNED", "NEIGHBOR_PIN_REMOVED", "NEIGHBOR_ALREADY_PINNED"].includes(command.result.code) &&
    !printerSupportProblemKey(command.error_code) && !printerSupportProblemKey(command.result?.code));
}

export function printerSupportRepairAvailable(result: PrinterSupportResult | null | undefined) {
  return Boolean(result?.platform === "win32" && result.admin === true &&
    Number.isSafeInteger(result.network?.interface_index) && Number(result.network?.interface_index) > 0);
}
