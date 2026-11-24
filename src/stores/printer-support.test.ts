import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPrinterSupportCommand, getPrinterSupportCommand, getPrinterSupportSummary, type CreatePrinterSupportCommand, type PrinterSupportCommand, type PrinterSupportSummary } from "@/services/printer";
import { createPrinterSupportSlice, type PrinterSupportState } from "./printer-support";
import { resetSessionStores } from "./session-store-registry";

vi.mock("@/services/printer", () => ({
  createPrinterSupportCommand: vi.fn(), getPrinterSupportCommand: vi.fn(), getPrinterSupportSummary: vi.fn(),
  acknowledgePrinterSupportCommand: vi.fn(), claimPrinterSupportCommand: vi.fn(), executePrinterSupportCommand: vi.fn(), resolvePrinterDeviceIdentity: vi.fn(),
}));
const printerUuid = "22222222-2222-4222-8222-222222222222";
const command: PrinterSupportCommand = { command_uuid: "11111111-1111-4111-8111-111111111111", print_config_uuid: printerUuid,
  action: "diagnose", status: "queued", created_at: "2026-11-23T08:00:00Z", expires_at: "2026-11-23T08:02:00Z", finished_at: null, error_code: null, result: null };
const summary: PrinterSupportSummary = { printer: { print_config_uuid: printerUuid, printer_name: "Somtam", interface_value: "tcp://192.168.100.201:9100", agent_online: true },
  recent: { success: 0, pending: 0, failed: 1, unknown: 0, last_error: null, last_error_at: null }, commands: [] };
const input: CreatePrinterSupportCommand = { print_config_uuid: printerUuid, action: "diagnose", request_uuid: "44444444-4444-4444-8444-444444444444" };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function fixture() {
  let state: PrinterSupportState;
  state = createPrinterSupportSlice((patch) => { state = { ...state, ...patch }; }, () => state);
  return { get: () => state };
}

describe("printer support async state", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(getPrinterSupportSummary).mockResolvedValue(summary); vi.mocked(createPrinterSupportCommand).mockResolvedValue(command); });
  it("loads remote support using Backend authorization without requiring a local Agent", async () => {
    const { get } = fixture(); await get().loadPrinterSupport(printerUuid);
    expect(get().supportSummary).toEqual(summary);
    expect(get().supportLoading).toBe(false);
    expect(getPrinterSupportSummary).toHaveBeenCalledWith(printerUuid, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
  it("rejects repeated submits while a create response or a queued command is pending", async () => {
    const { get } = fixture(); await get().loadPrinterSupport(printerUuid);
    const pending = deferred<PrinterSupportCommand>(); vi.mocked(createPrinterSupportCommand).mockReturnValue(pending.promise);
    const first = get().requestPrinterSupport(input);
    expect(await get().requestPrinterSupport(input)).toBeNull();
    pending.resolve(command); await first;
    expect(await get().requestPrinterSupport(input)).toBeNull();
    expect(createPrinterSupportCommand).toHaveBeenCalledTimes(1);
  });
  it("does not let a previous printer's slow summary overwrite a new panel", async () => {
    const { get } = fixture(); const pending = deferred<PrinterSupportSummary>();
    vi.mocked(getPrinterSupportSummary).mockReturnValueOnce(pending.promise);
    const first = get().loadPrinterSupport(printerUuid);
    const otherUuid = "33333333-3333-4333-8333-333333333333";
    const other = { ...summary, printer: { ...summary.printer, print_config_uuid: otherUuid } };
    vi.mocked(getPrinterSupportSummary).mockResolvedValueOnce(other);
    await get().loadPrinterSupport(otherUuid);
    pending.resolve(summary); await first;
    expect(get().supportSummary).toEqual(other);
    expect(get().supportPrinterUuid).toBe(otherUuid);
  });
  it("cancels reads and ignores an uncertain mutation response after leaving the printer", async () => {
    const { get } = fixture(); await get().loadPrinterSupport(printerUuid);
    const pending = deferred<PrinterSupportCommand>(); vi.mocked(createPrinterSupportCommand).mockReturnValue(pending.promise);
    const creating = get().requestPrinterSupport(input);
    const signal = vi.mocked(createPrinterSupportCommand).mock.calls[0][1]?.signal;
    get().clearPrinterSupport(); expect(signal?.aborted).toBe(true);
    pending.resolve(command); expect(await creating).toBeNull();
    expect(get().supportCommand).toBeNull(); expect(get().supportSending).toBe(false);
  });
  it("ignores an old session's status read after logout", async () => {
    const { get } = fixture(); await get().loadPrinterSupport(printerUuid); await get().requestPrinterSupport(input);
    const pending = deferred<PrinterSupportCommand>(); vi.mocked(getPrinterSupportCommand).mockReturnValue(pending.promise);
    const checking = get().checkPrinterSupportCommand(); resetSessionStores();
    pending.resolve({ ...command, status: "succeeded" }); await checking;
    expect(get().supportCommand?.status).toBe("queued");
  });
  it("keeps Backend failures visible instead of reporting a local repair success", async () => {
    const { get } = fixture(); vi.mocked(getPrinterSupportSummary).mockRejectedValue(new Error("Not authorized for this branch"));
    await get().loadPrinterSupport(printerUuid);
    expect(get().supportError).toBe("Not authorized for this branch");
    expect(await get().requestPrinterSupport(input)).toBeNull();
    expect(createPrinterSupportCommand).not.toHaveBeenCalled();
  });
  it("preserves a structured setup error code for localized UI copy", async () => {
    const { get } = fixture();
    const error = Object.assign(new Error("Printer support requires a server migration"), { payload: { code: "PRINTER_SUPPORT_SETUP_REQUIRED" } });
    vi.mocked(getPrinterSupportSummary).mockRejectedValue(error);
    await get().loadPrinterSupport(printerUuid);
    expect(get().supportErrorCode).toBe("PRINTER_SUPPORT_SETUP_REQUIRED");
    get().clearPrinterSupport();
    expect(get().supportErrorCode).toBeNull();
  });
});
