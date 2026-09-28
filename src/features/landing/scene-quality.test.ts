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
      maxPixels: 1_000_000,
      antialias: false,
      shadowMapSize: 0,
      lite: true,
      stars: 300,
      dust: 40,
      maxFps: 30
    });
    expect(SCENE_PROFILES.medium).toEqual({
      tier: "medium",
      maxDpr: 1.5,
      maxPixels: 2_000_000,
      antialias: true,
      shadowMapSize: 0,
      lite: false,
      stars: 600,
      dust: 70,
      maxFps: 60
    });
    expect(SCENE_PROFILES.high).toEqual({
      tier: "high",
      maxDpr: 2,
      maxPixels: 3_500_000,
      antialias: true,
      shadowMapSize: 1024,
      lite: false,
      stars: 900,
      dust: 110,
      maxFps: 0
    });
    expect(SCENE_PROFILES.ultra).toEqual({
      tier: "ultra",
      maxDpr: 2.5,
      maxPixels: 6_000_000,
      antialias: true,
      shadowMapSize: 2048,
      lite: false,
      stars: 1_400,
      dust: 160,
      maxFps: 0
    });
  });

  it("grows monotonically from low to ultra", () => {
    const tiers = [SCENE_PROFILES.low, SCENE_PROFILES.medium, SCENE_PROFILES.high, SCENE_PROFILES.ultra];
    for (let index = 1; index < tiers.length; index++) {
      expect(tiers[index].maxDpr).toBeGreaterThan(tiers[index - 1].maxDpr);
      expect(tiers[index].maxPixels).toBeGreaterThan(tiers[index - 1].maxPixels);
      expect(tiers[index].stars).toBeGreaterThan(tiers[index - 1].stars);
      expect(tiers[index].dust).toBeGreaterThan(tiers[index - 1].dust);
      expect(tiers[index].shadowMapSize).toBeGreaterThanOrEqual(tiers[index - 1].shadowMapSize);
    }
  });

  it("keeps real shadows and the frame cap off the tiers that cannot afford them", () => {
    expect(SCENE_PROFILES.low.shadowMapSize).toBe(0);
    expect(SCENE_PROFILES.medium.shadowMapSize).toBe(0);
    expect(SCENE_PROFILES.high.shadowMapSize).toBeGreaterThan(0);
    expect(SCENE_PROFILES.low.lite).toBe(true);
    expect(SCENE_PROFILES.low.maxFps).toBe(30);
    expect(SCENE_PROFILES.ultra.maxFps).toBe(0);
  });

  it("never renders a full-screen background above ~6MP, even on ultra", () => {
    for (const profile of Object.values(SCENE_PROFILES)) {
      expect(profile.maxPixels).toBeLessThanOrEqual(6_000_000);
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
  it("caps a 3x phone at the tier DPR instead of rendering 9x the pixels", () => {
    expect(calculateSceneDpr(393, 852, 3, SCENE_PROFILES.ultra)).toBe(2.5);
    expect(calculateSceneDpr(393, 852, 3, SCENE_PROFILES.high)).toBe(2);
    expect(calculateSceneDpr(393, 852, 3, SCENE_PROFILES.medium)).toBe(1.5);
    expect(calculateSceneDpr(393, 852, 3, SCENE_PROFILES.low)).toBe(1);
  });

  it("renders 1440p at native DPR on ultra and scales 4K just under native", () => {
    expect(calculateSceneDpr(2_560, 1_440, 1, SCENE_PROFILES.ultra)).toBe(1);
    const dpr = calculateSceneDpr(3_840, 2_160, 1, SCENE_PROFILES.ultra);
    expect(dpr).toBeLessThan(1);
    expect(dpr).toBeGreaterThan(0.8);
    expect(3_840 * 2_160 * dpr ** 2).toBeLessThanOrEqual(SCENE_PROFILES.ultra.maxPixels + 1);
  });

  it("keeps the pixel budget on oversized viewports", () => {
    const dpr = calculateSceneDpr(3_840, 2_160, 2, SCENE_PROFILES.high);
    expect(3_840 * 2_160 * dpr ** 2).toBeCloseTo(SCENE_PROFILES.high.maxPixels, 5);
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
