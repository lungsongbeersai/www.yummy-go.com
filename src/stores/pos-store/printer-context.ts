import { Capacitor } from "@capacitor/core";
import { getPrinters, resolvePrinterDeviceContext, type Printer, type PrinterDeviceContextParams } from "@/services/printer";
import { usePrinterStore } from "@/stores/printer-store";
import { createSessionGuard } from "@/stores/session-store-registry";

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

function isMobilePrinterCandidate(printer: Printer) {
  const connectType = textValue(printer.connect_type).toLowerCase();
  const printMode = textValue(printer.print_mode).toLowerCase();

  return connectType === "tcp" || printMode === "mobile_wifi";
}

function pickMobilePrinterFromList(printers: Printer[]) {
  return printers.find((printer) => printer.is_active && isMobilePrinterCandidate(printer)) ??
    printers.find((printer) => isMobilePrinterCandidate(printer));
}

async function pickMobilePrinter(input: { login_uuid_fk?: string; lang?: string }) {
  const isCurrentSession = createSessionGuard();
  const printerState = usePrinterStore.getState();
  const cachedCandidates = [...printerState.printers, ...printerState.options];
  const cachedPrinter = pickMobilePrinterFromList(cachedCandidates);

  if (cachedPrinter?.device_code) {
    return cachedPrinter;
  }

  const loginUuid = textValue(input.login_uuid_fk);

  if (!loginUuid) {
    return cachedPrinter;
  }

  const fetchedPrinters = await getPrinters({
    login_uuid_fk: loginUuid,
    lang: input.lang
  });

  const fetchedPrinter = pickMobilePrinterFromList(fetchedPrinters);

  if (fetchedPrinters.length && isCurrentSession()) {
    usePrinterStore.setState({ printers: fetchedPrinters });
  }

  return fetchedPrinter ?? cachedPrinter;
}

// ตัว resolve ตัวตนเครื่องพิมพ์/agent ที่ใช้ร่วมกันทุก action ฝั่ง POS ที่ยิงคำสั่งพิมพ์
// (confirm to kitchen, send to kitchen, ...) — แยกจาก pos-store.ts เพื่อให้ store อื่น
// (เช่น pos-order-queue-store) เรียกใช้ซ้ำได้โดยไม่ต้อง import pos-store.ts ทั้งไฟล์
export async function resolvePosPrinterContext(
  input: PrinterDeviceContextParams & {
    agent_name?: string;
    lang?: string;
  }
) {
  if (Capacitor.isNativePlatform()) {
    const selectedPrinter = await pickMobilePrinter(input);

    if (!selectedPrinter?.device_code) {
      throw new Error("mobile printer device_code not found");
    }

    return {
      device_code: selectedPrinter.device_code,
      agent_id: selectedPrinter.agent_id ?? input.agent_id,
      agent_name: selectedPrinter.agent_name ?? input.agent_name,
      print_mode: selectedPrinter.print_mode ?? input.print_mode ?? "mobile_wifi"
    };
  }

  return resolvePrinterDeviceContext(input);
}
