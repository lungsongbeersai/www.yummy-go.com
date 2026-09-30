"use client"

import * as React from "react"

// A modal here is closed with its own buttons only. A click on the backdrop doesn't dismiss it; the
// dialog shakes instead, to say "use the buttons". Web Animations API rather than a CSS keyframe:
// the dialog's own open/close classes already own the CSS `animation` property, and this needs no
// new global CSS. Most browsers center with `translate`, leaving `transform` free for shaking.
// Swan 1's older WebView needs a transform-based centering fallback, so it uses the ring flash.
const SHAKE_ID = "dialog-shake"
const SHAKE_KEYFRAMES: Keyframe[] = [0, -10, 10, -8, 8, -4, 4, 0].map((x) => ({
  transform: `translateX(${x}px)`,
}))
// Reduced motion: no movement, a short ring flash on the dialog edge instead.
const FLASH_KEYFRAMES: Keyframe[] = [
  { boxShadow: "0 0 0 3px var(--ring)" },
  { boxShadow: "0 0 0 3px transparent" },
]

export function shakeDialog(element: HTMLElement | null) {
  if (!element || typeof element.animate !== "function") return
  element.getAnimations().forEach((animation) => {
    if (animation.id === SHAKE_ID) animation.cancel()
  })
  const reduceMotion =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.classList.contains("swan1-legacy-colors")
  const animation = element.animate(reduceMotion ? FLASH_KEYFRAMES : SHAKE_KEYFRAMES, {
    duration: reduceMotion ? 600 : 400,
    easing: "ease-in-out",
  })
  animation.id = SHAKE_ID
}

function assignRef<T>(ref: React.Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node)
  else if (ref) (ref as React.RefObject<T | null>).current = node
}

/** One ref callback that feeds both the caller's ref and our own. */
export function useMergedRef<T>(outer: React.Ref<T> | undefined, inner: React.Ref<T>) {
  return React.useCallback(
    (node: T | null) => {
      assignRef(outer, node)
      assignRef(inner, node)
    },
    [outer, inner]
  )
}
