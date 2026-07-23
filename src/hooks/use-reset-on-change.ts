"use client";

import { useState } from "react";

const RESET_NOT_APPLIED = Symbol("reset-not-applied");

export interface UseResetOptions {
  runOnMount?: boolean;
}

// รีเซ็ต state ภายในเมื่อ "ตัวระบุ" ที่ผูกอยู่เปลี่ยน เช่น สลับเรคคอร์ด
// เปิด/ปิด dialog หรือข้อมูลจาก store ถูกโหลดใหม่
//
// resetKey อาจเป็นฟังก์ชันจาก useCallback ได้ จึงต้องห่อด้วย callback ตอนเก็บลง state
// ไม่เช่นนั้น React จะตีความฟังก์ชันเป็น lazy initializer หรือ state updaterแล้วเรียกทันที
export function useResetOnChange<K>(
  resetKey: K,
  reset: () => void,
  options: UseResetOptions = {},
) {
  const [appliedKey, setAppliedKey] = useState<K | typeof RESET_NOT_APPLIED>(
    () => options.runOnMount ? RESET_NOT_APPLIED : resetKey,
  );

  if (
    appliedKey !== RESET_NOT_APPLIED &&
    Object.is(appliedKey, resetKey)
  ) {
    return;
  }

  setAppliedKey(() => resetKey);
  reset();
}

// เหมือน useResetOnChange แต่เทียบหลายค่าแบบ dependency array ของ useEffect
// สมาชิกควรเป็น primitive หรือ stable reference จาก state/useMemo/useCallback
export function useResetOnDeps(
  deps: readonly unknown[],
  reset: () => void,
  options: UseResetOptions = {},
) {
  const [appliedDeps, setAppliedDeps] = useState<
    readonly unknown[] | typeof RESET_NOT_APPLIED
  >(
    () => options.runOnMount ? RESET_NOT_APPLIED : deps,
  );

  const changed =
    appliedDeps === RESET_NOT_APPLIED ||
    appliedDeps.length !== deps.length ||
    deps.some(
      (dependency, index) =>
        !Object.is(dependency, appliedDeps[index]),
    );

  if (!changed) {
    return;
  }

  setAppliedDeps(deps);
  reset();
}
