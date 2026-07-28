import type { SceneTier } from "@/lib/scene-quality";

export interface SceneStats {
  /** FPS ที่วัดได้จริง (0 = ฉากหยุดอยู่) */
  fps: number;
  /** devicePixelRatio ที่ renderer ใช้อยู่จริง */
  dpr: number;
  tier: SceneTier;
  /** true เมื่ออยู่โหมด Auto ที่ปรับ renderScale ให้เองตามเฟรมเรต */
  adaptive: boolean;
  renderScale: number;
}

export interface SceneApi {
  onScroll: (heroProgress: number, totalProgress: number) => void;
  setActive: (active: boolean) => void;
  /** ระหว่างสกรอลล์ให้ข้าม bloom pass — เบราว์เซอร์ต้องใช้ GPU ไปกับ layout/composite ของหน้า */
  setScrolling: (scrolling: boolean) => void;
  pulse: () => void;
  dispose: () => void;
}
