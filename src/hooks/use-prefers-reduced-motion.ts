"use client";

import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// ผู้ใช้เปิด "ลดการเคลื่อนไหว" ในระบบปฏิบัติการหรือไม่
//
// อ่านผ่าน useSyncExternalStore แทนการเช็ค matchMedia ใน effect แล้ว setState
// ซึ่งผิดกฎ set-state-in-effect ของ React 19 — และยังได้ของแถมคือถ้าผู้ใช้สลับ
// การตั้งค่านี้ระหว่างใช้งาน หน้าจอจะตอบสนองทันทีโดยไม่ต้องรีเฟรช
// server snapshot คืน false เสมอเพราะฝั่ง server ไม่รู้ค่านี้
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false
  );
}
