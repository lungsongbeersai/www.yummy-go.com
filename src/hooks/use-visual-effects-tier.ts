"use client";

import { useSyncExternalStore } from "react";
import { visualEffectsTier, type VisualEffectsTier } from "@/lib/visual-effects-tier";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const COARSE_POINTER_QUERY = "(pointer: coarse)";

interface NavigatorWithConnection extends Navigator {
  connection?: { saveData?: boolean };
}

function subscribe(onChange: () => void) {
  const queries = [REDUCED_MOTION_QUERY, COARSE_POINTER_QUERY].map((query) => window.matchMedia(query));
  queries.forEach((query) => query.addEventListener("change", onChange));
  return () => queries.forEach((query) => query.removeEventListener("change", onChange));
}

function getSnapshot(): VisualEffectsTier {
  return visualEffectsTier({
    coarsePointer: window.matchMedia(COARSE_POINTER_QUERY).matches,
    // Platform classes are applied by Providers on mount, before any protected screen renders.
    htmlClasses: Array.from(document.documentElement.classList),
    prefersReducedMotion: window.matchMedia(REDUCED_MOTION_QUERY).matches,
    saveData: Boolean((navigator as NavigatorWithConnection).connection?.saveData),
  });
}

// The server cannot know the device, so it renders the motionless tier.
function getServerSnapshot(): VisualEffectsTier {
  return "static";
}

export function useVisualEffectsTier() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
