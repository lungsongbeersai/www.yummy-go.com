"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { ModalScrollContext } from "@/components/ui/modal-scroll-context"

function Popover({
  modal,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  const withinModal = React.useContext(ModalScrollContext)
  const ownsScroll = modal ?? withinModal
  return (
    <ModalScrollContext.Provider value={withinModal || ownsScroll}>
      <PopoverPrimitive.Root data-slot="popover" modal={ownsScroll} {...props} />
    </ModalScrollContext.Provider>
  )
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  onWheel,
  onTouchMove,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        // Radix copies the resolved z-index onto its portal wrapper. WebView
        // 83 reports auto for a static content box, putting it under modals.
        className={cn(
          "relative z-50 flex max-h-[var(--radix-popover-content-available-height,calc(100dvh-1rem))] w-72 max-w-[calc(100vw-2rem)] origin-(--radix-popover-content-transform-origin) flex-col gap-4 overflow-y-auto overscroll-contain rounded-lg bg-popover p-2.5 text-xs text-popover-foreground shadow-xl ring-1 ring-border outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className
        )}
        {...props}
        // A portalled popover is outside a parent dialog's DOM scroll shard.
        // Keep its scroll gestures local, as the payment customer picker did.
        onWheel={(event) => {
          onWheel?.(event)
          event.stopPropagation()
        }}
        onTouchMove={(event) => {
          onTouchMove?.(event)
          event.stopPropagation()
        }}
      />
    </PopoverPrimitive.Portal>
  )
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-1 text-xs", className)}
      {...props}
    />
  )
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <div
      data-slot="popover-title"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  )
}

function PopoverDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="popover-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
}
