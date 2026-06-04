import { describe, expect, it } from "vitest";
import {
  activeCustomerDisplay,
  browserCustomerDisplayPosition,
  browserCustomerDisplayWindowFeatures,
  browserDisplayIsConnected,
  customerDisplayIdFromStorage,
  customerDisplayPosition,
  customerDisplayResolution,
  defaultBrowserCustomerDisplayKey,
  defaultCustomerDisplayId,
  displayIsConnected,
  normalizeBrowserCustomerDisplayInfo,
  type BrowserCustomerDisplayScreenLike
} from "./customer-display-picker-utils";

const primary: ElectronDisplay = {
  height: 1080,
  id: 1,
  isActive: false,
  isPrimary: true,
  label: "1920 x 1080",
  scaleFactor: 1,
  width: 1920,
  x: 0,
  y: 0
};

const secondary: ElectronDisplay = {
  height: 1080,
  id: 2,
  isActive: false,
  isPrimary: false,
  label: "1920 x 1080",
  scaleFactor: 1,
  width: 1920,
  x: 1920,
  y: 0
};

const browserPrimary: BrowserCustomerDisplayScreenLike = {
  availHeight: 1040,
  availLeft: 0,
  availTop: 0,
  availWidth: 1920,
  devicePixelRatio: 1,
  height: 1080,
  isInternal: true,
  isPrimary: true,
  label: "Primary display",
  left: 0,
  top: 0,
  width: 1920
};

const browserSecondary: BrowserCustomerDisplayScreenLike = {
  availHeight: 1080,
  availLeft: 1920,
  availTop: 0,
  availWidth: 1920,
  devicePixelRatio: 1,
  height: 1080,
  isInternal: false,
  isPrimary: false,
  label: "Customer display",
  left: 1920,
  top: 0,
  width: 1920
};

function displayInfo(overrides: Partial<ElectronDisplayInfo> = {}): ElectronDisplayInfo {
  return {
    activeCustomerDisplayId: null,
    count: 2,
    displays: [primary, secondary],
    hasSecondary: true,
    primary,
    ...overrides
  };
}

describe("customer display picker helpers", () => {
  it("labels display resolution and position", () => {
    expect(customerDisplayResolution(primary)).toBe("1920 x 1080");
    expect(customerDisplayPosition(secondary)).toBe("x 1920, y 0");
  });

  it("uses last selected display when it is still connected", () => {
    expect(defaultCustomerDisplayId(displayInfo(), 1)).toBe(1);
  });

  it("defaults to the active display, then secondary, then primary", () => {
    expect(defaultCustomerDisplayId(displayInfo({ activeCustomerDisplayId: 1 }), null)).toBe(1);
    expect(defaultCustomerDisplayId(displayInfo(), null)).toBe(2);
    expect(defaultCustomerDisplayId(displayInfo({ count: 1, displays: [primary], hasSecondary: false }), null)).toBe(1);
  });

  it("falls back from disconnected preferred display to the best connected display", () => {
    expect(defaultCustomerDisplayId(displayInfo(), 99)).toBe(2);
  });

  it("detects disconnected active and stored display ids", () => {
    const info = displayInfo({ activeCustomerDisplayId: 99 });
    expect(activeCustomerDisplay(info)).toBeNull();
    expect(displayIsConnected(info, 99)).toBe(false);
    expect(customerDisplayIdFromStorage("2")).toBe(2);
    expect(customerDisplayIdFromStorage("bad")).toBeNull();
  });

  it("uses display metadata when the active id is not available", () => {
    const activeSecondary = { ...secondary, isActive: true };
    const info = displayInfo({ displays: [primary, activeSecondary] });

    expect(activeCustomerDisplay(info)?.id).toBe(2);
  });

  it("normalizes browser screen details and defaults to the secondary screen", () => {
    const info = normalizeBrowserCustomerDisplayInfo(
      {
        currentScreen: browserPrimary,
        screens: [browserPrimary, browserSecondary]
      },
      true
    );

    expect(info.count).toBe(2);
    expect(info.hasSecondary).toBe(true);
    expect(info.isExtended).toBe(true);
    expect(info.screens[0].isCurrent).toBe(true);
    expect(info.screens[1].label).toBe("Customer display");
    expect(defaultBrowserCustomerDisplayKey(info, null)).toBe(info.screens[1].key);
  });

  it("uses last selected browser screen when it is still connected", () => {
    const info = normalizeBrowserCustomerDisplayInfo(
      { currentScreen: browserPrimary, screens: [browserPrimary, browserSecondary] },
      true
    );

    expect(defaultBrowserCustomerDisplayKey(info, info.screens[0].key)).toBe(info.screens[0].key);
    expect(browserDisplayIsConnected(info, info.screens[1].key)).toBe(true);
  });

  it("falls browser screen selection back to secondary or primary", () => {
    const extended = normalizeBrowserCustomerDisplayInfo(
      { currentScreen: browserPrimary, screens: [browserPrimary, browserSecondary] },
      true
    );
    const single = normalizeBrowserCustomerDisplayInfo(
      { currentScreen: browserPrimary, screens: [browserPrimary] },
      false
    );

    expect(defaultBrowserCustomerDisplayKey(extended, "missing")).toBe(extended.screens[1].key);
    expect(defaultBrowserCustomerDisplayKey(single, "missing")).toBe(single.screens[0].key);
    expect(defaultBrowserCustomerDisplayKey(null, "missing")).toBeNull();
  });

  it("builds browser display position labels and popup features", () => {
    const info = normalizeBrowserCustomerDisplayInfo(
      { currentScreen: browserPrimary, screens: [browserPrimary, browserSecondary] },
      true
    );

    expect(browserCustomerDisplayPosition(info.screens[1])).toBe("x 1920, y 0");
    expect(browserCustomerDisplayWindowFeatures(info.screens[1])).toContain("left=1920");
    expect(browserCustomerDisplayWindowFeatures()).toContain("width=1200");
  });
});
