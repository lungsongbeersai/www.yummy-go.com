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
  stars: number;
  dust: number;
  /** ความแรง UnrealBloom (0 = ปิด) — ต้นฉบับใน Claude Design ใช้ 1.05 บนเดสก์ท็อป */
  bloom: number;
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
 * - low     ~0.9MP  กู้เครื่องอ่อน
 * - medium  ~2.2MP  โทรศัพท์ทั่วไปได้ DPR 1.75 (เดิมติดที่ 1.0 จึงเบลอ)
 * - high    ~4MP    โทรศัพท์ DPR 3 ได้ 2.5, จอ 1080p/Retina ได้ native
 * - ultra   ~8.3MP  = 4K พอดี → จอ 4K และมือถือ 3x เรนเดอร์ที่ native DPR ได้
 */
export const SCENE_PROFILES = {
  low: {
    tier: "low",
    maxDpr: 1,
    maxPixels: 900_000,
    antialias: false,
    stars: 500,
    dust: 60,
    bloom: 0
  },
  medium: {
    tier: "medium",
    maxDpr: 1.75,
    maxPixels: 2_200_000,
    antialias: false,
    stars: 1_100,
    dust: 130,
    bloom: 0
  },
  high: {
    tier: "high",
    maxDpr: 2.5,
    maxPixels: 4_000_000,
    antialias: true,
    stars: 1_800,
    dust: 200,
    bloom: 0.85
  },
  ultra: {
    tier: "ultra",
    maxDpr: 3,
    maxPixels: 8_300_000,
    antialias: true,
    stars: 3_000,
    dust: 320,
    bloom: 1.05
  }
} as const satisfies Record<SceneTier, SceneProfile>;

/** ค่า radius/threshold ของ UnrealBloom — ตรงกับต้นฉบับ scene3d.js ใน Claude Design */
export const BLOOM_RADIUS = 0.55;
export const BLOOM_THRESHOLD = 0.2;

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
