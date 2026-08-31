import { Capacitor } from "@capacitor/core";
import { printerPrintModeForPlatform } from "@/lib/printer-platform";
import { resolvePrinterDeviceIdentity, type PrinterDeviceContextParams } from "@/services/printer";
import { getBrowserPrinterIdentity } from "@/services/printer/browser-device";

function textValue(value: unknown) {
  return String(value ?? "").trim();
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
  const native = Capacitor.isNativePlatform();
  const identity = native
    ? await getBrowserPrinterIdentity()
    : await resolvePrinterDeviceIdentity().then((result) => {
        if (!result.ok) throw new Error(result.error);
        return result.agent;
      });
  const deviceCode = textValue(identity.device_code);
  const agentId = textValue(identity.agent_id);

  if (!deviceCode || !agentId) {
    throw new Error("Printer device identity missing");
  }

  const suppliedIdentityMatches =
    textValue(input.device_code) === deviceCode &&
    (!textValue(input.agent_id) || textValue(input.agent_id) === agentId);

  return {
    device_code: deviceCode,
    agent_id: agentId,
    agent_name: textValue(identity.agent_name) || input.agent_name,
    print_mode:
      (suppliedIdentityMatches ? textValue(input.print_mode) : "") ||
      printerPrintModeForPlatform(identity.platform, native),
  };
}
