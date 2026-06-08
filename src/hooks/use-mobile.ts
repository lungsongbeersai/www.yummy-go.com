import * as React from "react";

export const MOBILE_BREAKPOINT = 768;

export function mobileStateFromWidth(
  width: number,
  fallback: boolean | null = null,
) {
  if (!Number.isFinite(width) || width <= 0) return fallback;
  return width < MOBILE_BREAKPOINT;
}

function viewportWidth() {
  const widths = [
    window.innerWidth,
    document.documentElement.clientWidth,
    window.visualViewport?.width,
  ];
  return widths.find(
    (width): width is number =>
      typeof width === "number" && Number.isFinite(width) && width > 0,
  ) ?? 0;
}

function currentMobileState() {
  if (document.visibilityState === "hidden") return null;
  return mobileStateFromWidth(viewportWidth());
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    let frame = 0;

    const update = () => {
      const nextState = currentMobileState();
      if (nextState !== null) setIsMobile(nextState);
    };

    const sync = () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (typeof window.requestAnimationFrame !== "function") {
        update();
        return;
      }
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    const syncWhenVisible = () => {
      if (document.visibilityState !== "hidden") sync();
    };

    sync();
    mediaQuery.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    document.addEventListener("visibilitychange", syncWhenVisible);
    window.visualViewport?.addEventListener("resize", sync);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      mediaQuery.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      window.visualViewport?.removeEventListener("resize", sync);
    };
  }, []);

  return isMobile;
}
