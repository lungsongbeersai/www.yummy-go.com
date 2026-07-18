"use client";

import { useState } from "react";

// รีเซ็ต state ภายในเมื่อ "ตัวระบุ" ที่ผูกอยู่เปลี่ยน — เช่น สลับเรคคอร์ดที่กำลังแก้ไข
// เปิด/ปิด dialog หรือข้อมูลจาก store ถูกโหลดใหม่
//
// เดิมโค้ดทั่วโปรเจกต์ใช้ useEffect(() => { setA(...); setB(...) }, [dep]) ซึ่งทำให้
// ผู้ใช้เห็นค่าเก่าแวบหนึ่งก่อน effect จะทำงาน และผิดกฎ react-hooks (set-state-in-effect)
// ของ React 19 / Next 16 เพราะทำให้เกิด cascading render
//
// วิธีนี้คือแนวทางที่ React แนะนำโดยตรงสำหรับ "ปรับ state เมื่อ prop เปลี่ยน":
// เทียบ key ระหว่าง render แล้ว setState ทันที React จะ re-render ใหม่ให้เลยโดยไม่
// commit DOM ของรอบที่ค่ายังเก่า จึงไม่มีจังหวะกะพริบ
// https://react.dev/learn/you-might-not-need-an-effect
//
// resetKey เทียบด้วย Object.is จึงใช้ได้ทั้ง string key และ identity ของ array/object
export function useResetOnChange<K>(resetKey: K, reset: () => void) {
  const [appliedKey, setAppliedKey] = useState<K>(resetKey);

  if (!Object.is(appliedKey, resetKey)) {
    setAppliedKey(resetKey);
    reset();
  }
}

// เหมือน useResetOnChange แต่เทียบหลายค่าแบบ dependency array ของ useEffect
// (แยกฟังก์ชันเพื่อไม่ให้กำกวมกับกรณีที่ตั้งใจส่ง array เป็น identity key ตรง ๆ)
export function useResetOnDeps(deps: unknown[], reset: () => void) {
  const [applied, setApplied] = useState(deps);
  const changed =
    applied.length !== deps.length || deps.some((dep, index) => !Object.is(dep, applied[index]));

  if (changed) {
    setApplied(deps);
    reset();
  }
}
