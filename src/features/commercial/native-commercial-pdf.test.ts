import { afterEach, describe, expect, it, vi } from "vitest";
import { ANDROID_COMMERCIAL_PDF_CHUNK_BYTES, ANDROID_COMMERCIAL_PDF_MAX_BYTES, stageAndroidCommercialPdf, type AndroidCommercialPdfPlugin } from "./native-commercial-pdf";

function pdf(size = 48) {
  const bytes = new Uint8Array(size).fill(97);
  bytes.set(new TextEncoder().encode("%PDF-1.7\n"));
  return new File([bytes], "synthetic-quotation.pdf", { type: "application/pdf" });
}

function fixture() {
  let receivedBytes = 0;
  const bridge: AndroidCommercialPdfPlugin = {
    beginPdf: vi.fn(async () => ({ handle: "synthetic-handle" })),
    appendPdf: vi.fn(async ({ index, base64 }) => {
      receivedBytes += Buffer.from(base64, "base64").length;
      return { nextIndex: index + 1, receivedBytes };
    }),
    finishPdf: vi.fn(async () => ({ handle: "synthetic-handle", sizeBytes: receivedBytes })),
    savePdf: vi.fn(async () => ({ status: "saved" as const })),
    sharePdf: vi.fn(async () => ({ status: "opened" as const })),
    releasePdf: vi.fn(async () => {}),
    discardPdf: vi.fn(async () => {}),
  };
  let current = true;
  let invalidate = () => {};
  const unsubscribe = vi.fn();
  return {
    bridge, unsubscribe,
    options: { isCurrent: () => current, watchIdentity: (callback: () => void) => { invalidate = callback; return unsubscribe; } },
    stale: () => { current = false; },
    changeIdentity: () => { current = false; invalidate(); },
  };
}

afterEach(() => { vi.useRealTimers(); });

