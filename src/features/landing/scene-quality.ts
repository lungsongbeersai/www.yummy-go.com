import type { SceneQualitySetting, SceneTier } from "@/lib/scene-quality";

export {
  DEFAULT_SCENE_QUALITY,
  SCENE_QUALITY_SETTINGS,
  SCENE_TIERS,
  toSceneQualitySetting,
  type SceneQualitySetting,
  type SceneTier
} from "@/lib/scene-quality";


export interface SceneProfile {
  tier: SceneTier;
  /** เพดาน devicePixelRatio ของ tier นี้ (คุมความคมชัด) */
  maxDpr: number;
  /** งบพิกเซลรวมของ drawing buffer — กันจอ 4K/มือถือ 3x เรนเดอร์เกินตัว */
  maxPixels: number;
  /** MSAA เป็น context-creation parameter ของ WebGL เปลี่ยนกลางทางไม่ได้ ต้อง remount canvas */
  antialias: boolean;
  /** ขนาด shadow map (0 = ไม่มีเงาจริง ใช้เงาปลอมใต้วัตถุอย่างเดียว) — เรนเดอร์ครั้งเดียวตอนสร้างฉาก */
  shadowMapSize: number;
  /** true = วัสดุ Lambert + ไม่มี environment map (ถูกกว่า PBR ราวครึ่งต่อพิกเซล) */
  lite: boolean;
  stars: number;
  dust: number;
  /** เพดานเฟรมเรต (0 = ตามรีเฟรชจอ) — เครื่องอ่อนได้ 30fps ที่นิ่ง ดีกว่า 40–50fps ที่กระตุก */
  maxFps: number;
}

export interface DeviceCapability {
  /** navigator.hardwareConcurrency (0 = ไม่รู้) */
  hardwareConcurrency: number;
  /** navigator.deviceMemory หน่วย GB (0 = ไม่รู้ เช่น Safari/iOS) */
  deviceMemory: number;
  devicePixelRatio: number;
  viewportWidth: number;
  coarsePointer: boolean;
}

/**
 * งบของแต่ละ tier ตั้งจากพิกเซลจริงที่ต้องเรนเดอร์ ไม่ใช่จาก "มือถือ/เดสก์ท็อป"
 * ฉากนี้เป็นพื้นหลังเต็มจอที่วาดทุกเฟรม — งบเดิม (ultra 8.3MP = 4K native + bloom) คือต้นเหตุหลักที่กระตุก
 * - low     ~1MP    Lambert, ไม่มีเงา, 30fps
 * - medium  ~2MP    PBR + MSAA, ไม่มีเงาจริง
 * - high    ~3.5MP  + เงา 1024 (เรนเดอร์ครั้งเดียว ไม่ใช่ทุกเฟรม)
 * - ultra   ~6MP    + เงา 2048 — จอ 1440p/Retina ได้ native, 4K ลดสเกลลงเล็กน้อย
 */
export const SCENE_PROFILES = {
  low: {
    tier: "low",
    maxDpr: 1,
    maxPixels: 1_000_000,
    antialias: false,
    shadowMapSize: 0,
    lite: true,
    stars: 300,
    dust: 40,
    maxFps: 30
  },
  medium: {
    tier: "medium",
    maxDpr: 1.5,
    maxPixels: 2_000_000,
    antialias: true,
    shadowMapSize: 0,
    lite: false,
    stars: 600,
    dust: 70,
    maxFps: 60
  },
  high: {
    tier: "high",
    maxDpr: 2,
    maxPixels: 3_500_000,
    antialias: true,
    shadowMapSize: 1024,
    lite: false,
    stars: 900,
    dust: 110,
    maxFps: 0
  },
  ultra: {
    tier: "ultra",
    maxDpr: 2.5,
    maxPixels: 6_000_000,
    antialias: true,
    shadowMapSize: 2048,
    lite: false,
    stars: 1_400,
    dust: 160,
    maxFps: 0
  }
} as const satisfies Record<SceneTier, SceneProfile>;

