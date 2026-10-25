import { describe, expect, it } from "vitest";
import { visualEffectsTier, type VisualEffectsTierInput } from "./visual-effects-tier";

const desktop: VisualEffectsTierInput = {
  coarsePointer: false,
  htmlClasses: [],
  prefersReducedMotion: false,
  saveData: false,
};

describe("visualEffectsTier", () => {
  it("runs full effects on a desktop browser or Electron", () => {
    expect(visualEffectsTier(desktop)).toBe("full");
  });

  it("goes static for reduced motion, even on desktop", () => {
    expect(visualEffectsTier({ ...desktop, prefersReducedMotion: true })).toBe("static");
  });

  it("goes static on Swan 1 and on old Android WebViews", () => {
    expect(
      visualEffectsTier({ ...desktop, htmlClasses: ["capacitor-android", "swan1-legacy-colors"] }),
    ).toBe("static");
    expect(
      visualEffectsTier({ ...desktop, htmlClasses: ["capacitor-android", "android-webview-compat"] }),
    ).toBe("static");
  });

  it("keeps other Android devices, touch screens and data saver on the lite tier", () => {
    expect(visualEffectsTier({ ...desktop, htmlClasses: ["capacitor-android"] })).toBe("lite");
    expect(visualEffectsTier({ ...desktop, coarsePointer: true })).toBe("lite");
    expect(visualEffectsTier({ ...desktop, saveData: true })).toBe("lite");
  });
});