describe("Android commercial PDF handoff", () => {
  it("transfers exact bytes once in bounded sequential chunks", async () => {
    const f = fixture();
    const file = pdf(ANDROID_COMMERCIAL_PDF_CHUNK_BYTES * 2 + 17);
    const prepared = await stageAndroidCommercialPdf(file, f.bridge, f.options);
    const calls = vi.mocked(f.bridge.appendPdf).mock.calls.map(([chunk]) => chunk);
    expect(calls.map(chunk => chunk.index)).toEqual([0, 1, 2]);
    const chunks = calls.map(chunk => Buffer.from(chunk.base64, "base64"));
    expect(chunks.map(chunk => chunk.length)).toEqual([ANDROID_COMMERCIAL_PDF_CHUNK_BYTES, ANDROID_COMMERCIAL_PDF_CHUNK_BYTES, 17]);
    expect(Buffer.concat(chunks)).toEqual(Buffer.from(await file.arrayBuffer()));
    expect(f.bridge.finishPdf).toHaveBeenCalledOnce();
    prepared.release();
    expect(f.bridge.releasePdf).toHaveBeenCalledWith({ handle: "synthetic-handle" });
    expect(f.unsubscribe).toHaveBeenCalledOnce();
  });

  it.each(["signature", "size", "mime"])("rejects an invalid %s before native staging", async kind => {
    const f = fixture();
    const file = kind === "size" ? pdf(ANDROID_COMMERCIAL_PDF_MAX_BYTES + 1)
      : new File([kind === "signature" ? "not-a-pdf" : "%PDF-1.7"], "test.pdf", { type: kind === "mime" ? "text/plain" : "application/pdf" });
    await expect(stageAndroidCommercialPdf(file, f.bridge, f.options)).rejects.toThrow("Invalid native PDF transfer");
    expect(f.bridge.beginPdf).not.toHaveBeenCalled();
  });

  it.each(["index", "bytes", "finish"])("discards the private native file on a mismatched %s acknowledgement", async kind => {
    const f = fixture();
    if (kind === "finish") f.bridge.finishPdf = vi.fn(async () => ({ handle: "wrong-handle", sizeBytes: 48 }));
    else f.bridge.appendPdf = vi.fn(async () => ({ nextIndex: kind === "index" ? 2 : 1, receivedBytes: kind === "bytes" ? 49 : 48 }));
    await expect(stageAndroidCommercialPdf(pdf(), f.bridge, f.options)).rejects.toThrow("Invalid native PDF transfer");
    expect(f.bridge.discardPdf).toHaveBeenCalledWith({ handle: "synthetic-handle" });
  });

  it("discards a handle that arrives after its owner has logged out", async () => {
    const f = fixture();
    f.bridge.beginPdf = vi.fn(async () => { f.changeIdentity(); return { handle: "late-handle" }; });
    await expect(stageAndroidCommercialPdf(pdf(), f.bridge, f.options)).rejects.toMatchObject({ name: "AbortError" });
    expect(f.bridge.discardPdf).toHaveBeenCalledWith({ handle: "late-handle" });
    expect(f.bridge.appendPdf).not.toHaveBeenCalled();
  });

  it("stops uploading when content becomes stale between chunks", async () => {
    const f = fixture();
    f.bridge.appendPdf = vi.fn(async () => { f.stale(); return { nextIndex: 1, receivedBytes: ANDROID_COMMERCIAL_PDF_CHUNK_BYTES }; });
    await expect(stageAndroidCommercialPdf(pdf(ANDROID_COMMERCIAL_PDF_CHUNK_BYTES + 1), f.bridge, f.options)).rejects.toMatchObject({ name: "AbortError" });
    expect(f.bridge.appendPdf).toHaveBeenCalledOnce();
    expect(f.bridge.finishPdf).not.toHaveBeenCalled();
    expect(f.bridge.discardPdf).toHaveBeenCalledOnce();
  });

  it("keeps save cancellation neutral and prevents concurrent native pickers", async () => {
    const f = fixture();
    let finishSave: (result: { status: "cancelled" }) => void = () => {};
    f.bridge.savePdf = vi.fn(() => new Promise<{ status: "cancelled" }>(resolve => { finishSave = resolve; }));
    const prepared = await stageAndroidCommercialPdf(pdf(), f.bridge, f.options);
    const saving = prepared.save();
    await expect(prepared.share()).rejects.toThrow("already open");
    finishSave({ status: "cancelled" });
    await expect(saving).resolves.toBe("cancelled");
    expect(f.bridge.sharePdf).not.toHaveBeenCalled();
    prepared.dispose();
  });

  it("retains an opened share through normal closure but revokes it on auth change", async () => {
    vi.useFakeTimers();
    const f = fixture();
    const prepared = await stageAndroidCommercialPdf(pdf(), f.bridge, f.options);
    await prepared.share();
    prepared.release();
    expect(f.bridge.releasePdf).toHaveBeenCalledOnce();
    expect(f.bridge.discardPdf).not.toHaveBeenCalled();
    expect(f.unsubscribe).not.toHaveBeenCalled();
    f.changeIdentity();
    expect(f.bridge.discardPdf).toHaveBeenCalledOnce();
    expect(f.unsubscribe).toHaveBeenCalledOnce();
    await expect(prepared.save()).rejects.toMatchObject({ name: "AbortError" });
    expect(f.bridge.savePdf).not.toHaveBeenCalled();
  });

  it("bounds a handed-off file lifetime to five minutes", async () => {
    vi.useFakeTimers();
    const f = fixture();
    const prepared = await stageAndroidCommercialPdf(pdf(), f.bridge, f.options);
    await prepared.share();
    prepared.release();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(f.bridge.discardPdf).toHaveBeenCalledOnce();
    expect(f.unsubscribe).toHaveBeenCalledOnce();
  });

  it("suppresses an old session's save result after forced revocation", async () => {
    const f = fixture();
    f.bridge.savePdf = vi.fn(async () => { f.changeIdentity(); return { status: "saved" as const }; });
    const prepared = await stageAndroidCommercialPdf(pdf(), f.bridge, f.options);
    await expect(prepared.save()).rejects.toMatchObject({ name: "AbortError" });
    expect(f.bridge.discardPdf).toHaveBeenCalledOnce();
  });
});
