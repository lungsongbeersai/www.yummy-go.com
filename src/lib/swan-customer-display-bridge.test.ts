import { describe, expect, it } from "vitest";
import { swanStatusToDisplayInfo } from "./swan-customer-display-bridge";

describe("swanStatusToDisplayInfo", () => {
  it("shows only the cashier display when HDMI is disconnected", () => {
    const info = swanStatusToDisplayInfo({
      supported: true,
      connected: false,
      primaryWidth: 1920,
      primaryHeight: 1080,
    });

    expect(info.hasSecondary).toBe(false);
    expect(info.activeCustomerDisplayId).toBeNull();
    expect(info.displays).toHaveLength(1);
    expect(info.primary.isPrimary).toBe(true);
  });

  it("marks the Swan HDMI screen active without marking the cashier screen active", () => {
    const info = swanStatusToDisplayInfo({
      supported: true,
      connected: true,
      active: true,
      displayId: 1,
      width: 1280,
      height: 800,
      label: "HDMI",
    });

    expect(info.hasSecondary).toBe(true);
    expect(info.activeCustomerDisplayId).toBe(1);
    expect(info.displays).toHaveLength(2);
    expect(info.displays[0]?.isActive).toBe(false);
    expect(info.displays[1]).toMatchObject({ id: 1, isPrimary: false, isActive: true, width: 1280, height: 800 });
  });
});
