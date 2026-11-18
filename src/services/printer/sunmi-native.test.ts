import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSunmiBuiltinPrinterIdentity,
  isSunmiBuiltinPrinterTarget,
  printSunmiEscpos,
  SUNMI_PRINTER_AGENT_ID,
  SUNMI_PRINTER_INTERFACE,
  SUNMI_PRINT_MODE,
  sunmiDiagnosticJobId,
  sunmiJobId,
} from "./sunmi-native";
import type { PrintJob } from "./types";
import { resetSessionStores } from "@/stores/session-store-registry";

const mocks = vi.hoisted(() => ({
  native: true, available: true, platform: "android",
  info: vi.fn(), print: vi.fn(), identity: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.native,
    getPlatform: () => mocks.platform,
    isPluginAvailable: () => mocks.available,
  },
  registerPlugin: () => ({ getInfo: mocks.info, printEscpos: mocks.print }),
}));
vi.mock("@/services/printer/browser-device", () => ({ getBrowserPrinterIdentity: mocks.identity }));
vi.mock("@/lib/api", () => ({ ServiceError: class extends Error {} }));

const target = {
  agent_id: SUNMI_PRINTER_AGENT_ID,
  device_code: "android-native-terminal1",
  print_mode: SUNMI_PRINT_MODE,
  interface_value: SUNMI_PRINTER_INTERFACE,
};
const info = {
  supported: true, connected: true, ready: true,
  model: "D2s PLUS", paperWidthMm: 80, stateCode: 1,
  deviceCode: target.device_code, interfaceValue: SUNMI_PRINTER_INTERFACE,
};
const input = { target, jobId: "item-1:printer-1", escposBase64: "G0A=" };

