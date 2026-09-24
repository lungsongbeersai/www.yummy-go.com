// เสียงแจ้งเตือนออเดอร์ใหม่ที่เลือกได้ (ไฟล์อยู่ใน public/sounds) — id คือค่าที่เก็บใน
// app-store (localStorage) ห้ามเปลี่ยน id เดิม ไม่งั้นค่าที่ผู้ใช้เลือกไว้จะหลุดกลับเป็นค่าเริ่มต้น
export const ORDER_ALERT_SOUNDS = [
  { id: "default", src: "/sounds/orderNew1.mp3" },
  { id: "notification", src: "/sounds/universfield-new-notification-012-363675.mp3" },
  { id: "ding", src: "/sounds/freesound_community-ding-101492.mp3" },
  { id: "bell", src: "/sounds/freesound_community-bell-98033.mp3" },
  { id: "bellRing", src: "/sounds/universfield-bell-ring-123742.mp3" },
  { id: "openingBell", src: "/sounds/u_7xr5ffk4oq-opening-bell-421471.mp3" },
  { id: "churchBell", src: "/sounds/universfield-single-church-bell-156463.mp3" },
  { id: "cashRegister", src: "/sounds/freesound_community-cash-register-purchase-87313.mp3" },
  { id: "phone", src: "/sounds/soundreality-phone-ringtone-telephone-324474.mp3" }
] as const;

export type OrderAlertSoundId = (typeof ORDER_ALERT_SOUNDS)[number]["id"];

export const DEFAULT_ORDER_ALERT_SOUND: OrderAlertSoundId = "default";

export function isOrderAlertSoundId(value: unknown): value is OrderAlertSoundId {
  return ORDER_ALERT_SOUNDS.some((sound) => sound.id === value);
}

export function orderAlertSoundSrc(id: OrderAlertSoundId) {
  return (ORDER_ALERT_SOUNDS.find((sound) => sound.id === id) ?? ORDER_ALERT_SOUNDS[0]).src;
}
