// คณิตของทัวร์ร้านอาหาร 3D ที่ขับด้วยสกรอลล์ — แยกจาก DOM/three ทั้งหมดเพื่อให้เทสต์ใน node ได้
//
// ทัวร์คือ section สูงหลายหน้าจอที่มีเนื้อหา sticky อยู่ข้างใน สกรอลล์ในช่วงนี้ = เลื่อนกล้องผ่านจุดต่าง ๆ
// ในร้าน (โต๊ะ → QR → ครัว → เคาน์เตอร์ → รายงาน) แต่ละจุดผูกกับฟีเจอร์จริงใน landing-data.ts

export const LANDING_TOUR_STOPS = ["intro", "tables", "qr", "print", "counter", "reports"] as const;

export type LandingTourStop = (typeof LANDING_TOUR_STOPS)[number];

/** จุดที่ไม่ใช่ intro = ฟีเจอร์ — ใช้ id เดียวกับ landingFeatures เพื่อดึงหัวข้อ/คำอธิบายจากที่เดียว */
export type LandingTourFeatureStop = Exclude<LandingTourStop, "intro">;

export const LANDING_TOUR_FEATURE_STOPS = LANDING_TOUR_STOPS.filter(
  (stop): stop is LandingTourFeatureStop => stop !== "intro"
);

/**
 * สัดส่วนของแต่ละช่วงที่กล้อง "ค้าง" อยู่ที่จุดหมาย ก่อนเริ่มเคลื่อนไปจุดถัดไป
 * ไม่มีช่วงค้าง = กล้องไหลตลอดเวลาจนอ่านการ์ดข้อความไม่ทัน
 */
export const TOUR_HOLD = 0.35;

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/** ความคืบหน้า 0..1 ของสกรอลล์ภายในทัวร์ (0 = หัว section แตะขอบบนจอ, 1 = sticky กำลังจะหลุด) */
export function tourProgressFromScroll(
  scrollY: number,
  tourTop: number,
  tourHeight: number,
  viewportHeight: number
): number {
  const scrollable = tourHeight - viewportHeight;
  if (scrollable <= 0) return 0;
  return clamp01((scrollY - tourTop) / scrollable);
}

/** ตำแหน่งต่อเนื่องบนแกนจุดทัวร์: 0 = จุดแรก, count-1 = จุดสุดท้าย */
export function tourPosition(progress: number, count = LANDING_TOUR_STOPS.length): number {
  return clamp01(progress) * Math.max(0, count - 1);
}

/** จุดที่ถือว่า "กำลังดู" อยู่ — เปลี่ยนการ์ดตรงกลางช่วงเคลื่อน ไม่ใช่ตอนเพิ่งเริ่มขยับ */
export function tourStopIndex(progress: number, count = LANDING_TOUR_STOPS.length): number {
  return Math.min(Math.max(0, count - 1), Math.round(tourPosition(progress, count)));
}

export interface TourSegment {
  from: number;
  to: number;
  /** 0..1 หลังหักช่วงค้างและ ease แล้ว — ใช้ผสมตำแหน่งกล้องระหว่าง from/to ได้เลย */
  t: number;
}

/**
 * แตกตำแหน่งต่อเนื่องเป็นช่วง from→to พร้อมค่าผสม
 * ครึ่งแรกของ TOUR_HOLD ค้างที่ from, ครึ่งหลังค้างที่ to ส่วนตรงกลางเคลื่อนแบบ smoothstep
 */
export function tourSegment(position: number, count = LANDING_TOUR_STOPS.length, hold = TOUR_HOLD): TourSegment {
  const last = Math.max(0, count - 1);
  const safe = Math.min(last, Math.max(0, Number.isFinite(position) ? position : 0));
  const from = Math.min(Math.floor(safe), Math.max(0, last - 1));
  const to = Math.min(last, from + 1);
  if (from === to) return { from, to, t: 0 };

  const fraction = safe - from;
  const halfHold = clamp01(hold) / 2;
  const moving = Math.max(0.0001, 1 - halfHold * 2);
  return { from, to, t: smoothstep((fraction - halfHold) / moving) };
}

/** scrollY ที่ทำให้ทัวร์ไปหยุดที่จุด index พอดี — ใช้กับปุ่มรางทัวร์และการคลิกวัตถุในฉาก */
export function tourScrollTarget(
  index: number,
  tourTop: number,
  tourHeight: number,
  viewportHeight: number,
  count = LANDING_TOUR_STOPS.length
): number {
  const last = Math.max(1, count - 1);
  const safeIndex = Math.min(last, Math.max(0, Math.round(index)));
  const scrollable = Math.max(0, tourHeight - viewportHeight);
  return Math.round(tourTop + (safeIndex / last) * scrollable);
}

/** เนื้อหา intro จางออกเร็วตอนเริ่มสกรอลล์ แล้วการ์ดฟีเจอร์ค่อยขึ้นแทน */
export function tourIntroOpacity(progress: number, count = LANDING_TOUR_STOPS.length): number {
  return 1 - smoothstep(tourPosition(progress, count) * 2.2);
}
