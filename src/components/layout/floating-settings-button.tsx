"use client";

import { useEffect, useRef } from "react";
import { Palette } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AppearanceControls } from "@/components/layout/appearance-controls";
import { cn } from "@/lib/utils";
import { useAppStore, type FloatingButtonPosition } from "@/stores/app-store";

// ปุ่มขนาด size-11 (44px จาก Button) + ระยะขอบขั้นต่ำกันชนขอบจอ
const BUTTON_SIZE = 44;
const EDGE_MARGIN = 8;
const DRAG_THRESHOLD = 6;

// header เป็น sticky z-40 เท่ากับปุ่มนี้ แต่ render หลังปุ่มใน DOM ⇒ ทับปุ่มเสมอถ้าตำแหน่ง y ตกอยู่ใต้ header
// อ่านความสูงจริงจาก DOM แทนอ่านค่าคงที่ เพราะ --app-shell-header-height เปลี่ยนตาม breakpoint (78px/64px)
function headerBottom() {
  const header = document.querySelector(".app-header");
  return header ? header.getBoundingClientRect().bottom : 0;
}

function clampPosition({ x, y }: FloatingButtonPosition): FloatingButtonPosition {
  const minY = Math.max(EDGE_MARGIN, headerBottom() + EDGE_MARGIN);
  const maxX = Math.max(EDGE_MARGIN, window.innerWidth - BUTTON_SIZE - EDGE_MARGIN);
  const maxY = Math.max(minY, window.innerHeight - BUTTON_SIZE - EDGE_MARGIN);
  return {
    x: Math.min(Math.max(x, EDGE_MARGIN), maxX),
    y: Math.min(Math.max(y, minY), maxY)
  };
}

function useDraggableFloatingButton() {
  const storedPosition = useAppStore((state) => state.floatingButtonPosition);
  const setStoredPosition = useAppStore((state) => state.setFloatingButtonPosition);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const wasDraggingRef = useRef(false);
  // ตำแหน่งล่าสุดระหว่างลาก เขียนตรงลง DOM ผ่าน rAF แทนการ setState ทุก pointermove
  // (setState ทุกเฟรมทำให้ React re-render ตามไม่ทัน โดยเฉพาะบน Android WebView — คือสาเหตุที่ลากแล้วหน่วง/เบลอ)
  const latestPositionRef = useRef<FloatingButtonPosition | null>(null);
  const frameRef = useRef<number | null>(null);

  // ตำแหน่งที่เซฟไว้อาจอยู่นอกจอถ้าเปิดจากอุปกรณ์/ขนาดหน้าต่างอื่น — บีบให้อยู่ในขอบเขตอีกครั้งตอน mount และตอน resize
  useEffect(() => {
    function clampStoredPosition() {
      const current = useAppStore.getState().floatingButtonPosition;
      if (!current) return;
      const clamped = clampPosition(current);
      if (clamped.x !== current.x || clamped.y !== current.y) setStoredPosition(clamped);
    }
    clampStoredPosition();
    window.addEventListener("resize", clampStoredPosition);
    return () => window.removeEventListener("resize", clampStoredPosition);
  }, [setStoredPosition]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  function applyPosition(nextPosition: FloatingButtonPosition) {
    const button = buttonRef.current;
    if (!button) return;
    button.style.left = `${nextPosition.x}px`;
    button.style.top = `${nextPosition.y}px`;
    button.style.right = "auto";
  }

  function scheduleApply() {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      if (latestPositionRef.current) applyPosition(latestPositionRef.current);
    });
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top
    };
    // ผูกเป็นพิกัดสัมบูรณ์ก่อนขยับเฟรมแรก กันกระโดดตอนสลับจาก class เดิม (right/top-1/2) มาเป็น left/top จริง
    applyPosition({ x: rect.left, y: rect.top });
    buttonRef.current?.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!wasDraggingRef.current && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
    wasDraggingRef.current = true;
    latestPositionRef.current = clampPosition({
      x: Math.round(drag.originX + deltaX),
      y: Math.round(drag.originY + deltaY)
    });
    scheduleApply();
  }

  function handlePointerUp(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    buttonRef.current?.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (wasDraggingRef.current && latestPositionRef.current) {
      setStoredPosition(latestPositionRef.current);
    }
    latestPositionRef.current = null;
  }

  // กันไม่ให้ Popover เปิดตอนปล่อยเมาส์หลังลาก — ต้องเช็คหลัง pointerup เพราะ click ยิงทีหลังเสมอ
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (wasDraggingRef.current) {
      event.preventDefault();
      event.stopPropagation();
      wasDraggingRef.current = false;
    }
  }

  return { buttonRef, position: storedPosition, handlePointerDown, handlePointerMove, handlePointerUp, handleClick };
}

export function FloatingSettingsButton() {
  const { t } = useTranslation();
  const { buttonRef, position, handlePointerDown, handlePointerMove, handlePointerUp, handleClick } =
    useDraggableFloatingButton();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          ref={buttonRef}
          variant="default"
          size="icon"
          aria-label={t("app.appearance.openSettings")}
          className={cn(
            // transition-none ทับ transition-all ของ Button ฐาน — ไม่งั้นทุกครั้งที่ขยับ left/top
            // ระหว่างลากจะโดน ease ตาม transition แทนที่จะขยับตามนิ้วทันที (คือสาเหตุที่รู้สึกหน่วง/เบลอ)
            "fixed z-40 size-11 touch-none rounded-full shadow-lg transition-none",
            !position && "right-3 top-1/2 -translate-y-1/2"
          )}
          style={{
            // globals.css ตั้ง touch-action: manipulation ให้ทุก <button> แบบ unlayered ⇒
            // ชนะ utility class touch-none (อยู่ใน Tailwind layer) เสมอไม่ว่า specificity เท่าไหร่
            // ผลคือ Android เห็น pointerdown แล้วตีความ finger-move เป็น native scroll ทันที
            // ปุ่มเลยลากไม่ขยับ ต้องบังคับด้วย inline style ซึ่งชนะทุก external stylesheet
            touchAction: "none",
            ...(position ? { left: position.x, top: position.y } : null)
          }}
          onClick={handleClick}
          onPointerCancel={handlePointerUp}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <Palette />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="left" align="center" className="w-64">
        <PopoverTitle>{t("app.appearance.title")}</PopoverTitle>

        <AppearanceControls />
      </PopoverContent>
    </Popover>
  );
}
