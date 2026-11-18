import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  android: true,
  available: new Set<string>(),
  bridges: {} as Record<string, Record<string, unknown>>,
  state: { token: "token-one", user: { uuid: "user-one", store_uuid: "store-one", branch_uuid: "branch-one", status: 1, store_status: 1 } },
  branch: { selectedBranchUuid: "branch-one" },
  listeners: new Set<() => void>(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isPluginAvailable: (name: string) => runtime.available.has(name) },
  registerPlugin: (name: string) => new Proxy({}, { get: (_target, key) => runtime.bridges[name]?.[String(key)] }),
}));
vi.mock("@/lib/capacitor-platform", () => ({ isCapacitorAndroidApp: () => runtime.android }));
vi.mock("@/stores/auth-store", () => ({ useAuthStore: {
  getState: () => runtime.state,
  subscribe: (listener: () => void) => { runtime.listeners.add(listener); return () => runtime.listeners.delete(listener); },
} }));
vi.mock("@/stores/branch-store", () => ({ useBranchStore: {
  getState: () => runtime.branch,
  subscribe: (listener: () => void) => { runtime.listeners.add(listener); return () => runtime.listeners.delete(listener); },
} }));

import { createFileExportGuard, NATIVE_EXPORT_CHUNK_BYTES, saveExportFile, transferNativeExportFile, XLSX_MIME, type NativeFileExportBridge } from "./file-output";

function pdf(size = 32) {
  const bytes = new Uint8Array(size).fill(97);
  bytes.set(new TextEncoder().encode("%PDF-1.7\n"));
  return new File([bytes], "report.pdf", { type: "application/pdf" });
}

function fixture() {
  let receivedBytes = 0;
  const bridge: NativeFileExportBridge = {
    beginFile: vi.fn(async () => ({ handle: "private-handle" })),
    appendFile: vi.fn(async ({ index, base64 }) => {
      receivedBytes += Buffer.from(base64, "base64").length;
      return { nextIndex: index + 1, receivedBytes };
    }),
    finishFile: vi.fn(async () => ({ handle: "private-handle", sizeBytes: receivedBytes })),
    saveFile: vi.fn(async () => ({ status: "saved" as const })),
    discardFile: vi.fn(async () => {}),
  };
  return bridge;
}

