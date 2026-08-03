"use client";

import { useEffect } from "react";
import type { PublicPosAccent } from "../types";

/** มิเรอร์สโคปธีม Nightfall ไปที่ <body>
 *
 *  Radix portal (sheet / dialog / tooltip) เรนเดอร์เป็นลูกของ document.body
 *  ซึ่งอยู่นอก <main> จึงไม่ได้รับทั้ง token --yg-* และตัวแปรฟอนต์ที่ผูกกับ shell
 *  วางสโคปไว้ที่ body ด้วย portal จึงสืบทอดได้ครบ
 *
 *  ต้องเป็น body ไม่ใช่ <html> เพราะคลาส .dark อยู่ที่ <html> เอง
 *  ตัวเลือก `:where(.dark) [data-yg-menu]` เป็น descendant combinator
 *  ถ้าไปวางที่ <html> มันจะไม่แมตช์ตัวเอง แล้ว portal จะได้ค่าโหมดสว่างทั้งที่หน้าเป็นโหมดมืด
 *
 *  <main> ยังถือ attribute ชุดเดียวกันไว้เอง เพื่อให้เนื้อหาหลักมีสไตล์ครบ
 *  ตั้งแต่เฟรมแรกโดยไม่ต้องรอ effect รอบนี้
 */
export function usePublicPosThemeScope(
  fontClassName: string,
  accent: PublicPosAccent,
) {
  useEffect(() => {
    const { body } = document;
    const fontClasses = fontClassName.split(" ").filter(Boolean);

    body.setAttribute("data-yg-menu", "");
    body.classList.add(...fontClasses);

    return () => {
      body.removeAttribute("data-yg-menu");
      body.classList.remove(...fontClasses);
    };
  }, [fontClassName]);

  // แยก effect ของ accent ออกมา เพราะเปลี่ยนได้ตลอดจาก popover
  // ถ้ารวมกับก้อนบน การสลับสีจะถอด/ใส่ attribute ทั้งชุดใหม่ทุกครั้ง
  useEffect(() => {
    document.body.setAttribute("data-yg-accent", accent);
    return () => {
      document.body.removeAttribute("data-yg-accent");
    };
  }, [accent]);
}
