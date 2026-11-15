"use client";

import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import type { EmployeeWorkScope } from "@/services/pos";
import { employeeWorkSwipeScope } from "@/features/pos/employee-work/employee-work-swipe";

interface SwipeStart {
  id: number;
  x: number;
  y: number;
  scope: EmployeeWorkScope;
  horizontal: boolean;
}

export function useEmployeeWorkSwipe(scope: EmployeeWorkScope, onChange: (scope: EmployeeWorkScope) => void) {
  const start = useRef<SwipeStart | null>(null);
  const suppressClick = useRef(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [drag, setDrag] = useState({ scope, offset: 0, active: false });
  useEffect(() => () => clearTimeout(clickTimer.current), []);

  function reset() { start.current = null; setDrag({ scope, offset: 0, active: false }); }

  return {
    offset: drag.scope === scope ? drag.offset : 0,
    dragging: drag.scope === scope && drag.active,
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (!suppressClick.current) return;
      event.preventDefault(); event.stopPropagation(); suppressClick.current = false;
    },
    handlers: {
      onPointerDown(event: PointerEvent<HTMLDivElement>) {
        if (event.pointerType !== "touch") return;
        reset();
        if (!event.isPrimary) return;
        const target = event.target as Element;
        if (target.closest('input,textarea,select,a,[role="combobox"],[contenteditable="true"],[data-swipe-ignore]')) return;
        const button = target.closest("button");
        if (button && button.dataset.slot !== "accordion-trigger") return;
        const horizontal = target.closest<HTMLElement>('[data-slot="table-container"],[data-horizontal-scroll]');
        if (horizontal && horizontal.scrollWidth > horizontal.clientWidth + 2) return;
        start.current = { id: event.pointerId, x: event.clientX, y: event.clientY, scope, horizontal: false };
      },
      onPointerMove(event: PointerEvent<HTMLDivElement>) {
        const gesture = start.current;
        if (!gesture || gesture.id !== event.pointerId) return;
        if (gesture.scope !== scope) { reset(); return; }
        const x = event.clientX - gesture.x, y = event.clientY - gesture.y;
        if (!gesture.horizontal && Math.abs(y) > 12 && Math.abs(y) >= Math.abs(x)) { reset(); return; }
        if (!gesture.horizontal && Math.abs(x) > 12 && Math.abs(x) > Math.abs(y) * 1.5) {
          gesture.horizontal = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        if (gesture.horizontal) setDrag({ scope, offset: Math.max(-36, Math.min(36, x * 0.18)), active: true });
      },
      onPointerUp(event: PointerEvent<HTMLDivElement>) {
        const gesture = start.current;
        if (!gesture || gesture.id !== event.pointerId) return;
        if (gesture.horizontal) {
          suppressClick.current = true;
          clearTimeout(clickTimer.current);
          clickTimer.current = setTimeout(() => { suppressClick.current = false; }, 0);
          const next = gesture.scope === scope ? employeeWorkSwipeScope(scope, event.clientX - gesture.x, event.clientY - gesture.y) : null;
          if (next) onChange(next);
        }
        reset();
      },
      onPointerCancel: reset,
    },
  };
}
