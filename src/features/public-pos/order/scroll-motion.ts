import { CATEGORY_BOTTOM_ACTIVE_THRESHOLD_PX } from "@/features/public-pos/order/constants";
import type {
  RectSnapshot,
  ScrollJumpEdge,
} from "@/features/public-pos/order/types";

export function snapshotRect(rect: DOMRect | DOMRectReadOnly): RectSnapshot {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

export function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

export function getWindowMaxScrollY() {
  if (typeof window === "undefined" || typeof document === "undefined")
    return 0;

  const scrollingElement =
    document.scrollingElement ?? document.documentElement;
  return Math.max(0, scrollingElement.scrollHeight - window.innerHeight);
}

export function getScrollJumpEdgeFromViewport(): ScrollJumpEdge {
  if (typeof window === "undefined") return "bottom";
  return getWindowMaxScrollY() - window.scrollY <=
    CATEGORY_BOTTOM_ACTIVE_THRESHOLD_PX
    ? "top"
    : "bottom";
}
