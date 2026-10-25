import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePosPrinterContext } from "@/stores/pos-store/printer-context";
import { resetSessionStores } from "@/stores/session-store-registry";

const mocks = vi.hoisted(() => ({
  getBrowserPrinterIdentity: vi.fn(),
  isCapacitorMobileApp: vi.fn(),
  migrateMobilePrinterDevice: vi.fn(),
  rememberNativePrinterDeviceCode: vi.fn(),
  resolvePrinterDeviceIdentity: vi.fn(),
  registerPrinterAgent: vi.fn(),
}));

vi.mock("@/lib/capacitor-platform", () => ({
  isCapacitorMobileApp: mocks.isCapacitorMobileApp,
}));

vi.mock("@/services/printer", () => ({
  getBrowserPrinterIdentity: mocks.getBrowserPrinterIdentity,
  migrateMobilePrinterDevice: mocks.migrateMobilePrinterDevice,
  rememberNativePrinterDeviceCode: mocks.rememberNativePrinterDeviceCode,
  resolvePrinterDeviceIdentity: mocks.resolvePrinterDeviceIdentity,
  registerPrinterAgent: mocks.registerPrinterAgent,
  isBrowserPrinterAgentId: (value: unknown) => value === "desktop" || value === "mobile",
}));

describe("POS printer context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSessionStores();
    mocks.isCapacitorMobileApp.mockReturnValue(true);
    mocks.migrateMobilePrinterDevice.mockResolvedValue({ migrated_total: 1 });
    mocks.registerPrinterAgent.mockReset().mockResolvedValue({});
  });
  afterEach(() => vi.useRealTimers());

  it("recovers an unambiguous legacy mobile config when the old web id is unavailable", async () => {
    mocks.getBrowserPrinterIdentity.mockResolvedValue({
      agent_id: "mobile",
      agent_name: "Swan1",
      device_code: "android-native-swan1",
      platform: "android",
      previous_device_code: null,
    });

    await expect(resolvePosPrinterContext({ login_uuid_fk: "login-1" })).resolves.toEqual({
      agent_id: "mobile",
      agent_name: "Swan1",
      device_code: "android-native-swan1",
      print_mode: "mobile_wifi",
    });

    expect(mocks.migrateMobilePrinterDevice).toHaveBeenCalledWith({
      login_uuid_fk: "login-1",
      to_device_code: "android-native-swan1",
    });
    expect(mocks.rememberNativePrinterDeviceCode).toHaveBeenCalledWith(
      "android-native-swan1",
    );
  });

  it("migrates the exact previous web device when its id is available", async () => {
    mocks.getBrowserPrinterIdentity.mockResolvedValue({
      agent_id: "mobile",
      agent_name: "Android Tablet",
      device_code: "android-native-tablet",
      platform: "android",
      previous_device_code: "android-tablet-web-old",
    });

    await resolvePosPrinterContext({ login_uuid_fk: "login-2" });

    expect(mocks.migrateMobilePrinterDevice).toHaveBeenCalledWith({
      from_device_code: "android-tablet-web-old",
      login_uuid_fk: "login-2",
      to_device_code: "android-native-tablet",
    });
  });

  const physicalAgent = {
    agent_id: "cashier-agent", agent_name: "CashierCh1", device_code: "DESKTOP-SUSHC94",
    agent_url: "http://192.0.2.20:7777", platform: "win32",
  };
  function connectedAgent() {
    mocks.isCapacitorMobileApp.mockReturnValue(false);
    mocks.resolvePrinterDeviceIdentity.mockResolvedValue({ ok: true, agent: physicalAgent });
  }

  it("coalesces registration before returning concurrent POS contexts and caches it for the session", async () => {
    vi.useFakeTimers();
    connectedAgent();
    let finish!: () => void;
    mocks.registerPrinterAgent.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const first = resolvePosPrinterContext({ login_uuid_fk: "cashier" });
    const second = resolvePosPrinterContext({ login_uuid_fk: "cashier" });
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.registerPrinterAgent).toHaveBeenCalledExactlyOnceWith({
      login_uuid_fk: "cashier", ...physicalAgent, agent_secret_hash: "",
    }, { timeout: 5000 });
    finish();
    await expect(first).resolves.toMatchObject({ device_code: "DESKTOP-SUSHC94", agent_id: "cashier-agent", print_mode: "windows_agent" });
    await second;
    await vi.advanceTimersByTimeAsync(600_000);
    await resolvePosPrinterContext({ login_uuid_fk: "cashier" });
    expect(mocks.registerPrinterAgent).toHaveBeenCalledOnce();
    resetSessionStores();
    await resolvePosPrinterContext({ login_uuid_fk: "cashier" });
    expect(mocks.registerPrinterAgent).toHaveBeenCalledTimes(2);
  });

  it("registers again when the login or physical Agent identity changes", async () => {
    connectedAgent();
    await resolvePosPrinterContext({ login_uuid_fk: "cashier-1" });
    await resolvePosPrinterContext({ login_uuid_fk: "cashier-2" });
    mocks.resolvePrinterDeviceIdentity.mockResolvedValue({ ok: true, agent: { ...physicalAgent, agent_id: "reinstalled-agent" } });
    await expect(resolvePosPrinterContext({ login_uuid_fk: "cashier-2" })).resolves.toMatchObject({ agent_id: "reinstalled-agent" });
    expect(mocks.registerPrinterAgent).toHaveBeenCalledTimes(3);
  });

  it("propagates registration failure before a mutation and permits a subsequent retry", async () => {
    connectedAgent();
    mocks.registerPrinterAgent.mockRejectedValueOnce(new Error("Registration unavailable"));
    await expect(resolvePosPrinterContext({ login_uuid_fk: "cashier" })).rejects.toMatchObject({
      payload: { error_code: "PRINTER_AGENT_REGISTRATION_FAILED", retryable: true },
    });
    await expect(resolvePosPrinterContext({ login_uuid_fk: "cashier" })).resolves.toMatchObject({ agent_id: "cashier-agent" });
    expect(mocks.registerPrinterAgent).toHaveBeenCalledTimes(2);
  });

  it.each(["http://127.0.0.1:7777", "http://localhost:7777", "http://printer.local:7777", "http://[::1]:7777"])(
    "keeps direct physical printing available when the advertised URL cannot be registered: %s",
    async (agentUrl) => {
      connectedAgent();
      mocks.resolvePrinterDeviceIdentity.mockResolvedValue({ ok: true, agent: { ...physicalAgent, agent_url: agentUrl } });
      await expect(resolvePosPrinterContext({ login_uuid_fk: "cashier" })).resolves.toMatchObject({
        device_code: physicalAgent.device_code, agent_id: physicalAgent.agent_id, print_mode: "windows_agent",
      });
      expect(mocks.registerPrinterAgent).not.toHaveBeenCalled();
    },
  );

  it.each([
    { ok: true, connected: false, agent: physicalAgent, error: "Agent offline" },
    { ok: true, connected: false, agent: { agent_id: "desktop", device_code: "browser-device", platform: "browser" } },
    { ok: true, agent: { ...physicalAgent, agent_url: "invalid" } },
  ])("keeps disconnected/shared browser contexts without registering another physical device: %j", async (result) => {
    mocks.isCapacitorMobileApp.mockReturnValue(false);
    mocks.resolvePrinterDeviceIdentity.mockResolvedValue(result);
    await expect(resolvePosPrinterContext({ login_uuid_fk: "cashier" })).resolves.toMatchObject({ agent_id: result.agent.agent_id });
    expect(mocks.registerPrinterAgent).not.toHaveBeenCalled();
  });
});
