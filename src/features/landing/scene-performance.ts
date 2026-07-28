// ตัวคุมจังหวะเฟรมของฉาก 3D — แยกจาก DOM ทั้งหมดเพื่อให้เทสต์ใน node ได้
// เฟรมเรตไม่ถูกล็อกแล้ว ปล่อยให้ requestAnimationFrame วิ่งตามรีเฟรชจริงของจอ (60/120/144Hz)

/** กันฉากกระโดดตอนสลับแท็บกลับมา — delta ที่ยาวกว่านี้ถือว่าเป็นช่วงหยุด ไม่ใช่ช่วงเคลื่อนไหว */
export const MAX_FRAME_DELTA_SECONDS = 0.05;

/** หน้าต่างเวลาที่ใช้สรุปค่า FPS หนึ่งครั้ง */
export const FPS_WINDOW_SECONDS = 0.5;

export const ADAPTIVE_SCALE_MIN = 0.6;
export const ADAPTIVE_FPS_FLOOR = 45;
export const ADAPTIVE_FPS_CEILING = 58;

const ADAPTIVE_STEP_DOWN = 0.85;
const ADAPTIVE_STEP_UP = 1.08;

export interface FrameDelta {
  frameTime: number;
  /** เวลาที่ clamp แล้ว ใช้ขับ animation */
  deltaSeconds: number;
  /** เวลาจริงที่ผ่านไป ใช้วัด FPS เท่านั้น */
  rawSeconds: number;
}

export interface FpsSample {
  frames: number;
  elapsedSeconds: number;
  /** ค่าที่สรุปได้ล่าสุด (0 = ยังวัดไม่ครบหน้าต่างแรก) */
  fps: number;
  /** true เฉพาะเฟรมที่เพิ่งปิดหน้าต่างวัดพอดี */
  settled: boolean;
}

export const EMPTY_FPS_SAMPLE: FpsSample = {
  frames: 0,
  elapsedSeconds: 0,
  fps: 0,
  settled: false
};

export function getFrameDelta(now: number, previousFrameTime: number | null): FrameDelta {
  if (previousFrameTime === null || now <= previousFrameTime) {
    return { frameTime: now, deltaSeconds: 0, rawSeconds: 0 };
  }

  const rawSeconds = (now - previousFrameTime) / 1_000;
  return {
    frameTime: now,
    deltaSeconds: Math.min(rawSeconds, MAX_FRAME_DELTA_SECONDS),
    rawSeconds
  };
}

export function pushFpsSample(
  sample: FpsSample,
  rawSeconds: number,
  windowSeconds = FPS_WINDOW_SECONDS
): FpsSample {
  const frames = sample.frames + 1;
  const elapsedSeconds = sample.elapsedSeconds + Math.max(0, rawSeconds);

  if (elapsedSeconds < Math.max(0.001, windowSeconds)) {
    return { frames, elapsedSeconds, fps: sample.fps, settled: false };
  }

  return {
    frames: 0,
    elapsedSeconds: 0,
    fps: Math.round(frames / elapsedSeconds),
    settled: true
  };
}

/**
 * ปรับ render scale ตาม FPS ที่วัดได้ (ใช้เฉพาะโหมด Auto)
 * ช่วง 45–58 คือแถบ hysteresis ไม่ปรับอะไร เพื่อไม่ให้ resize สลับไปมา
 */
export function getAdaptiveScale(currentScale: number, fps: number): number {
  const scale = Number.isFinite(currentScale) && currentScale > 0 ? Math.min(1, currentScale) : 1;
  if (!Number.isFinite(fps) || fps <= 0) return scale;

  if (fps < ADAPTIVE_FPS_FLOOR) {
    return roundScale(Math.max(ADAPTIVE_SCALE_MIN, scale * ADAPTIVE_STEP_DOWN));
  }
  if (fps > ADAPTIVE_FPS_CEILING && scale < 1) {
    return roundScale(Math.min(1, scale * ADAPTIVE_STEP_UP));
  }
  return scale;
}

// ปัดทศนิยมกัน float drift สะสมจนสั่งย่อ/ขยาย buffer ทั้งที่ค่าแทบไม่เปลี่ยน
function roundScale(scale: number): number {
  return Math.round(scale * 1_000) / 1_000;
}
