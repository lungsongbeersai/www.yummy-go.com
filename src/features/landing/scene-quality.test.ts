import { describe, expect, it } from "vitest";
import {
  calculateSceneDpr,
  detectAutoTier,
  MIN_SCENE_DPR,
  resolveSceneProfile,
  resolveSceneTier,
  scoreDeviceCapability,
  SCENE_PROFILES,
  type DeviceCapability
} from "@/features/landing/scene-quality";
import { toSceneQualitySetting } from "@/lib/scene-quality";

const desktop: DeviceCapability = {
  hardwareConcurrency: 16,
  deviceMemory: 8,
  devicePixelRatio: 1,
  viewportWidth: 2_560,
  coarsePointer: false
};

const flagshipPhone: DeviceCapability = {
  hardwareConcurrency: 6,
  deviceMemory: 0, // Safari/iOS ไม่รายงานค่านี้
  devicePixelRatio: 3,
  viewportWidth: 393,
  coarsePointer: true
};

const budgetPhone: DeviceCapability = {
  hardwareConcurrency: 8,
  deviceMemory: 3,
  devicePixelRatio: 2,
  viewportWidth: 360,
  coarsePointer: true
};

const agingLaptop: DeviceCapability = {
  hardwareConcurrency: 4,
  deviceMemory: 4,
  devicePixelRatio: 1,
  viewportWidth: 1_366,
  coarsePointer: false
};

describe("SCENE_PROFILES", () => {
  it("keeps the agreed per-tier budgets", () => {
    expect(SCENE_PROFILES.low).toEqual({
      tier: "low",
      maxDpr: 1,
      maxPixels: 900_000,
      antialias: false,
      stars: 500,
      dust: 60
    });
    expect(SCENE_PROFILES.medium).toEqual({
      tier: "medium",
      maxDpr: 1.75,
      maxPixels: 2_200_000,
      antialias: false,
      stars: 1_100,
      dust: 130
    });
    expect(SCENE_PROFILES.high).toEqual({
      tier: "high",
      maxDpr: 2.5,
      maxPixels: 4_000_000,
      antialias: true,
      stars: 1_800,
      dust: 200
    });
    expect(SCENE_PROFILES.ultra).toEqual({
      tier: "ultra",
      maxDpr: 3,
      maxPixels: 8_300_000,
      antialias: true,
      stars: 3_000,
      dust: 320
    });
  });

  it("grows monotonically from low to ultra", () => {
    const tiers = [SCENE_PROFILES.low, SCENE_PROFILES.medium, SCENE_PROFILES.high, SCENE_PROFILES.ultra];
    for (let index = 1; index < tiers.length; index++) {
      expect(tiers[index].maxDpr).toBeGreaterThan(tiers[index - 1].maxDpr);
      expect(tiers[index].maxPixels).toBeGreaterThan(tiers[index - 1].maxPixels);
      expect(tiers[index].stars).toBeGreaterThan(tiers[index - 1].stars);
      expect(tiers[index].dust).toBeGreaterThan(tiers[index - 1].dust);
    }
  });
});

describe("detectAutoTier", () => {
  it("gives strong desktops the ultra budget", () => {
    expect(detectAutoTier(desktop)).toBe("ultra");
  });

  it("puts flagship phones on high instead of the old blurry mobile budget", () => {
    expect(detectAutoTier(flagshipPhone)).toBe("high");
  });

  it("drops budget phones to low", () => {
    expect(detectAutoTier(budgetPhone)).toBe("low");
  });

  it("keeps aging laptops on medium", () => {
    expect(detectAutoTier(agingLaptop)).toBe("medium");
  });

  it("never auto-selects ultra on touch devices, however high they score", () => {
    const overpoweredTablet: DeviceCapability = {
      hardwareConcurrency: 16,
      deviceMemory: 16,
      devicePixelRatio: 3,
      viewportWidth: 1_920,
      coarsePointer: true
    };
    expect(scoreDeviceCapability(overpoweredTablet)).toBeGreaterThanOrEqual(5);
    expect(detectAutoTier(overpoweredTablet)).toBe("high");
  });

  it("treats unknown cores and memory as mid-range instead of punishing them", () => {
    const unknown: DeviceCapability = {
      hardwareConcurrency: 0,
      deviceMemory: 0,
      devicePixelRatio: 1,
      viewportWidth: 1_280,
      coarsePointer: false
    };
    expect(detectAutoTier(unknown)).toBe("medium");
  });
});

