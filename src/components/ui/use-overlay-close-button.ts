"use client"

import { useCallback, useRef, type UIEventHandler } from "react"

/** Keep the standard close target in view when the overlay itself scrolls.
 * Inner form scrollers do not move it and need no work here. */
export function useOverlayCloseButton(onScroll?: UIEventHandler<HTMLDivElement>) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const handleScroll = useCallback<UIEventHandler<HTMLDivElement>>((event) => {
    if (event.target === event.currentTarget && closeButtonRef.current) {
      const offset = `${event.currentTarget.scrollTop}px`
      if (closeButtonRef.current.style.marginTop !== offset) closeButtonRef.current.style.marginTop = offset
    }
    onScroll?.(event)
  }, [onScroll])
  return { closeButtonRef, handleScroll }
}
