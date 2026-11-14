import { Capacitor, registerPlugin } from "@capacitor/core";
import { isCapacitorAndroidApp } from "@/lib/capacitor-platform";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";

export interface AndroidCommercialPdfPlugin {
  beginPdf(options: { fileName: string; sizeBytes: number }): Promise<{ handle: string }>;
  appendPdf(options: { handle: string; index: number; base64: string }): Promise<{ nextIndex: number; receivedBytes: number }>;
  finishPdf(options: { handle: string }): Promise<{ handle: string; sizeBytes: number }>;
  savePdf(options: { handle: string }): Promise<{ status: "saved" | "cancelled" }>;
  sharePdf(options: { handle: string }): Promise<{ status: "opened" }>;
  releasePdf(options: { handle: string }): Promise<void>;
  discardPdf(options: { handle: string }): Promise<void>;
}

export interface PreparedAndroidCommercialPdf {
  save(): Promise<"saved" | "cancelled">;
  share(): Promise<void>;
  release(): void;
  dispose(): void;
}

interface StageOptions {
  isCurrent: () => boolean;
  watchIdentity?: (invalidate: () => void) => () => void;
}

export const ANDROID_COMMERCIAL_PDF_MAX_BYTES = 20 * 1024 * 1024;
export const ANDROID_COMMERCIAL_PDF_CHUNK_BYTES = 256 * 1024;
const LEASE_MS = 5 * 60_000;
const AndroidCommercialPdf = registerPlugin<AndroidCommercialPdfPlugin>("AndroidCommercialPdf");

export function getCommercialPdfAndroidSupport(): "browser" | "supported" | "update-required" {
  if (!isCapacitorAndroidApp()) return "browser";
  return Capacitor.isPluginAvailable("AndroidCommercialPdf") ? "supported" : "update-required";
}

function cancelled() { return new DOMException("Document export cancelled", "AbortError"); }
function invalidTransfer() { return new Error("Invalid native PDF transfer"); }
function ignoreCleanup(operation: Promise<void>) { void operation.catch(() => {}); }

function encodeChunk(bytes: Uint8Array) {
  let binary = "";
  // Bound both bridge messages and JS argument counts for Android WebViews.
  for (let offset = 0; offset < bytes.length; offset += 16_384) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 16_384));
  }
  return btoa(binary);
}

/** Transfer bytes, never a caller path or a URL, into private Android staging. */
export async function stageAndroidCommercialPdf(file: File, bridge: AndroidCommercialPdfPlugin, { isCurrent, watchIdentity }: StageOptions): Promise<PreparedAndroidCommercialPdf> {
  if (file.type !== "application/pdf" || !/\.pdf$/i.test(file.name) || file.size < 5 || file.size > ANDROID_COMMERCIAL_PDF_MAX_BYTES) throw invalidTransfer();
  let handle: string | undefined;
  let active = true;
  let discarded = false;
  let shared = false;
  let pending: "save" | "share" | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unwatch: (() => void) | undefined;
  const dispose = () => {
    if (discarded) return;
    active = false;
    discarded = true;
    clearTimeout(timer);
    unwatch?.();
    if (handle) ignoreCleanup(bridge.discardPdf({ handle }));
  };
  const assertCurrent = () => {
    if (!active || !isCurrent()) { dispose(); throw cancelled(); }
  };
  const renewExpiry = () => { clearTimeout(timer); timer = setTimeout(dispose, LEASE_MS); };
  try {
    assertCurrent();
    unwatch = watchIdentity?.(dispose);
    if (discarded) unwatch?.();
    assertCurrent();
    const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    assertCurrent();
    if (String.fromCharCode(...signature) !== "%PDF-") throw invalidTransfer();
    const started = await bridge.beginPdf({ fileName: file.name, sizeBytes: file.size });
    if (typeof started.handle !== "string" || !started.handle) throw invalidTransfer();
    handle = started.handle;
    // An auth change may have happened while beginPdf was crossing the bridge.
    if (discarded) ignoreCleanup(bridge.discardPdf({ handle }));
    assertCurrent();
    renewExpiry();
    let index = 0;
    for (let offset = 0; offset < file.size; offset += ANDROID_COMMERCIAL_PDF_CHUNK_BYTES) {
      const end = Math.min(file.size, offset + ANDROID_COMMERCIAL_PDF_CHUNK_BYTES);
      const bytes = new Uint8Array(await file.slice(offset, end).arrayBuffer());
      assertCurrent();
      const ack = await bridge.appendPdf({ handle, index, base64: encodeChunk(bytes) });
      assertCurrent();
      if (ack.nextIndex !== index + 1 || ack.receivedBytes !== end) throw invalidTransfer();
      index += 1;
    }
    const finished = await bridge.finishPdf({ handle });
    assertCurrent();
    if (finished.handle !== handle || finished.sizeBytes !== file.size) throw invalidTransfer();
    renewExpiry();
    const prepared: PreparedAndroidCommercialPdf = {
      dispose,
      release: () => {
        if (!active) return;
        active = false;
        if (handle) ignoreCleanup(bridge.releasePdf({ handle }));
        // A chosen receiver may read after this dialog closes. Keep only the
        // bounded auth revocation subscription until its native lease expires.
        if (!shared && pending !== "share") { clearTimeout(timer); unwatch?.(); }
      },
      save: async () => {
        assertCurrent();
        if (pending) throw new Error("A PDF action is already open");
        pending = "save";
        try {
          const result = await bridge.savePdf({ handle: finished.handle });
          assertCurrent();
          if (result.status !== "saved" && result.status !== "cancelled") throw invalidTransfer();
          return result.status;
        } finally { pending = null; }
      },
      share: async () => {
        assertCurrent();
        if (pending) throw new Error("A PDF action is already open");
        pending = "share";
        try {
          const result = await bridge.sharePdf({ handle: finished.handle });
          assertCurrent();
          if (result.status !== "opened") throw invalidTransfer();
          shared = true;
          renewExpiry();
        } finally { pending = null; }
      },
    };
    return prepared;
  } catch (error) { dispose(); throw error; }
}

function identity() {
  const { user, token } = useAuthStore.getState();
  return JSON.stringify([user?.uuid, authStoreUuid(user), token]);
}

export function prepareAndroidCommercialPdf(file: File, isCurrent: () => boolean): Promise<PreparedAndroidCommercialPdf> {
  if (getCommercialPdfAndroidSupport() !== "supported") return Promise.reject(new Error("Android app update required"));
  const owner = identity();
  return stageAndroidCommercialPdf(file, AndroidCommercialPdf, {
    isCurrent: () => owner === identity() && isCurrent(),
    watchIdentity: invalidate => useAuthStore.subscribe(() => { if (owner !== identity()) invalidate(); }),
  });
}
