import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePosPrinterContext } from "@/stores/pos-store/printer-context";

const mocks = vi.hoisted(() => ({
  getBrowserPrinterIdentity: vi.fn(),
  isCapacitorMobileApp: vi.fn(),
  migrateMobilePrinterDevice: vi.fn(),
  rememberNativePrinterDeviceCode: vi.fn(),
  resolvePrinterDeviceIdentity: vi.fn(),
}));

vi.mock("@/lib/capacitor-platform", () => ({
  isCapacitorMobileApp: mocks.isCapacitorMobileApp,
}));

vi.mock("@/services/printer", () => ({
  getBrowserPrinterIdentity: mocks.getBrowserPrinterIdentity,
  migrateMobilePrinterDevice: mocks.migrateMobilePrinterDevice,
  rememberNativePrinterDeviceCode: mocks.rememberNativePrinterDeviceCode,
  resolvePrinterDeviceIdentity: mocks.resolvePrinterDeviceIdentity,
}));

describe("POS printer context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isCapacitorMobileApp.mockReturnValue(true);
    mocks.migrateMobilePrinterDevice.mockResolvedValue({ migrated_total: 1 });
  });

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
});