/** ต่ำกว่านี้ภาพเละจนไม่ช่วยอะไร ยอมเฟรมตกดีกว่า */
export const MIN_SCENE_DPR = 0.5;

function scoreCores(cores: number): number {
  if (!Number.isFinite(cores) || cores <= 0) return 1;
  if (cores >= 16) return 3;
  if (cores >= 12) return 2.5;
  if (cores >= 8) return 2;
  if (cores >= 6) return 1.5;
  if (cores >= 4) return 1;
  if (cores >= 2) return 0.5;
  return 0;
}

function scoreMemory(memory: number): number {
  // Safari/iOS ไม่รายงาน deviceMemory เลย ให้คะแนนกลางแทนการลงโทษ
  if (!Number.isFinite(memory) || memory <= 0) return 1;
  if (memory >= 8) return 2;
  if (memory >= 6) return 1.5;
  if (memory >= 4) return 1;
  return -0.5;
}

function scoreDisplay(devicePixelRatio: number, viewportWidth: number): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  // จอ 3x แทบทั้งหมดคือมือถือเรือธง จึงใช้แทนสัญญาณ GPU ที่ web อ่านตรงๆ ไม่ได้
  const dprScore = dpr >= 3 ? 1.5 : dpr >= 2 ? 0.5 : 0;
  return dprScore + (viewportWidth >= 1920 ? 0.5 : 0);
}

export function scoreDeviceCapability(device: DeviceCapability): number {
  return (
    scoreCores(device.hardwareConcurrency) +
    scoreMemory(device.deviceMemory) +
    scoreDisplay(device.devicePixelRatio, device.viewportWidth) +
    (device.coarsePointer ? -0.5 : 0)
  );
}

export function detectAutoTier(device: DeviceCapability): SceneTier {
  const score = scoreDeviceCapability(device);
  const tier: SceneTier = score >= 5 ? "ultra" : score >= 3.5 ? "high" : score >= 2 ? "medium" : "low";

  // core/RAM ของมือถือสูงกว่าที่ GPU ตามทัน — Auto จึงไม่ดัน ultra ให้เอง (ผู้ใช้เลือกเองได้)
  return device.coarsePointer && tier === "ultra" ? "high" : tier;
}

export function resolveSceneTier(setting: SceneQualitySetting, device: DeviceCapability): SceneTier {
  return setting === "auto" ? detectAutoTier(device) : setting;
}

export function resolveSceneProfile(
  setting: SceneQualitySetting,
  device: DeviceCapability,
  reducedMotion: boolean
): SceneProfile | null {
  if (reducedMotion) return null;
  return SCENE_PROFILES[resolveSceneTier(setting, device)];
}

/**
 * DPR สุดท้ายที่ส่งให้ renderer — ต่ำสุดของ (DPR เครื่อง, เพดาน tier, งบพิกเซล) แล้วคูณ
 * renderScale ที่ adaptive mode ปรับให้ ไม่มีทางเกิน DPR จริงของเครื่อง
 */
export function calculateSceneDpr(
  viewportWidth: number,
  viewportHeight: number,
  deviceDpr: number,
  profile: SceneProfile,
  renderScale = 1
): number {
  const width = Math.max(1, viewportWidth);
  const height = Math.max(1, viewportHeight);
  const dpr = Number.isFinite(deviceDpr) && deviceDpr > 0 ? deviceDpr : 1;
  const scale = Number.isFinite(renderScale) && renderScale > 0 ? Math.min(1, renderScale) : 1;
  const budgetDpr = Math.sqrt(profile.maxPixels / (width * height));
  const scaled = Math.min(dpr, profile.maxDpr, budgetDpr) * scale;

  return Math.min(dpr, Math.max(MIN_SCENE_DPR, scaled));
}
