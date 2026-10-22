import { ServiceError } from "@/lib/api";
import type { PrinterSelfTestCommandProfile } from "@/services/printer/types";

export function printerSelfTestCommandProfile(value: unknown): PrinterSelfTestCommandProfile {
  if (value === undefined) return "epson";
  if (value === "epson" || value === "xprinter" || value === "rongta") return value;
  throw Object.assign(new ServiceError("Select a supported printer self-test command.", 400), {
    delivery_state: "not_sent" as const,
  });
}

export function printerSelfTestCommandBase64(value: unknown) {
  // Fixed manufacturer commands only. Never accept raw bytes from the UI.
  // Xprinter official POSPrinterTest: 1F 1B 1F 67 00;
  // Rongta DC2 T: 12 54;
  // Epson GS ( A: 1D 28 41 02 00 00 02.
  const commands: Record<PrinterSelfTestCommandProfile, string> = {
    epson: "HShBAgAAAg==",
    xprinter: "HxsfZwA=",
    rongta: "ElQ=",
  };
  return commands[printerSelfTestCommandProfile(value)];
}
