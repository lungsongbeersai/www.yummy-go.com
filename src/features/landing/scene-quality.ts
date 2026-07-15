export type SceneQuality = "desktop" | "mobile";

export interface SceneProfile {
  quality: SceneQuality;
  maxFps: number;
  maxDpr: number;
  maxPixels: number;
  antialias: boolean;
  stars: number;
  dust: number;
}

export interface SceneProfileInput {
  viewportWidth: number;
  coarsePointer: boolean;
  reducedMotion: boolean;
}

export interface FrameDecision {
  shouldRender: boolean;
  frameTime: number | null;
  deltaSeconds: number;
}

export const SCENE_PROFILES = {
  desktop: {
    quality: "desktop",
    maxFps: 60,
    maxDpr: 1.25,
    maxPixels: 2_500_000,
    antialias: true,
    stars: 1_800,
    dust: 200
  },
  mobile: {
    quality: "mobile",
    maxFps: 30,
    maxDpr: 1,
    maxPixels: 1_000_000,
    antialias: false,
    stars: 600,
    dust: 80
  }
} as const satisfies Record<SceneQuality, SceneProfile>;

export function selectSceneProfile({
  viewportWidth,
  coarsePointer,
  reducedMotion
}: SceneProfileInput): SceneProfile | null {
  if (reducedMotion) return null;
  return coarsePointer || viewportWidth < 820 ? SCENE_PROFILES.mobile : SCENE_PROFILES.desktop;
}

export function calculateSceneDpr(
  viewportWidth: number,
  viewportHeight: number,
  deviceDpr: number,
  profile: SceneProfile
): number {
  const width = Math.max(1, viewportWidth);
  const height = Math.max(1, viewportHeight);
  const dpr = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1;
  const budgetDpr = Math.sqrt(profile.maxPixels / (width * height));

  return Math.min(dpr, profile.maxDpr, budgetDpr);
}

export function getFrameDecision(
  now: number,
  previousFrameTime: number | null,
  maxFps: number
): FrameDecision {
  if (previousFrameTime === null || now <= previousFrameTime) {
    return { shouldRender: true, frameTime: now, deltaSeconds: 0 };
  }

  const frameInterval = 1_000 / Math.max(1, maxFps);
  const elapsed = now - previousFrameTime;
  if (elapsed < frameInterval) {
    return { shouldRender: false, frameTime: previousFrameTime, deltaSeconds: 0 };
  }

  return {
    shouldRender: true,
    frameTime: now - (elapsed % frameInterval),
    deltaSeconds: Math.min(elapsed / 1_000, 0.05)
  };
}
