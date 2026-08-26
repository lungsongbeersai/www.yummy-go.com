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

    // เทียบกับความสูงตอน mount ไม่ใช่ window.innerHeight สด ๆ เพราะ AndroidManifest ตั้ง
    // adjustResize ⇒ ตอนคีย์บอร์ดขึ้น window หดตามไปด้วย ผลต่างจะเป็น ~0 และตรวจไม่เจอเลย
    // ยังต้องยืนยันบนเครื่องจริงอีกที เพราะ adjustResize/adjustPan ต่างกันตาม OEM
    const baseHeight = document.documentElement.clientHeight;

    // arrow ที่ผูกกับ const ทำให้ TS คง narrowing ของ viewport ไว้ ต่างจาก function declaration
    const sync = () => {
      const occluded = baseHeight - viewport.height;
      setVisible(occluded > baseHeight * KEYBOARD_MIN_HEIGHT_RATIO);
    };

    sync();
    viewport.addEventListener("resize", sync);
    return () => viewport.removeEventListener("resize", sync);
  }, []);

  return visible;
}
