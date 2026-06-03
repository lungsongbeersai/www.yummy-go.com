import { describe, expect, it } from "vitest";
import {
  activeCustomerDisplay,
  customerDisplayIdFromStorage,
  customerDisplayPosition,
  customerDisplayResolution,
  defaultCustomerDisplayId,
  displayIsConnected
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

  it("detects disconnected active and stored display ids", () => {
    const info = displayInfo({ activeCustomerDisplayId: 99 });
    expect(activeCustomerDisplay(info)).toBeNull();
    expect(displayIsConnected(info, 99)).toBe(false);
    expect(customerDisplayIdFromStorage("2")).toBe(2);
    expect(customerDisplayIdFromStorage("bad")).toBeNull();
  });
});
