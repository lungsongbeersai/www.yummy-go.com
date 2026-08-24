import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function mobileStateFromWidth(
  width: number,
  fallback = false,
): boolean {
  if (!Number.isFinite(width) || width <= 0) {
    return fallback
  }

  return width < MOBILE_BREAKPOINT
}

export { MOBILE_BREAKPOINT }

function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
