import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSunmiBuiltinPrinterIdentity,
  discoverSunmiBuiltinPrinter,
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
  native: true, available: true, appAvailable: true, tcpAvailable: true, platform: "android",
  info: vi.fn(), print: vi.fn(), identity: vi.fn(), appInfo: vi.fn(),
}));
vi.mock("@capacitor/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@capacitor/core")>();
  Object.assign(actual.Capacitor, {
    PluginHeaders: [{ name: "SunmiPrinter", methods: [
      { name: "getInfo", rtype: "promise" }, { name: "printEscpos", rtype: "promise" },
    ] }],
    nativePromise: (_pluginName: string, method: string, options: unknown) => {
      if (method === "getInfo") return mocks.info();
      if (method === "printEscpos") return mocks.print(options);
      throw new Error(`Unexpected native SUNMI method: ${method}`);
    },
  });
  return {
    ...actual,
    Capacitor: {
      ...actual.Capacitor,
      isNativePlatform: () => mocks.native,
      getPlatform: () => mocks.platform,
      isPluginAvailable: (name: string) => name === "App" ? mocks.appAvailable : name === "TcpSocket" ? mocks.tcpAvailable : mocks.available,
    },
    // Keep Capacitor's actual proxy: its callable `then` property must never
    // be Promise-assimilated by an asynchronous adapter factory.
    registerPlugin: actual.registerPlugin,
  };
});
vi.mock("@/services/printer/browser-device", () => ({ getBrowserPrinterIdentity: mocks.identity }));
vi.mock("@capacitor/app", () => ({ App: { getInfo: mocks.appInfo } }));
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
    mocks.native = true; mocks.available = true; mocks.appAvailable = true; mocks.tcpAvailable = true; mocks.platform = "android";
    mocks.info.mockReset().mockResolvedValue(info);
    mocks.identity.mockReset().mockResolvedValue({ agent_id: "mobile", device_code: target.device_code });
    mocks.appInfo.mockReset().mockResolvedValue({ version: "1.0.10", build: "11" });
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
      supports_sunmi_builtin: true, supports_tcp_relay: true, sunmi_ready: false, sunmi_state_code: 4,
    });
    expect(await getSunmiBuiltinPrinterIdentity(true)).toBeNull();
  });

  it("keeps built-in printing available without claiming TCP relay when its native plugin is absent", async () => {
    mocks.tcpAvailable = false;
    expect(await getSunmiBuiltinPrinterIdentity()).toMatchObject({
      supports_sunmi_builtin: true, supports_tcp_relay: false, sunmi_ready: true,
    });
  });

  it("attests the existing native Device identity instead of rotating the mobile TCP identity", async () => {
    expect(await getSunmiBuiltinPrinterIdentity()).toMatchObject({
      agent_id: "sunmi-native", device_code: "android-native-terminal1",
      print_mode: "sunmi_builtin", paper_width_mm: 80,
    });
    expect(await mocks.identity()).toEqual({ agent_id: "mobile", device_code: target.device_code });
    expect(mocks.appInfo).not.toHaveBeenCalled();
  });

  it("reaches discovery and printing once through Capacitor's actual thenable proxy", async () => {
    const discovery = await discoverSunmiBuiltinPrinter();
    const actual = await vi.importActual<typeof import("@capacitor/core")>("@capacitor/core");
    const plugins = Reflect.get(actual.Capacitor, "Plugins") as Record<string, unknown>;
    const proxy = plugins.SunmiPrinter as Record<string, unknown>;
    expect(typeof proxy.then).toBe("function");
    expect(discovery.agent).toMatchObject({ agent_id: "sunmi-native", device_code: target.device_code });
    expect(mocks.info).toHaveBeenCalledExactlyOnceWith();
    await printSunmiEscpos(input);
    expect(mocks.print).toHaveBeenCalledExactlyOnceWith({ jobId: input.jobId,
      escposBase64: input.escposBase64, expectedDeviceCode: target.device_code });
  });

  it.each(["web", "ios"])("keeps %s diagnostics separate from Android native discovery", async (kind) => {
    if (kind === "web") mocks.native = false;
    else mocks.platform = "ios";
    expect(await discoverSunmiBuiltinPrinter()).toMatchObject({
      agent: null, diagnostic: { status: "not_native", nativeAndroid: false, installedVersion: null },
    });
    expect(mocks.info).not.toHaveBeenCalled();
    expect(mocks.appInfo).not.toHaveBeenCalled();
  });

  it("shows a missing bridge in the Android app shell without treating its user agent as hardware capability", async () => {
    mocks.native = false; mocks.platform = "web";
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 Chrome/83.0 YummyGoCapacitorAndroid" });
    try {
      expect(await discoverSunmiBuiltinPrinter()).toMatchObject({ agent: null,
        diagnostic: { status: "plugin_missing", nativeAndroid: true, installedVersion: null } });
      expect(await getSunmiBuiltinPrinterIdentity()).toBeNull();
      expect(mocks.info).not.toHaveBeenCalled();
      expect(mocks.appInfo).not.toHaveBeenCalled();
      expect(mocks.identity).not.toHaveBeenCalled();
      expect(mocks.print).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });

  it("does not show an Android browser as the Android app shell", async () => {
    mocks.native = false; mocks.platform = "web";
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 11) Chrome/83.0" });
    try {
      expect((await discoverSunmiBuiltinPrinter()).diagnostic).toMatchObject({ status: "not_native", nativeAndroid: false });
      expect(mocks.info).not.toHaveBeenCalled();
    } finally { vi.unstubAllGlobals(); }
  });

  it("identifies an Android APK missing the printer bridge while retaining its actual installed version", async () => {
    mocks.available = false;
    expect(await discoverSunmiBuiltinPrinter()).toMatchObject({
      agent: null, diagnostic: { status: "plugin_missing", nativeAndroid: true, installedVersion: "1.0.10", installedBuild: 11 },
    });
    expect(mocks.info).not.toHaveBeenCalled();
    expect(mocks.identity).not.toHaveBeenCalled();
  });

  it.each(["missing", "rejected"])("does not substitute a legacy APK version when App metadata is %s", async (kind) => {
    if (kind === "missing") mocks.appAvailable = false;
    else mocks.appInfo.mockRejectedValueOnce(new Error("App metadata unavailable"));
    expect(await discoverSunmiBuiltinPrinter()).toMatchObject({
      agent: { agent_id: "sunmi-native" },
      diagnostic: { status: "available", installedVersion: null, installedBuild: null },
    });
  });

  it("retains the native service reason and model instead of hiding an unsupported printer", async () => {
    mocks.info.mockResolvedValueOnce({ ...info, supported: false, connected: false, ready: false,
      reason: "SUNMI printer service did not connect in time.", stateCode: null });
    expect(await discoverSunmiBuiltinPrinter()).toMatchObject({
      agent: null, diagnostic: { status: "unsupported", nativeAndroid: true, model: "D2s PLUS",
        reason: "SUNMI printer service did not connect in time.", ready: false, installedVersion: "1.0.10" },
    });
    expect(mocks.identity).not.toHaveBeenCalled();
  });

  it("reports a bridge read failure without claiming that a built-in printer was detected", async () => {
    mocks.info.mockRejectedValueOnce(new Error("Printer service disconnected"));
    expect(await discoverSunmiBuiltinPrinter()).toMatchObject({
      agent: null, diagnostic: { status: "service_error", error: "Printer service disconnected", model: null,
        nativeAndroid: true, installedVersion: "1.0.10" },
    });
  });

  it("reports a local identity mismatch with the detected hardware metadata and never sends paper", async () => {
    mocks.identity.mockResolvedValueOnce({ device_code: "android-native-other" });
    const result = await discoverSunmiBuiltinPrinter();
    expect(result).toMatchObject({ agent: null, diagnostic: { status: "identity_error", model: "D2s PLUS",
      deviceCode: target.device_code, installedVersion: "1.0.10" } });
    expect(result.diagnostic.error).toContain("does not match");
    expect(mocks.print).not.toHaveBeenCalled();
  });

  it("retains supported paper-out hardware as configurable while reporting its nonready state", async () => {
    mocks.info.mockResolvedValueOnce({ ...info, ready: false, stateCode: 4, statusMessage: "Out of paper" });
    expect(await discoverSunmiBuiltinPrinter()).toMatchObject({
      agent: { agent_id: "sunmi-native", sunmi_ready: false },
      diagnostic: { status: "available", ready: false, stateCode: 4, reason: "Out of paper" },
    });
  });

  it("can rediscover a service that connects after an earlier unsupported response", async () => {
    mocks.info.mockResolvedValueOnce({ ...info, supported: false, ready: false, reason: "Service not connected" });
    expect((await discoverSunmiBuiltinPrinter()).diagnostic.status).toBe("unsupported");
    expect(await discoverSunmiBuiltinPrinter()).toMatchObject({ agent: { agent_id: "sunmi-native" },
      diagnostic: { status: "available", reason: null } });
    expect(mocks.info).toHaveBeenCalledTimes(2);
    expect(mocks.print).not.toHaveBeenCalled();
  });

  it("reads APK metadata alongside printer discovery rather than delaying the SDK probe", async () => {
    let resolveVersion!: (value: { version: string; build: string }) => void;
    mocks.appInfo.mockImplementationOnce(() => new Promise(resolve => { resolveVersion = resolve; }));
    const discovery = discoverSunmiBuiltinPrinter();
    await vi.waitFor(() => expect(mocks.info).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(mocks.appInfo).toHaveBeenCalledOnce());
    resolveVersion({ version: "1.0.10", build: "11" });
    expect((await discovery).diagnostic.installedVersion).toBe("1.0.10");
  });

  it("does not let missing APK metadata hold a detected printer or leave probe timers behind", async () => {
    vi.useFakeTimers();
    mocks.appInfo.mockReturnValueOnce(new Promise(() => undefined));
    try {
      const request = discoverSunmiBuiltinPrinter();
      await vi.advanceTimersByTimeAsync(1_500);
      expect(await request).toMatchObject({ agent: { agent_id: "sunmi-native" },
        diagnostic: { status: "available", installedVersion: null, installedBuild: null } });
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("bounds a lost availability bridge response and allows a later explicit retry", async () => {
    vi.useFakeTimers();
    mocks.info.mockReturnValueOnce(new Promise(() => undefined));
    try {
      const request = discoverSunmiBuiltinPrinter();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await request).toMatchObject({ agent: null, diagnostic: { status: "service_error",
        error: "SUNMI printer availability could not be read in time." } });
      expect(await discoverSunmiBuiltinPrinter()).toMatchObject({ agent: { agent_id: "sunmi-native" },
        diagnostic: { status: "available", error: null } });
      expect(vi.getTimerCount()).toBe(0);
      expect(mocks.print).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("bounds a lost device identity response without registering an unverified printer", async () => {
    vi.useFakeTimers();
    mocks.identity.mockReturnValueOnce(new Promise(() => undefined));
    try {
      const request = discoverSunmiBuiltinPrinter();
      await vi.advanceTimersByTimeAsync(3_000);
      expect(await request).toMatchObject({ agent: null, diagnostic: { status: "identity_error",
        error: "The built-in printer identity could not be verified in time." } });
      expect(vi.getTimerCount()).toBe(0);
      expect(mocks.print).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("clears all discovery timeout timers after an immediate successful probe", async () => {
    vi.useFakeTimers();
    try {
      expect((await discoverSunmiBuiltinPrinter()).diagnostic.status).toBe("available");
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
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
