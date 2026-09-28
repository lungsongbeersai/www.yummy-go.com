import { describe, expect, it } from "vitest";
import {
  LANDING_TOUR_FEATURE_STOPS,
  LANDING_TOUR_STOPS,
  tourIntroOpacity,
  tourPosition,
  tourProgressFromScroll,
  tourScrollTarget,
  tourSegment,
  tourStopIndex
} from "@/features/landing/landing-tour";
import { landingFeatures } from "@/features/landing/landing-data";

describe("landing tour", () => {
  it("only tours features that exist in landing-data", () => {
    const featureIds = new Set(landingFeatures.map((feature) => feature.id));
    expect(LANDING_TOUR_STOPS[0]).toBe("intro");
    for (const stop of LANDING_TOUR_FEATURE_STOPS) expect(featureIds.has(stop)).toBe(true);
  });

  it("maps scroll inside the pinned section to 0..1", () => {
    expect(tourProgressFromScroll(0, 0, 7000, 1000)).toBe(0);
    expect(tourProgressFromScroll(3000, 0, 7000, 1000)).toBe(0.5);
    expect(tourProgressFromScroll(9000, 0, 7000, 1000)).toBe(1);
    expect(tourProgressFromScroll(-50, 0, 7000, 1000)).toBe(0);
    expect(tourProgressFromScroll(500, 0, 800, 1000)).toBe(0);
  });

  it("switches the active stop halfway between stops", () => {
    expect(tourStopIndex(0, 6)).toBe(0);
    expect(tourStopIndex(0.09, 6)).toBe(0);
    expect(tourStopIndex(0.11, 6)).toBe(1);
    expect(tourStopIndex(1, 6)).toBe(5);
  });

  it("holds the camera at each stop before easing to the next", () => {
    expect(tourSegment(1.1, 6)).toEqual({ from: 1, to: 2, t: 0 });
    expect(tourSegment(1.5, 6).t).toBeCloseTo(0.5);
    expect(tourSegment(1.9, 6)).toEqual({ from: 1, to: 2, t: 1 });
    expect(tourSegment(5, 6)).toEqual({ from: 4, to: 5, t: 1 });
    expect(tourSegment(Number.NaN, 6)).toEqual({ from: 0, to: 1, t: 0 });
  });

  it("scrolls back to exactly the stop it was asked for", () => {
    const top = 120;
    const height = 7000;
    const viewport = 1000;
    for (let index = 0; index < 6; index++) {
      const target = tourScrollTarget(index, top, height, viewport, 6);
      expect(tourStopIndex(tourProgressFromScroll(target, top, height, viewport), 6)).toBe(index);
      expect(tourPosition(tourProgressFromScroll(target, top, height, viewport), 6)).toBeCloseTo(index, 2);
    }
  });

  it("fades the intro out before the first feature card", () => {
    expect(tourIntroOpacity(0, 6)).toBe(1);
    expect(tourIntroOpacity(0.2, 6)).toBe(0);
  });
});
