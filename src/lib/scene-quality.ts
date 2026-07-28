// ระดับคุณภาพฉาก 3D ของหน้า landing — วางไว้ที่ lib เพราะ store (src/stores)
// ต้องใช้ type เดียวกับ feature โดยไม่ต้อง import ข้ามเข้า src/features
export type SceneTier = "low" | "medium" | "high" | "ultra";

// "auto" = ให้ระบบตรวจความแรงเครื่องแล้วเลือก tier ให้เอง
export type SceneQualitySetting = "auto" | SceneTier;

export const SCENE_TIERS = ["low", "medium", "high", "ultra"] as const satisfies readonly SceneTier[];

export const SCENE_QUALITY_SETTINGS = ["auto", ...SCENE_TIERS] as const;

export const DEFAULT_SCENE_QUALITY: SceneQualitySetting = "auto";

export function toSceneQualitySetting(value?: string | null): SceneQualitySetting {
  const normalized = String(value ?? "").toLowerCase();
  return SCENE_QUALITY_SETTINGS.find((setting) => setting === normalized) ?? DEFAULT_SCENE_QUALITY;
}
