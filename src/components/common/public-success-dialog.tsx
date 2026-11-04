"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PublicSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
}

export function PublicSuccessDialog({
  open,
  onOpenChange,
  message,
}: PublicSuccessDialogProps) {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const parentDialogRef = useRef<HTMLElement | null>(null);
  const dismiss = useEffectEvent(() => onOpenChange(false));

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(dismiss, 2500);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        showCloseButton={false}
        overlayClassName="z-60 bg-yg-ink/25 supports-backdrop-filter:backdrop-blur-none motion-reduce:animate-none"
        className="yg-shell z-61 max-h-[calc(100dvh-2rem)] max-w-[min(340px,calc(100%-2rem))] gap-4 overflow-y-auto rounded-3xl border border-yg-line bg-yg-bg2 p-5 font-yg-sans text-yg-ink shadow-xl motion-reduce:animate-none sm:max-w-[340px]"
        onOpenAutoFocus={(event) => {
          const target = document.activeElement;
          returnFocusRef.current =
            target instanceof HTMLElement &&
            target !== document.body &&
            !contentRef.current?.contains(target)
              ? target
              : null;
          parentDialogRef.current =
            Array.from(
              document.querySelectorAll<HTMLElement>(
                '[role="dialog"][data-state="open"]'
              )
            )
              .reverse()
              .find(
                (element) =>
                  element !== contentRef.current &&
                  element.getClientRects().length > 0
              ) ?? null;
          event.preventDefault();
          closeRef.current?.focus({ preventScroll: true });
        }}
        onCloseAutoFocus={(event) => {
          const opener = returnFocusRef.current;
          const parent = parentDialogRef.current;
          // Sending a request can replace its form with a history tab before this closes.
          const target =
            opener?.isConnected && opener.getClientRects().length > 0
              ? opener
              : parent?.isConnected && parent.dataset.state !== "closed"
              ? parent.querySelector<HTMLElement>(
                  '[role="tab"][aria-selected="true"]'
                ) ??
                parent.querySelector<HTMLElement>("button:not([disabled])") ??
                parent
              : null;
          if (target) {
            event.preventDefault();
            target.focus({ preventScroll: true });
          }
          returnFocusRef.current = parentDialogRef.current = null;
        }}
      >
        <DialogHeader className="flex-row items-start gap-3 text-left">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-yg-accent-soft text-yg-accent-strong motion-safe:animate-in motion-safe:zoom-in-75 motion-safe:duration-150"
          >
            <CircleCheck className="size-7" strokeWidth={1.8} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
            <DialogTitle className="lao-tone-text font-yg-sans text-base font-semibold text-yg-ink">
              {t("publicSuccess.title")}
            </DialogTitle>
            <DialogDescription className="lao-tone-text text-sm leading-6 text-yg-muted">
              {message}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogClose asChild>
          <Button
            ref={closeRef}
            className="lao-tone-text h-11 w-full rounded-xl bg-yg-accent text-sm font-medium text-yg-on-accent hover:bg-yg-accent-strong"
          >
            {t("publicSuccess.close")}
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
