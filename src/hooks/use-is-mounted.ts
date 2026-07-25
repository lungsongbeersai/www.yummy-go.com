"use client";

import { useSyncExternalStore } from "react";

// ค่าคงที่หลัง mount จึงไม่มี event ให้ subscribe — คืน unsubscribe เปล่า
const subscribe = () => () => {};

// true ตั้งแต่ render ฝั่ง client รอบแรกเป็นต้นไป, false ตอน server render
//
// ใช้แทนสำนวนเดิม useState(false) + useEffect(() => setMounted(true), [])
// ซึ่งผิดกฎ set-state-in-effect ของ React 19 และทำให้เกิด render รอบพิเศษเสมอ
// useSyncExternalStore ให้ผลเหมือนกันทุกประการโดย React จัดการ hydration ให้เอง
export function useIsMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
