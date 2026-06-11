import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BROWSER_DESKTOP_AGENT_ID,
  BROWSER_DEVICE_CODE_KEY,
  BROWSER_MOBILE_AGENT_ID,
  getBrowserAgentName,
  getBrowserDeviceCode,
  getBrowserPrinterIdentity,
  isBrowserPrinterAgentId
} from "@/services/printer/browser-device";

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

  it("recognizes browser printer agent ids", () => {
    expect(isBrowserPrinterAgentId("mobile")).toBe(true);
    expect(isBrowserPrinterAgentId("desktop")).toBe(true);
    expect(isBrowserPrinterAgentId("browser")).toBe(false);
    expect(isBrowserPrinterAgentId("agent-1")).toBe(false);
  });
});