describe("SUNMI built-in printer transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.native = true; mocks.available = true; mocks.platform = "android";
    mocks.info.mockReset().mockResolvedValue(info);
    mocks.identity.mockReset().mockResolvedValue({ agent_id: "mobile", device_code: target.device_code });
    mocks.print.mockReset().mockImplementation(async (request: { jobId: string }) => ({
      deliveryState: "printed", jobId: request.jobId, replayed: false,
    }));
  });

  it.each(["web", "ios", "old-apk", "not-sunmi"])("does not advertise unsupported %s clients", async (kind) => {
    if (kind === "web") mocks.native = false;
    if (kind === "ios") mocks.platform = "ios";
    if (kind === "old-apk") mocks.available = false;
    if (kind === "not-sunmi") mocks.info.mockResolvedValue({ ...info, supported: false });
    expect(await getSunmiBuiltinPrinterIdentity()).toBeNull();
    expect(mocks.print).not.toHaveBeenCalled();
    expect(mocks.identity).not.toHaveBeenCalled();
  });

  it("keeps detected paper-out printers configurable without advertising a ready receiver", async () => {
    mocks.info.mockResolvedValue({ ...info, ready: false, stateCode: 4 });
    expect(await getSunmiBuiltinPrinterIdentity()).toMatchObject({
      agent_id: target.agent_id, device_code: target.device_code, print_mode: target.print_mode,
      supports_sunmi_builtin: true, sunmi_ready: false, sunmi_state_code: 4,
    });
    expect(await getSunmiBuiltinPrinterIdentity(true)).toBeNull();
  });

  it("attests the existing native Device identity instead of rotating the mobile TCP identity", async () => {
    expect(await getSunmiBuiltinPrinterIdentity()).toMatchObject({
      agent_id: "sunmi-native", device_code: "android-native-terminal1",
      print_mode: "sunmi_builtin", paper_width_mm: 80,
    });
    expect(await mocks.identity()).toEqual({ agent_id: "mobile", device_code: target.device_code });
  });

  it("rejects a mismatched native identity before sending paper", async () => {
    mocks.identity.mockResolvedValue({ agent_id: "mobile", device_code: "android-native-other" });
    await expect(printSunmiEscpos(input)).rejects.toMatchObject({ delivery_state: "not_sent" });
    expect(mocks.print).not.toHaveBeenCalled();
  });

  it.each([
    { agent_id: "mobile" }, { print_mode: "mobile_wifi" },
    { interface_value: "tcp://192.0.2.1:9100" }, { device_code: "android-native-other" },
  ])("never substitutes another device or physical transport: %o", async (change) => {
    await expect(printSunmiEscpos({ ...input, target: { ...target, ...change } }))
      .rejects.toMatchObject({ delivery_state: "not_sent" });
    expect(mocks.print).not.toHaveBeenCalled();
  });

  it("passes stable job and expected device identities to the native durable journal", async () => {
    await printSunmiEscpos(input);
    expect(mocks.print).toHaveBeenCalledExactlyOnceWith({
      jobId: input.jobId, escposBase64: input.escposBase64, expectedDeviceCode: target.device_code,
    });
  });

  it.each([
    { code: "SUNMI_UNKNOWN", data: { delivery_state: "unknown" } },
    { code: "SUNMI_JOB_CONFLICT", data: { delivery_state: "unknown" } },
    { code: "SUNMI_NOT_SENT", data: { delivery_state: "unknown" } },
    new Error("Bridge response lost after dispatch"),
  ])("keeps an uncertain native completion terminal without retrying", async (error) => {
    mocks.print.mockRejectedValueOnce(error);
    await expect(printSunmiEscpos(input)).rejects.toMatchObject({ delivery_state: "unknown" });
    expect(mocks.print).toHaveBeenCalledTimes(1);
  });

  it("preserves a definite native pre-send refusal", async () => {
    mocks.print.mockRejectedValueOnce({ code: "SUNMI_NOT_SENT", data: { delivery_state: "not_sent" } });
    await expect(printSunmiEscpos(input)).rejects.toMatchObject({ delivery_state: "not_sent" });
    expect(mocks.print).toHaveBeenCalledTimes(1);
  });

  it("does not infer paper success from an unrelated or malformed bridge response", async () => {
    mocks.print.mockResolvedValueOnce({ deliveryState: "printed", jobId: "another-job" });
    await expect(printSunmiEscpos(input)).rejects.toMatchObject({ delivery_state: "unknown" });
    expect(mocks.print).toHaveBeenCalledTimes(1);
  });

  it("classifies a failed device identity read as not sent", async () => {
    mocks.identity.mockRejectedValueOnce(new Error("Device unavailable"));
    await expect(printSunmiEscpos(input)).rejects.toMatchObject({ delivery_state: "not_sent" });
    expect(mocks.print).not.toHaveBeenCalled();
  });

  it("lets the native journal replay a printed result even when the current printer is paper-out", async () => {
    mocks.info.mockResolvedValue({ ...info, ready: false, stateCode: 4 });
    mocks.print.mockResolvedValueOnce({ deliveryState: "printed", jobId: input.jobId, replayed: true });
    await expect(printSunmiEscpos(input)).resolves.toBeUndefined();
    expect(mocks.info).not.toHaveBeenCalled();
    expect(mocks.print).toHaveBeenCalledOnce();
  });

  it("serializes jobs for the one physical built-in printer", async () => {
    let finish!: (value: { deliveryState: "printed"; jobId: string; replayed: boolean }) => void;
    mocks.print.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const first = printSunmiEscpos(input);
    const second = printSunmiEscpos({ ...input, jobId: "item-2:printer-1" });
    await vi.waitFor(() => expect(mocks.print).toHaveBeenCalledTimes(1));
    finish({ deliveryState: "printed", jobId: input.jobId, replayed: false });
    await Promise.all([first, second]);
    expect(mocks.print).toHaveBeenCalledTimes(2);
    expect(mocks.print.mock.calls[1][0]).toMatchObject({ jobId: "item-2:printer-1" });
  });

  it("cancels an old session's waiting job before native handoff while retaining an in-flight result", async () => {
    let finish!: (value: { deliveryState: "printed"; jobId: string; replayed: boolean }) => void;
    mocks.print.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const first = printSunmiEscpos(input);
    const waiting = printSunmiEscpos({ ...input, jobId: "waiting-old-session" });
    const rejected = expect(waiting).rejects.toMatchObject({ delivery_state: "not_sent" });
    await vi.waitFor(() => expect(mocks.print).toHaveBeenCalledOnce());
    resetSessionStores();
    finish({ deliveryState: "printed", jobId: input.jobId, replayed: false });
    await expect(first).resolves.toBeUndefined();
    await rejected;
    expect(mocks.print).toHaveBeenCalledOnce();
  });

  it("rechecks the session after its device identity read and before SDK dispatch", async () => {
    let finish!: (value: { agent_id: string; device_code: string }) => void;
    mocks.identity.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const printing = printSunmiEscpos(input);
    const rejected = expect(printing).rejects.toMatchObject({ delivery_state: "not_sent" });
    await vi.waitFor(() => expect(mocks.identity).toHaveBeenCalledOnce());
    resetSessionStores();
    finish({ agent_id: "mobile", device_code: target.device_code });
    await rejected;
    expect(mocks.print).not.toHaveBeenCalled();
  });

  it("requires a durable identity for business jobs and gives explicit diagnostics new identities", () => {
    const job: PrintJob = { lang: "la", paper_width_mm: 80, printer_type: "epson", ops: [], interface_value: SUNMI_PRINTER_INTERFACE };
    expect(() => sunmiJobId(job)).toThrow("durable job identity");
    expect(sunmiJobId({ ...job, print_job_item_uuid: "item", print_config_uuid: "printer" })).toBe("item:printer");
    expect(sunmiDiagnosticJobId("test")).not.toBe(sunmiDiagnosticJobId("test"));
  });

  it("recognizes malformed SUNMI destinations so they fail in this transport rather than falling back", () => {
    expect(isSunmiBuiltinPrinterTarget({ interface_value: "sunmi://wrong" })).toBe(true);
    expect(isSunmiBuiltinPrinterTarget({ agent_id: "sunmi-native", print_mode: "wrong" })).toBe(true);
    expect(isSunmiBuiltinPrinterTarget({ interface_value: "tcp://192.0.2.1:9100", agent_id: "mobile" })).toBe(false);
  });
});
