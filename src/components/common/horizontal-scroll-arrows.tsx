"use client";

import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { prefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

interface HorizontalScrollState {
  hasOverflow: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
}

const INITIAL_SCROLL_STATE: HorizontalScrollState = {
  hasOverflow: false,
  canScrollLeft: false,
  canScrollRight: false,
};

/**
 * ปุ่มลูกศรซ้าย/ขวาสำหรับแถวที่เลื่อนแนวนอน (overflow-x-auto) — ไม่มีสิ่งนี้แล้ว mobile
 * browser ซ่อน scrollbar เป็นค่าเริ่มต้น ผู้ใช้จึงไม่รู้ว่ามีรายการเหลืออยู่นอกจอ เข้าใจผิดว่า
 * ปุ่ม/แท็บที่โดนตัดขอบ "หายไป" หรือ "ถูกบัง" ทั้งที่จริงแค่ต้องเลื่อนดู
 * ใช้ token กลางของแอป (bg-card/border-border) ต่างจาก public-pos ที่มีเวอร์ชัน yg-* ของตัวเอง
 */
export function HorizontalScrollArrows({
  scrollRef,
  className,
  onOverflowChange,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  className?: string;
  /** ให้ parent เผื่อ padding กันปุ่มลูกศรทับ item แรก/สุดท้ายได้ เฉพาะตอนที่ลูกศรโชว์จริง */
  onOverflowChange?: (hasOverflow: boolean) => void;
}) {
  const { t } = useTranslation();
  const [scrollState, setScrollState] =
    useState<HorizontalScrollState>(INITIAL_SCROLL_STATE);
  // เก็บ callback ล่าสุดไว้ใน ref แทนใส่ใน deps ของ effect — onOverflowChange มักเป็น
  // inline arrow function ที่ parent สร้างใหม่ทุก render ถ้าใส่ deps ตรงจะทำให้ effect
  // นี้ผูก/ถอด scroll listener ใหม่ทุก render โดยไม่จำเป็น
  const onOverflowChangeRef = useRef(onOverflowChange);
  useEffect(() => {
    onOverflowChangeRef.current = onOverflowChange;
  });
  // ค่า hasOverflow ล่าสุดที่แจ้ง parent ไปแล้ว — เทียบตรงนี้แทนเทียบใน updater ของ
  // setScrollState เพราะ React เรียก updater function ระหว่างขั้นตอน render ของ state
  // นั้นเอง เรียก setState ของ component อื่น (onOverflowChange) ซ้อนอยู่ข้างในจะโดน React
  // เตือน "Cannot update a component while rendering a different component"
  const notifiedOverflowRef = useRef(false);

  useEffect(() => {
    const rail = scrollRef.current;
    if (!rail) return;

    let frameId = 0;
    const updateScrollState = () => {
      frameId = 0;
      const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const nextState = {
        hasOverflow: maxScrollLeft > 2,
        canScrollLeft: rail.scrollLeft > 2,
        canScrollRight: rail.scrollLeft < maxScrollLeft - 2,
      };

      if (notifiedOverflowRef.current !== nextState.hasOverflow) {
        notifiedOverflowRef.current = nextState.hasOverflow;
        onOverflowChangeRef.current?.(nextState.hasOverflow);
      }

      setScrollState((current) =>
        current.hasOverflow === nextState.hasOverflow &&
        current.canScrollLeft === nextState.canScrollLeft &&
        current.canScrollRight === nextState.canScrollRight
          ? current
          : nextState
      );
    };
    const scheduleUpdate = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(updateScrollState);
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(rail);
    if (rail.firstElementChild)
      resizeObserver?.observe(rail.firstElementChild);
    rail.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      rail.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [scrollRef]);

  if (!scrollState.hasOverflow) return null;

  const scroll = (direction: -1 | 1) => {
    const rail = scrollRef.current;
    if (!rail) return;

    rail.scrollBy({
      left: direction * Math.max(180, Math.round(rail.clientWidth * 0.75)),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };
  const buttonClassName = cn(
    // inset-y-0 + my-auto แทน top-1/2 -translate-y-1/2 — Button ฐานมี active:translate-y-px
    // (เอฟเฟกต์ปุ่มยุบตอนกด) ทับ CSS var เดียวกับ -translate-y-1/2 ทำให้ปุ่มเด้งหลุดจากกึ่งกลาง
    // ลงมาครึ่งความสูงตอนคลิก ใช้ margin auto จัดกลางแทนเพื่อไม่ต้องแตะ transform เลย
    // scroll-arrow-button: ปิด tap highlight ของเบราว์เซอร์/WebView ผ่านกฎใน globals.css
    // (ไม่ใช้ Tailwind arbitrary property ตรงนี้เพราะ utility ของ Tailwind อยู่ใน
    // @layer utilities ส่วนกฎ -webkit-tap-highlight-color เริ่มต้นของทุกปุ่มใน
    // globals.css เป็น CSS เปล่าไม่มี @layer ครอบ — unlayered ชนะ layered เสมอไม่ว่า
    // specificity จะเท่าไหร่ ต้องแก้ที่ต้นตอเป็นกฎเปล่าเหมือนกันเท่านั้น) เพราะ
    // tap-highlight วาดเป็นสี่เหลี่ยมตามกรอบจริงของ element เสมอ ไม่มองตาม border-radius
    // เลย ปุ่มวงกลมนี้เลยเห็นเป็นกล่องเหลี่ยมตอนแตะ — ฟีดแบ็กตอนกดยังมีอยู่ครบจาก
    // hover:bg-primary/5 กับ active:translate-y-px ของ Button ฐาน
    "scroll-arrow-button absolute inset-y-0 z-10 my-auto size-9 rounded-full border border-border bg-card text-foreground shadow-md transition-[color,background-color,opacity] hover:border-primary/40 hover:bg-primary/5 disabled:opacity-0 motion-reduce:transition-none",
    className,
  );

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={cn(buttonClassName, "left-0")}
        aria-label={t("pos.scrollLeft")}
        disabled={!scrollState.canScrollLeft}
        onClick={() => scroll(-1)}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className={cn(buttonClassName, "right-0")}
        aria-label={t("pos.scrollRight")}
        disabled={!scrollState.canScrollRight}
        onClick={() => scroll(1)}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </>
  );
}