describe("resolveSceneTier", () => {
  it("honours an explicit tier over device detection", () => {
    expect(resolveSceneTier("low", desktop)).toBe("low");
    expect(resolveSceneTier("ultra", budgetPhone)).toBe("ultra");
  });

  it("falls back to detection in auto mode", () => {
    expect(resolveSceneTier("auto", desktop)).toBe("ultra");
  });
});

describe("resolveSceneProfile", () => {
  it("disables the scene entirely for reduced motion", () => {
    expect(resolveSceneProfile("ultra", desktop, true)).toBeNull();
  });

  it("returns the profile of the resolved tier", () => {
    expect(resolveSceneProfile("auto", agingLaptop, false)).toEqual(SCENE_PROFILES.medium);
  });
});

describe("calculateSceneDpr", () => {
  it("renders a 3x phone at native DPR on ultra", () => {
    expect(calculateSceneDpr(393, 852, 3, SCENE_PROFILES.ultra)).toBe(3);
  });

  it("fixes the old blurry mobile output — high is far sharper than the previous 1.0 cap", () => {
    const high = calculateSceneDpr(393, 852, 3, SCENE_PROFILES.high);
    expect(high).toBe(2.5);
    expect(calculateSceneDpr(393, 852, 3, SCENE_PROFILES.medium)).toBe(1.75);
    expect(calculateSceneDpr(393, 852, 3, SCENE_PROFILES.low)).toBe(1);
  });

  it("renders 4K desktops at native DPR on ultra without exceeding the pixel budget", () => {
    const dpr = calculateSceneDpr(3_840, 2_160, 1, SCENE_PROFILES.ultra);
    expect(dpr).toBe(1);
    expect(3_840 * 2_160 * dpr ** 2).toBeLessThanOrEqual(SCENE_PROFILES.ultra.maxPixels);
  });

  it("keeps the pixel budget on oversized viewports", () => {
    const dpr = calculateSceneDpr(5_120, 2_880, 2, SCENE_PROFILES.high);
    expect(5_120 * 2_880 * dpr ** 2).toBeCloseTo(SCENE_PROFILES.high.maxPixels, 5);
  });

  it("never exceeds the real device DPR", () => {
    expect(calculateSceneDpr(1_920, 1_080, 1, SCENE_PROFILES.ultra)).toBe(1);
  });

  it("applies the adaptive render scale but never below the readable floor", () => {
    const full = calculateSceneDpr(1_920, 1_080, 2, SCENE_PROFILES.high);
    expect(calculateSceneDpr(1_920, 1_080, 2, SCENE_PROFILES.high, 0.5)).toBeCloseTo(full * 0.5, 5);
    expect(calculateSceneDpr(3_840, 2_160, 1, SCENE_PROFILES.low, 0.6)).toBe(MIN_SCENE_DPR);
  });

  it("ignores invalid inputs instead of producing NaN", () => {
    expect(calculateSceneDpr(0, 0, Number.NaN, SCENE_PROFILES.high)).toBeGreaterThan(0);
    const full = calculateSceneDpr(1_920, 1_080, 2, SCENE_PROFILES.high);
    expect(calculateSceneDpr(1_920, 1_080, 2, SCENE_PROFILES.high, Number.NaN)).toBe(full);
    expect(calculateSceneDpr(1_920, 1_080, 2, SCENE_PROFILES.high, 4)).toBe(full);
  });
});

describe("toSceneQualitySetting", () => {
  it("accepts every known setting and rejects anything else", () => {
    expect(toSceneQualitySetting("ultra")).toBe("ultra");
    expect(toSceneQualitySetting("LOW")).toBe("low");
    expect(toSceneQualitySetting("desktop")).toBe("auto");
    expect(toSceneQualitySetting(null)).toBe("auto");
    expect(toSceneQualitySetting(undefined)).toBe("auto");
  });
});
