import { Capacitor, registerPlugin } from "@capacitor/core";
import { isCapacitorAndroidApp } from "@/lib/capacitor-platform";
import { useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const NATIVE_EXPORT_MAX_BYTES = 64 * 1024 * 1024;
export const NATIVE_EXPORT_CHUNK_BYTES = 256 * 1024;
const NATIVE_EXPORT_TTL_MS = 5 * 60_000;
const EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf", [XLSX_MIME]: ".xlsx", "image/png": ".png", "application/zip": ".zip",
};

export type ExportFileResult = "saved" | "cancelled";

export interface NativeFileExportBridge {
  beginFile(options: { fileName: string; mimeType: string; sizeBytes: number }): Promise<{ handle: string }>;
  appendFile(options: { handle: string; index: number; base64: string }): Promise<{ nextIndex: number; receivedBytes: number }>;
  finishFile(options: { handle: string }): Promise<{ handle: string; sizeBytes: number }>;
  saveFile(options: { handle: string }): Promise<{ status: ExportFileResult }>;
  discardFile(options: { handle: string }): Promise<void>;
}

interface ExistingPdfBridge {
  beginPdf(options: { fileName: string; sizeBytes: number }): Promise<{ handle: string }>;
  appendPdf: NativeFileExportBridge["appendFile"];
  finishPdf: NativeFileExportBridge["finishFile"];
  savePdf: NativeFileExportBridge["saveFile"];
  discardPdf: NativeFileExportBridge["discardFile"];
}

export interface ExportCurrentCheck {
  (): boolean;
  subscribe?: (invalidate: () => void) => () => void;
}

export interface SaveExportFileOptions {
  isCurrent?: ExportCurrentCheck;
}

interface NativeTransferOptions extends SaveExportFileOptions {
  watchIdentity?: (invalidate: () => void) => () => void;
}

export class FileExportError extends Error {
  constructor(public readonly code: "update-required" | "invalid-file" | "too-large" | "invalid-transfer") {
    super(code === "update-required" ? "Update the Yummy Go Android app to save this file."
      : code === "too-large" ? "The export exceeds the device's file size limit."
      : "Unable to save this export. Prepare it again and retry.");
    this.name = "FileExportError";
  }
}

const AndroidFileExport = registerPlugin<NativeFileExportBridge>("AndroidFileExport");
const AndroidCommercialPdf = registerPlugin<ExistingPdfBridge>("AndroidCommercialPdf");

function abort() { return new DOMException("Export cancelled", "AbortError"); }
function invalidTransfer() { return new FileExportError("invalid-transfer"); }

function fileName(file: File) {
  const extension = Object.prototype.hasOwnProperty.call(EXTENSIONS, file.type) ? EXTENSIONS[file.type] : undefined;
  if (!extension || !file.name.toLowerCase().endsWith(extension)) throw new FileExportError("invalid-file");
  const safe = file.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").trim().replace(/^[.]+|[. ]+$/g, "");
  const base = safe.slice(0, -extension.length) || "yummy-go-export";
  let clipped = base;
  while (new TextEncoder().encode(clipped + extension).length > 180) clipped = Array.from(clipped).slice(0, -1).join("");
  return clipped + extension;
}

async function validateNativeFile(file: File) {
  fileName(file);
  if (file.size > NATIVE_EXPORT_MAX_BYTES) throw new FileExportError("too-large");
  if (file.size < 8) throw new FileExportError("invalid-file");
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const signature = file.type === "application/pdf" ? [37, 80, 68, 70, 45]
    : file.type === "image/png" ? [137, 80, 78, 71, 13, 10, 26, 10]
    : file.type === "application/zip" && header[2] === 5 ? [80, 75, 5, 6] : [80, 75, 3, 4];
  if (!signature.every((byte, index) => header[index] === byte)) throw new FileExportError("invalid-file");
}

function encodeChunk(bytes: Uint8Array) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 16_384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16_384));
  return btoa(binary);
}

