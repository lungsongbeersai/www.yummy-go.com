import { describe, expect, it } from "vitest";
import {
  calculateSceneDpr,
  getFrameDecision,
  SCENE_PROFILES,
  selectSceneProfile
} from "@/features/landing/scene-quality";

describe("selectSceneProfile", () => {
  it("keeps the agreed performance limits", () => {
    expect(SCENE_PROFILES.desktop).toEqual({
      quality: "desktop",
      maxFps: 60,
      maxDpr: 1.25,
      maxPixels: 2_500_000,
      antialias: true,
      stars: 1_800,
      dust: 200
    });
    expect(SCENE_PROFILES.mobile).toEqual({
      quality: "mobile",
      maxFps: 30,
      maxDpr: 1,
      maxPixels: 1_000_000,
      antialias: false,
      stars: 600,
      dust: 80
    });
  });

  it("selects the desktop and mobile performance budgets", () => {
    expect(
      selectSceneProfile({ viewportWidth: 1440, coarsePointer: false, reducedMotion: false })
    ).toEqual(SCENE_PROFILES.desktop);
    expect(
      selectSceneProfile({ viewportWidth: 1440, coarsePointer: true, reducedMotion: false })
    ).toEqual(SCENE_PROFILES.mobile);
    expect(
      selectSceneProfile({ viewportWidth: 819, coarsePointer: false, reducedMotion: false })
    ).toEqual(SCENE_PROFILES.mobile);
  });

  it("disables the scene for reduced motion", () => {
    expect(
      selectSceneProfile({ viewportWidth: 1440, coarsePointer: false, reducedMotion: true })
    ).toBeNull();
  });
});

describe("calculateSceneDpr", () => {
  it("caps DPR by device, profile and pixel budget", () => {
    expect(calculateSceneDpr(1280, 720, 2, SCENE_PROFILES.desktop)).toBe(1.25);

    const budgetedDpr = calculateSceneDpr(3840, 2160, 2, SCENE_PROFILES.desktop);
    expect(budgetedDpr).toBeCloseTo(Math.sqrt(2_500_000 / (3840 * 2160)));
    expect(3840 * 2160 * budgetedDpr ** 2).toBeLessThanOrEqual(2_500_000.001);

    expect(calculateSceneDpr(390, 844, 3, SCENE_PROFILES.mobile)).toBe(1);
  });
});

describe("getFrameDecision", () => {
  it("caps desktop rendering at 60fps", () => {
    const first = getFrameDecision(1_000, null, 60);
    expect(first).toEqual({ shouldRender: true, frameTime: 1_000, deltaSeconds: 0 });
    expect(getFrameDecision(1_008, first.frameTime, 60).shouldRender).toBe(false);
    expect(getFrameDecision(1_017, first.frameTime, 60).shouldRender).toBe(true);
  });

  it("caps mobile rendering at 30fps and limits resume deltas", () => {
    expect(getFrameDecision(1_020, 1_000, 30).shouldRender).toBe(false);
    expect(getFrameDecision(1_034, 1_000, 30).shouldRender).toBe(true);
    expect(getFrameDecision(2_000, 1_000, 30).deltaSeconds).toBe(0.05);
    expect(getFrameDecision(2_000, null, 30).deltaSeconds).toBe(0);
  });
});
