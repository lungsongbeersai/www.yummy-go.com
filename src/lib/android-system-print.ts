import { Capacitor, registerPlugin } from "@capacitor/core";
import { isCapacitorAndroidApp } from "@/lib/capacitor-platform";
import { createFileExportGuard, watchExportCurrent, type ExportCurrentCheck } from "@/lib/export/file-output";
import { createUuid } from "@/lib/uuid";

interface AndroidSystemPrintPlugin {
  printHtml(options: {
    baseUrl: string;
    html: string;
    jobName: string;
    orientation?: "landscape" | "portrait";
    colorMode?: "color" | "monochrome";
    requestId?: string;
  }): Promise<{ status: "handed-off" | "cancelled" } | void>;
  getCapabilities(): Promise<{ requestCancellation: boolean }>;
  cancelPrint(options: { requestId: string }): Promise<{ status: "handed-off" | "cancelled" | "missing" }>;
}

const AndroidSystemPrint = registerPlugin<AndroidSystemPrintPlugin>("AndroidSystemPrint");

export function canUseAndroidSystemPrint() {
  // Remote web updates cannot add plugins to an already installed Play build.
  return isCapacitorAndroidApp() && Capacitor.isPluginAvailable("AndroidSystemPrint");
}

export async function printHtmlWithAndroidSystemPrint({
  html,
  jobName,
  orientation,
  colorMode,
  isCurrent,
}: {
  html: string;
  jobName: string;
  orientation?: "landscape" | "portrait";
  colorMode?: "color" | "monochrome";
  isCurrent?: ExportCurrentCheck;
}) {
  if (!canUseAndroidSystemPrint()) return false;

  const payload = {
    baseUrl: window.location.origin,
    html,
    jobName,
    ...(orientation ? { orientation } : {}),
    ...(colorMode ? { colorMode } : {}),
  };
  if (!isCurrent) { await AndroidSystemPrint.printHtml(payload); return true; }

  const current = createFileExportGuard(isCurrent);
  const requestId = createUuid();
  let invalidated = false;
  let sent = false;
  let settled = false;
  let cancelRequested = false;
  function invalidate() {
    if (settled) return;
    invalidated = true;
    if (sent && !cancelRequested) {
      cancelRequested = true;
      // A missing or failed cancel acknowledgement is never proof that an
      // OS-owned job stopped. Only the original print acknowledgement settles it.
      void AndroidSystemPrint.cancelPrint({ requestId }).catch(() => {});
    }
  }
  function assertCurrent() { if (invalidated || !current()) throw new DOMException("Print cancelled", "AbortError"); }
  const stopWatching = watchExportCurrent(current, invalidate);
  const interval = setInterval(() => { if (!current()) invalidate(); }, 250);
  const requireUpdate = () => new Error("Update the Yummy Go Android app to print this report safely.");
  try {
    assertCurrent();
    if (typeof AndroidSystemPrint.getCapabilities !== "function") throw requireUpdate();
    let capabilities;
    try { capabilities = await AndroidSystemPrint.getCapabilities(); }
    catch (error) {
      assertCurrent();
      if (error !== null && typeof error === "object" && "code" in error && error.code === "UNIMPLEMENTED") throw requireUpdate();
      throw error;
    }
    assertCurrent();
    if (capabilities?.requestCancellation !== true) throw requireUpdate();
    sent = true;
    const result = await AndroidSystemPrint.printHtml({ ...payload, requestId });
    settled = true;
    if (result?.status === "cancelled") throw new DOMException("Print cancelled", "AbortError");
    if (result?.status !== "handed-off") throw new Error("The print handoff could not be confirmed. Check the printer before retrying.");
    return true;
  } finally {
    settled = true;
    clearInterval(interval);
    stopWatching();
  }
}
