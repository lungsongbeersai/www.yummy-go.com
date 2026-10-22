import {
  ANDROID_WEBVIEW_COMPAT_CLASS,
  CAPACITOR_ANDROID_CLASS,
  SWAN1_LEGACY_COLORS_CLASS,
} from "@/lib/android-webview-compat";

// How much decorative motion a screen may run on this device.
// - static: no entrance/roll/tween at all — Swan 1 and old Android WebViews (the renderer
//   thread is shared with taps, see the POS static-terminal rule in globals.css) and anyone
//   who asked the OS for reduced motion.
// - lite: short, unstaggered, compositor-only motion — other Capacitor Android devices,
//   touch-first screens, and data-saver users.
// - full: desktop browsers and Electron.
export type VisualEffectsTier = "static" | "lite" | "full";

export interface VisualEffectsTierInput {
  htmlClasses: readonly string[];
  prefersReducedMotion: boolean;
  coarsePointer: boolean;
  saveData: boolean;
}

export function visualEffectsTier(input: VisualEffectsTierInput): VisualEffectsTier {
  const classes = new Set(input.htmlClasses);
  if (
    input.prefersReducedMotion ||
    classes.has(SWAN1_LEGACY_COLORS_CLASS) ||
    classes.has(ANDROID_WEBVIEW_COMPAT_CLASS)
  ) {
    return "static";
  }
  if (classes.has(CAPACITOR_ANDROID_CLASS) || input.coarsePointer || input.saveData) {
    return "lite";
  }
  return "full";
}
