import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BROWSER_DESKTOP_AGENT_ID,
  BROWSER_DEVICE_CODE_KEY,
  BROWSER_MOBILE_AGENT_ID,
  getBrowserAgentName,
  getBrowserDeviceCode,
  getBrowserPrinterIdentity,
  nativePrinterDeviceCode,
  rememberNativePrinterDeviceCode,
  isBrowserPrinterAgentId
} from "@/services/printer/browser-device";
import { printerPrintModeForPlatform } from "@/lib/printer-platform";

const nativeMocks = vi.hoisted(() => ({
  isCapacitorMobileApp: vi.fn(() => false),
  getId: vi.fn(),
  getInfo: vi.fn(),
}));

vi.mock("@/lib/capacitor-platform", () => ({
  isCapacitorMobileApp: nativeMocks.isCapacitorMobileApp,
}));

vi.mock("@capacitor/device", () => ({
  Device: {
    getId: nativeMocks.getId,
    getInfo: nativeMocks.getInfo,
  },
}));

function storageMock() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    })
  };
}

describe("browser printer device identity", () => {
  beforeEach(() => {
    nativeMocks.isCapacitorMobileApp.mockReturnValue(false);
    nativeMocks.getId.mockReset();
    nativeMocks.getInfo.mockReset();
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "device-1") });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates and persists a web device code in localStorage", () => {
    const localStorage = storageMock();
    vi.stubGlobal("window", { localStorage });

    expect(getBrowserDeviceCode("Android Phone")).toBe("android-phone-web-device-1");
    expect(getBrowserDeviceCode("Android Phone")).toBe("android-phone-web-device-1");
    expect(localStorage.setItem).toHaveBeenCalledTimes(1);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      BROWSER_DEVICE_CODE_KEY,
      "android-phone-web-device-1"
    );
  });

  it("keeps browser devices separated by local storage", () => {
    const firstStorage = storageMock();
    vi.stubGlobal("window", { localStorage: firstStorage });
    expect(getBrowserDeviceCode("Infinix GT30 Pro")).toBe("infinix-gt30-pro-web-device-1");

    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "device-2") });
    const secondStorage = storageMock();
    vi.stubGlobal("window", { localStorage: secondStorage });

    expect(getBrowserDeviceCode("Windows Laptop")).toBe("windows-laptop-web-device-2");
  });

  it("derives readable device names without browser names", () => {
    expect(getBrowserAgentName("Mozilla/5.0 Android Chrome/120.0.0.0")).toBe("Android Phone");
    expect(getBrowserAgentName("Mozilla/5.0 Android Chrome/120.0.0.0", { mobile: true })).toBe(
      "Android Phone"
    );
    expect(getBrowserAgentName("Mozilla/5.0 iPhone CriOS/120.0.0.0")).toBe("iPhone");
    expect(getBrowserAgentName("Mozilla/5.0 iPad Safari/604.1")).toBe("iPad");
    expect(getBrowserAgentName("Mozilla/5.0 Windows NT 10.0 Chrome/120.0.0.0")).toBe(
      "Windows Laptop"
    );
    expect(getBrowserAgentName("Mozilla/5.0 Mac OS X Safari/605.1.15")).toBe("Mac Laptop");
    expect(getBrowserAgentName("Mozilla/5.0 Android Chrome/120.0.0.0", {
      model: "Infinix GT30 Pro"
    })).toBe("Infinix GT30 Pro");
  });

  it("returns a mobile device identity from high entropy browser data", async () => {
    const localStorage = storageMock();
    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 Linux; Android 15; Chrome/120.0.0.0",
      userAgentData: {
        mobile: true,
        platform: "Android",
        getHighEntropyValues: vi.fn().mockResolvedValue({
          model: "Infinix GT30 Pro",
          platform: "Android"
        })
      }
    });

    await expect(getBrowserPrinterIdentity()).resolves.toEqual({
      agent_id: BROWSER_MOBILE_AGENT_ID,
      agent_name: "Infinix GT30 Pro",
      device_code: "infinix-gt30-pro-web-device-1",
      platform: "browser"
    });
  });

  it("returns a desktop device identity when mobile hints are absent", async () => {
    const localStorage = storageMock();
    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 Windows NT 10.0 Chrome/120.0.0.0",
      userAgentData: { mobile: false, platform: "Windows" }
    });

    await expect(getBrowserPrinterIdentity()).resolves.toEqual({
      agent_id: BROWSER_DESKTOP_AGENT_ID,
      agent_name: "Windows Laptop",
      device_code: "windows-laptop-web-device-1",
      platform: "browser"
    });
  });

  it("uses the native device id and retains the old web id for migration", async () => {
    const localStorage = storageMock();
    localStorage.setItem(BROWSER_DEVICE_CODE_KEY, "android-phone-web-old-id");
    vi.stubGlobal("window", { localStorage });
    nativeMocks.isCapacitorMobileApp.mockReturnValue(true);
    nativeMocks.getId.mockResolvedValue({ identifier: "ABCDEF0123456789" });
    nativeMocks.getInfo.mockResolvedValue({
      name: "Galaxy S24 FE",
      model: "SM-S721B",
      platform: "android",
    });

    await expect(getBrowserPrinterIdentity()).resolves.toEqual({
      agent_id: BROWSER_MOBILE_AGENT_ID,
      agent_name: "Galaxy S24 FE",
      device_code: "android-native-abcdef0123456789",
      platform: "android",
      previous_device_code: "android-phone-web-old-id",
    });
  });

  it("normalizes native ids without generating a random code", () => {
    expect(nativePrinterDeviceCode("iOS", "A1B2-C3D4")).toBe(
      "ios-native-a1b2-c3d4",
    );
    expect(nativePrinterDeviceCode("android", "")).toBe("");
  });

  it("persists the native id after the server migration succeeds", () => {
    const localStorage = storageMock();
    vi.stubGlobal("window", { localStorage });

    rememberNativePrinterDeviceCode("android-native-abcdef0123456789");

    expect(localStorage.setItem).toHaveBeenCalledWith(
      BROWSER_DEVICE_CODE_KEY,
      "android-native-abcdef0123456789",
    );
  });

  it("keeps the web id while an older native shell lacks the Device plugin", async () => {
    const localStorage = storageMock();
    vi.stubGlobal("window", { localStorage });
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 Android YummyGoCapacitorAndroid",
      userAgentData: { mobile: true, platform: "Android" },
    });
    nativeMocks.isCapacitorMobileApp.mockReturnValue(true);
    nativeMocks.getId.mockRejectedValue(new Error("not implemented"));
    nativeMocks.getInfo.mockRejectedValue(new Error("not implemented"));

    await expect(getBrowserPrinterIdentity()).resolves.toMatchObject({
      agent_id: BROWSER_MOBILE_AGENT_ID,
      device_code: "android-phone-web-device-1",
      platform: "browser",
    });
  });

  it("recognizes browser printer agent ids", () => {
    expect(isBrowserPrinterAgentId("mobile")).toBe(true);
    expect(isBrowserPrinterAgentId("desktop")).toBe(true);
    expect(isBrowserPrinterAgentId("browser")).toBe(false);
    expect(isBrowserPrinterAgentId("agent-1")).toBe(false);
  });

  it("derives the printer transport from the reported platform", () => {
    expect(printerPrintModeForPlatform("win32")).toBe("windows_agent");
    expect(printerPrintModeForPlatform("darwin")).toBe("mac_agent");
    expect(printerPrintModeForPlatform("Android")).toBe("mobile_wifi");
    expect(printerPrintModeForPlatform("browser", true)).toBe("mobile_wifi");
    expect(printerPrintModeForPlatform("linux")).toBeUndefined();
  });
});