/** No URL or filesystem path crosses this bridge; only bounded, acknowledged bytes. */
export async function transferNativeExportFile(file: File, bridge: NativeFileExportBridge, options: NativeTransferOptions = {}): Promise<ExportFileResult> {
  let handle: string | undefined;
  let invalidated = false;
  let cleanup: Promise<void> | undefined;
  let unwatch: (() => void) | undefined;
  function discard() {
    if (handle && !cleanup) cleanup = bridge.discardFile({ handle }).catch(() => {});
  }
  function invalidate() { invalidated = true; discard(); }
  function assertCurrent() { if (invalidated || options.isCurrent?.() === false) { invalidate(); throw abort(); } }
  const deadline = setTimeout(invalidate, NATIVE_EXPORT_TTL_MS);
  const contentWatch = setInterval(() => { if (options.isCurrent?.() === false) invalidate(); }, 250);
  try {
    assertCurrent();
    unwatch = options.watchIdentity?.(invalidate);
    assertCurrent();
    await validateNativeFile(file);
    assertCurrent();
    const started = await bridge.beginFile({ fileName: fileName(file), mimeType: file.type, sizeBytes: file.size });
    if (typeof started.handle !== "string" || !started.handle) throw invalidTransfer();
    handle = started.handle;
    if (invalidated) discard();
    assertCurrent();
    let index = 0;
    for (let offset = 0; offset < file.size; offset += NATIVE_EXPORT_CHUNK_BYTES) {
      const end = Math.min(file.size, offset + NATIVE_EXPORT_CHUNK_BYTES);
      const bytes = new Uint8Array(await file.slice(offset, end).arrayBuffer());
      assertCurrent();
      const ack = await bridge.appendFile({ handle, index, base64: encodeChunk(bytes) });
      assertCurrent();
      if (ack.nextIndex !== index + 1 || ack.receivedBytes !== end) throw invalidTransfer();
      index += 1;
    }
    const finished = await bridge.finishFile({ handle });
    assertCurrent();
    if (finished.handle !== handle || finished.sizeBytes !== file.size) throw invalidTransfer();
    const saved = await bridge.saveFile({ handle });
    assertCurrent();
    if (saved.status !== "saved" && saved.status !== "cancelled") throw invalidTransfer();
    return saved.status;
  } finally {
    clearTimeout(deadline);
    clearInterval(contentWatch);
    unwatch?.();
    discard();
    await cleanup;
  }
}

function exportIdentity() {
  const { user, token } = useAuthStore.getState();
  return JSON.stringify([token, user?.uuid, user?.store_uuid, user?.store_uuid_fk, user?.branch_uuid, user?.status, user?.store_status, useBranchStore.getState().selectedBranchUuid]);
}

export function createFileExportGuard(isCurrent?: ExportCurrentCheck): ExportCurrentCheck {
  const owner = exportIdentity();
  return Object.assign(() => owner === exportIdentity() && isCurrent?.() !== false, { subscribe: isCurrent?.subscribe });
}

export function watchExportCurrent(isCurrent: ExportCurrentCheck, invalidate: () => void) {
  const check = () => { if (!isCurrent()) invalidate(); };
  const cleanups = [useAuthStore.subscribe(check), useBranchStore.subscribe(check), isCurrent.subscribe?.(invalidate)];
  return () => { cleanups.forEach(cleanup => cleanup?.()); };
}

/** Browser initiation preserves existing download behavior; Android reports the SAF result. */
export async function saveExportFile(file: File, options: SaveExportFileOptions = {}): Promise<ExportFileResult> {
  const isCurrent = createFileExportGuard(options.isCurrent);
  if (!isCurrent()) throw abort();
  if (!isCapacitorAndroidApp()) {
    const url = URL.createObjectURL(file);
    try {
      if (!isCurrent()) throw abort();
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = fileName(file); anchor.rel = "noopener";
      document.body.append(anchor); anchor.click(); anchor.remove();
      return "saved";
    } finally { setTimeout(() => URL.revokeObjectURL(url), 60_000); }
  }
  let bridge = AndroidFileExport;
  if (!Capacitor.isPluginAvailable("AndroidFileExport")) {
    if (file.type !== "application/pdf" || !Capacitor.isPluginAvailable("AndroidCommercialPdf")) throw new FileExportError("update-required");
    if (file.size > 20 * 1024 * 1024) throw new FileExportError("too-large");
    bridge = {
      beginFile: ({ fileName: name, sizeBytes }) => AndroidCommercialPdf.beginPdf({ fileName: name, sizeBytes }),
      appendFile: (chunk) => AndroidCommercialPdf.appendPdf(chunk),
      finishFile: (input) => AndroidCommercialPdf.finishPdf(input),
      saveFile: (input) => AndroidCommercialPdf.savePdf(input),
      discardFile: (input) => AndroidCommercialPdf.discardPdf(input),
    };
  }
  return transferNativeExportFile(file, bridge, {
    isCurrent,
    watchIdentity: invalidate => watchExportCurrent(isCurrent, invalidate),
  });
}
