"use client";

import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { requestImmediateBackendProbe } from "@/stores/offline-transport-monitor";

/**
 * เหมือน window "online"/"offline" ที่ startBackendNetworkMonitor ฟังอยู่แล้ว
 * (offline-transport-monitor.ts) — เป็นแค่ hint ที่ไปกระตุ้นให้ probe backend
 * ทันที ไม่เคยเซ็ต network state ตรงๆ เอง เหตุผลเดียวกัน: สัญญาณวิทยุของเครื่อง
 * (มี/ไม่มี wifi) ไม่ได้แปลว่า backend เอื้อมถึงจริง แค่ทำให้รู้เร็วขึ้นว่าควร
 * เช็คใหม่ตอนไหน (เร็วกว่ารอรอบ poll ปกติที่ถี่สุดคือทุก 2 วิตอน CHECKING)
 *
 * @capacitor/network ทำงานบนเว็บได้ด้วย (ห่อ navigator.onLine ผ่าน NetworkWeb)
 * แต่ที่นี่ทำเฉพาะ native เพราะเว็บมี window "online"/"offline" อยู่แล้วครบ
 * ไม่ต้องมีสองระบบซ้ำกัน
 */
export function startNativeNetworkMonitor(): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};

  let cancelled = false;
  let removeListener: (() => void) | null = null;

  void Network.addListener("networkStatusChange", () => {
    requestImmediateBackendProbe();
  }).then((handle) => {
    if (cancelled) {
      void handle.remove();
      return;
    }
    removeListener = () => void handle.remove();
  });

  return () => {
    cancelled = true;
    removeListener?.();
  };
}
