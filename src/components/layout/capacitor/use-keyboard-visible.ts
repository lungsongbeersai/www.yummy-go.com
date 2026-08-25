"use client";

import { useEffect, useState } from "react";

// เกณฑ์นี้กัน false positive จากแถบ URL ที่ยุบ/ขยายบนมือถือ ซึ่งสูงไม่ถึงคีย์บอร์ดจริง
const KEYBOARD_MIN_HEIGHT_RATIO = 0.2;

// ไม่ใช้ @capacitor/keyboard เพราะ visualViewport ให้ข้อมูลเดียวกันโดยไม่ต้องเพิ่ม native plugin
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    function sync() {
      if (!viewport) return;
      const occluded = window.innerHeight - viewport.height;
      setVisible(occluded > window.innerHeight * KEYBOARD_MIN_HEIGHT_RATIO);
    }

    sync();
    viewport.addEventListener("resize", sync);
    return () => viewport.removeEventListener("resize", sync);
  }, []);

  return visible;
}