beforeEach(() => {
  runtime.android = true;
  runtime.available.clear();
  runtime.bridges = {};
  runtime.listeners.clear();
  runtime.state.token = "token-one";
  runtime.branch.selectedBranchUuid = "branch-one";
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("native export handoff", () => {
  it("transfers exact bytes in bounded sequential chunks and removes private staging after saving", async () => {
    const bridge = fixture();
    const file = pdf(NATIVE_EXPORT_CHUNK_BYTES * 2 + 17);
    await expect(transferNativeExportFile(file, bridge)).resolves.toBe("saved");
    const chunks = vi.mocked(bridge.appendFile).mock.calls.map(([chunk]) => chunk);
    expect(chunks.map(chunk => chunk.index)).toEqual([0, 1, 2]);
    expect(Buffer.concat(chunks.map(chunk => Buffer.from(chunk.base64, "base64")))).toEqual(Buffer.from(await file.arrayBuffer()));
    expect(bridge.saveFile).toHaveBeenCalledExactlyOnceWith({ handle: "private-handle" });
    expect(bridge.discardFile).toHaveBeenCalledExactlyOnceWith({ handle: "private-handle" });
  });

  it("keeps picker cancellation neutral and cleans its private file", async () => {
    const bridge = fixture();
    vi.mocked(bridge.saveFile).mockResolvedValue({ status: "cancelled" });
    await expect(transferNativeExportFile(pdf(), bridge)).resolves.toBe("cancelled");
    expect(bridge.discardFile).toHaveBeenCalledOnce();
  });

  it.each([
    new File(["not-a-pdf"], "report.pdf", { type: "application/pdf" }),
    new File(["%PDF-1.7"], "report.exe", { type: "application/pdf" }),
    new File(["%PDF-1.7"], "report.txt", { type: "text/plain" }),
    new File(["PK-not-a-zip"], "report.xlsx", { type: XLSX_MIME }),
  ])("rejects mismatched bytes, extension or MIME before crossing the bridge ($name)", async file => {
    const bridge = fixture();
    await expect(transferNativeExportFile(file, bridge)).rejects.toMatchObject({ code: "invalid-file" });
    expect(bridge.beginFile).not.toHaveBeenCalled();
  });

  it("never opens a picker after an invalid chunk acknowledgement", async () => {
    const bridge = fixture();
    vi.mocked(bridge.appendFile).mockResolvedValue({ nextIndex: 99, receivedBytes: 32 });
    await expect(transferNativeExportFile(pdf(), bridge)).rejects.toMatchObject({ code: "invalid-transfer" });
    expect(bridge.saveFile).not.toHaveBeenCalled();
    expect(bridge.discardFile).toHaveBeenCalledOnce();
  });

  it("discards a handle returned after its initiating view was invalidated", async () => {
    const bridge = fixture();
    let current = true;
    vi.mocked(bridge.beginFile).mockImplementation(async () => { current = false; return { handle: "late-handle" }; });
    await expect(transferNativeExportFile(pdf(), bridge, { isCurrent: () => current })).rejects.toMatchObject({ name: "AbortError" });
    expect(bridge.discardFile).toHaveBeenCalledWith({ handle: "late-handle" });
    expect(bridge.appendFile).not.toHaveBeenCalled();
  });

  it("revokes an open picker immediately when its view invalidates", async () => {
    const bridge = fixture();
    let invalidate = () => {};
    let finishSave: (value: { status: "cancelled" }) => void = () => {};
    vi.mocked(bridge.saveFile).mockImplementation(() => new Promise(resolve => { finishSave = resolve; }));
    const saving = transferNativeExportFile(pdf(), bridge, { watchIdentity: callback => { invalidate = callback; return () => {}; } });
    await vi.waitFor(() => expect(bridge.saveFile).toHaveBeenCalledOnce());
    invalidate();
    expect(bridge.discardFile).toHaveBeenCalledOnce();
    finishSave({ status: "cancelled" });
    await expect(saving).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("platform output capability and session ownership", () => {
  it("uses the new native output on Android and preserves the selected branch ownership", async () => {
    const bridge = fixture();
    runtime.available.add("AndroidFileExport");
    runtime.bridges.AndroidFileExport = { ...bridge };
    const current = createFileExportGuard();
    runtime.branch.selectedBranchUuid = "branch-two";
    expect(current()).toBe(false);
    await expect(saveExportFile(pdf(), { isCurrent: current })).rejects.toMatchObject({ name: "AbortError" });
    expect(bridge.beginFile).not.toHaveBeenCalled();
    runtime.branch.selectedBranchUuid = "branch-one";
    await expect(saveExportFile(pdf())).resolves.toBe("saved");
    expect(runtime.listeners.size).toBe(0);
  });

  it("reuses the PDF-only plugin in an older installed shell without sending other formats to it", async () => {
    const bridge = fixture();
    runtime.available.add("AndroidCommercialPdf");
    runtime.bridges.AndroidCommercialPdf = {
      beginPdf: bridge.beginFile, appendPdf: bridge.appendFile, finishPdf: bridge.finishFile,
      savePdf: bridge.saveFile, discardPdf: bridge.discardFile,
    };
    await expect(saveExportFile(pdf())).resolves.toBe("saved");
    const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "qr.png", { type: "image/png" });
    await expect(saveExportFile(png)).rejects.toMatchObject({ code: "update-required" });
    expect(bridge.beginFile).toHaveBeenCalledOnce();
  });

  it("revokes a pending SAF save before completion when the selected branch changes", async () => {
    const bridge = fixture();
    runtime.available.add("AndroidFileExport");
    runtime.bridges.AndroidFileExport = { ...bridge };
    let finishSave: (value: { status: "cancelled" }) => void = () => {};
    vi.mocked(bridge.saveFile).mockImplementation(() => new Promise(resolve => { finishSave = resolve; }));
    const saving = saveExportFile(pdf());
    await vi.waitFor(() => expect(bridge.saveFile).toHaveBeenCalledOnce());
    runtime.branch.selectedBranchUuid = "branch-two";
    runtime.listeners.forEach(listener => listener());
    expect(bridge.discardFile).toHaveBeenCalledOnce();
    finishSave({ status: "cancelled" });
    await expect(saving).rejects.toMatchObject({ name: "AbortError" });
    expect(runtime.listeners.size).toBe(0);
  });

  it("keeps caller view invalidation subscribed for the full native picker lifetime", async () => {
    const bridge = fixture();
    runtime.available.add("AndroidFileExport");
    runtime.bridges.AndroidFileExport = { ...bridge };
    let invalidateView = () => {};
    let current = true;
    let finishSave: (value: { status: "cancelled" }) => void = () => {};
    const unsubscribe = vi.fn();
    const guard = Object.assign(() => current, { subscribe: (callback: () => void) => { invalidateView = callback; return unsubscribe; } });
    vi.mocked(bridge.saveFile).mockImplementation(() => new Promise(resolve => { finishSave = resolve; }));
    const saving = saveExportFile(pdf(), { isCurrent: guard });
    await vi.waitFor(() => expect(bridge.saveFile).toHaveBeenCalledOnce());
    current = false; invalidateView();
    expect(bridge.discardFile).toHaveBeenCalledOnce();
    finishSave({ status: "cancelled" });
    await expect(saving).rejects.toMatchObject({ name: "AbortError" });
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it("uses the existing browser download mechanism outside native Android", async () => {
    vi.useFakeTimers();
    runtime.android = false;
    const anchor = { href: "", download: "", rel: "", click: vi.fn(), remove: vi.fn() };
    vi.stubGlobal("document", { createElement: () => anchor, body: { append: vi.fn() } });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:synthetic-export");
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    await expect(saveExportFile(pdf())).resolves.toBe("saved");
    expect(anchor.download).toBe("report.pdf");
    expect(anchor.click).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(revoke).toHaveBeenCalledWith("blob:synthetic-export");
  });
});
