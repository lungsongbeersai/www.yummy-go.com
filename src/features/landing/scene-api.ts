import type { SceneTier } from "@/lib/scene-quality";
import type { LandingTourFeatureStop } from "@/features/landing/landing-tour";

export interface SceneStats {
  /** FPS ที่วัดได้จริง (0 = ฉากหยุดอยู่) */
  fps: number;
  /** devicePixelRatio ที่ renderer ใช้อยู่จริง */
  dpr: number;
  tier: SceneTier;
  /** true เมื่ออยู่โหมด Auto ที่ปรับ renderScale ให้เองตามเฟรมเรต */
  adaptive: boolean;
  renderScale: number;
  /** draw call ของเฟรมล่าสุด — ตัวเลขนี้คือสิ่งที่บอกว่าฉากเบาหรือหนักจริง */
  drawCalls: number;
  triangles: number;
}

/** วัตถุในร้านที่เมาส์ชี้อยู่ — x/y เป็นพิกัดจอ (px) ของจุดยึดป้ายชื่อ */
export interface SceneHotspotEvent {
  stop: LandingTourFeatureStop;
  x: number;
  y: number;
  /** true = โต๊ะ (คลิกแล้วเปลี่ยนสถานะโต๊ะ) */
  table: boolean;
}

export interface SceneApi {
  /** tourProgress = 0..1 ภายใน section ทัวร์, totalProgress = 0..1 ของทั้งหน้า */
  onScroll: (tourProgress: number, totalProgress: number) => void;
  setActive: (active: boolean) => void;
  /** ระหว่างสกรอลล์ข้ามงานที่ไม่จำเป็น (raycast hover) — เบราว์เซอร์ต้องใช้เวลาไปกับ layout/composite ของหน้า */
  setScrolling: (scrolling: boolean) => void;
  pulse: () => void;
  dispose: () => void;
}
