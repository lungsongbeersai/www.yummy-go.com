"use client";

import { useEffect, useRef, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";

// คงสถานะ "กำลังโหลด" ไว้อย่างน้อย minMs เพื่อไม่ให้ spinner กะพริบตอนโหลดเร็วมาก
//
// state ตัวนี้มีความหมายว่า "ยังค้างไว้อยู่หลัง active จบแล้ว" เท่านั้น เพราะค่าที่คืน
// คือ active || holding อยู่แล้ว — เดิมตั้งชื่อว่า visible และ effect ต้องคอย setVisible(true)
// ระหว่างที่ active ซึ่งไม่จำเป็นและผิดกฎ set-state-in-effect ของ React 19
export function useMinimumVisibleLoading(active: boolean, minMs: number) {
  const [holding, setHolding] = useState(active);
  // ไม่อ่าน Date.now() ตอน render (impure) — effect ด้านล่างเป็นคนบันทึกเวลาเริ่ม
  const startedAtRef = useRef(0);

  // เริ่มโหลดรอบใหม่ = ตั้งธงค้างทันทีระหว่าง render ไม่ต้องรอ effect
  useResetOnChange(active, () => {
    if (active) setHolding(true);
  });

  // effect เหลือหน้าที่เดียว: จับเวลาปลดธงเมื่อครบเวลาขั้นต่ำ
  useEffect(() => {
    if (active) {
      startedAtRef.current = Date.now();
      return;
    }
    if (!holding) return;

    const remainingMs = Math.max(0, minMs - (Date.now() - startedAtRef.current));
    const timer = setTimeout(() => setHolding(false), remainingMs);

    return () => clearTimeout(timer);
  }, [active, holding, minMs]);

  return active || holding;
}
