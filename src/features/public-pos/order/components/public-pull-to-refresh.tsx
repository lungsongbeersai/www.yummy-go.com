"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { CircleAlert, CircleCheck, RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  PUBLIC_PULL_REFRESH_THRESHOLD,
  resolvePublicPullGesture,
} from "../pull-refresh-gesture";

type RefreshPhase =
  | "idle"
  | "pulling"
  | "armed"
  | "refreshing"
  | "success"
  | "error";
interface PublicPullToRefreshProps {
  scrollRef?: RefObject<HTMLElement | null>;
  // Store actions that swallow errors must reject here (or return false).
  onRefresh?: () => Promise<void | boolean>;
}

export function PublicPullToRefresh({
  scrollRef,
  onRefresh,
}: PublicPullToRefreshProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<RefreshPhase>("idle");
  const phaseRef = useRef<RefreshPhase>("idle");
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef<HTMLSpanElement | null>(null);
  const refreshCallback = useRef(onRefresh);
  const retryRef = useRef<(() => void) | null>(null);
  const dismissRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    refreshCallback.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const root = document.documentElement;
    const previousOverscroll = root.style.overscrollBehaviorY;
    if (!scrollRef) root.style.overscrollBehaviorY = "contain";
    let active = true,
      busy = false;
    let frame: number | null = null;
    let timer: number | undefined;
    let distance = 0;
    let returnFocus: HTMLElement | null = null;
    let gesture: { id: number; x: number; y: number; distance: number } | null =
      null;
    const updatePhase = (next: RefreshPhase) => {
      if (!active || phaseRef.current === next) return;
      phaseRef.current = next;
      setPhase(next);
    };
    const paint = (nextDistance: number) => {
      distance = nextDistance;
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        if (!feedbackRef.current) return;
        feedbackRef.current.style.opacity =
          phaseRef.current === "idle" ? "0" : "1";
        feedbackRef.current.style.transform = `translate3d(0, ${
          distance * 0.25
        }px, 0)`;
        if (rotationRef.current)
          rotationRef.current.style.transform = `rotate(${
            (distance / PUBLIC_PULL_REFRESH_THRESHOLD) * 180
          }deg)`;
      });
    };
    const clearDismissTimer = () => {
      window.clearTimeout(timer);
      timer = undefined;
    };
    const dismiss = () => {
      clearDismissTimer();
      if (feedbackRef.current?.contains(document.activeElement)) {
        if (
          returnFocus?.isConnected &&
          returnFocus.getClientRects().length > 0 &&
          !feedbackRef.current.contains(returnFocus)
        )
          returnFocus.focus({ preventScroll: true });
        else if (scrollRef?.current)
          scrollRef.current.focus({ preventScroll: true });
        else
          document
            .querySelector<HTMLButtonElement>("header button")
            ?.focus({ preventScroll: true });
      }
      updatePhase("idle");
      paint(0);
    };
    const finish = (next: "success" | "error") => {
      if (!active) return;
      busy = false;
      updatePhase(next);
      paint(0);
      if (next === "success") timer = window.setTimeout(dismiss, 2500);
    };
    const refresh = () => {
      if (busy || !active) return;
      busy = true;
      clearDismissTimer();
      if (
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== document.body &&
        !feedbackRef.current?.contains(document.activeElement)
      )
        returnFocus = document.activeElement;
      updatePhase("refreshing");
      paint(PUBLIC_PULL_REFRESH_THRESHOLD);
      const callback = refreshCallback.current;
      if (!callback) {
        // Legacy callers navigate immediately and never claim a refresh succeeded.
        window.location.reload();
        return;
      }
      try {
        // Start the real request in the release event, without a loading-delay timer.
        void callback().then(
          (result) => finish(result === false ? "error" : "success"),
          () => finish("error")
        );
      } catch {
        finish("error");
      }
    };
    const cancel = () => {
      gesture = null;
      if (phaseRef.current === "pulling" || phaseRef.current === "armed")
        dismiss();
    };
    const scrollTop = () =>
      scrollRef?.current?.scrollTop ??
      document.scrollingElement?.scrollTop ??
      0;
    const start = (event: TouchEvent) => {
      cancel();
      if (busy || event.touches.length !== 1 || scrollTop() > 0) return;
      if (
        scrollRef &&
        (!(event.target instanceof Node) ||
          !scrollRef.current?.contains(event.target))
      )
        return;
      if (event.target instanceof Element) {
        if (
          event.target.closest(
            "[data-public-pull-refresh], input, textarea, select, a, [contenteditable=true]"
          )
        )
          return;
        if (
          !scrollRef &&
          event.target.closest(
            '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-vaul-drawer], button'
          )
        )
          return;
        for (
          let node: Element | null = event.target;
          node && node !== (scrollRef?.current ?? document.body);
          node = node.parentElement
        ) {
          const style = getComputedStyle(node);
          if (
            (node.scrollTop > 0 && /auto|scroll/.test(style.overflowY)) ||
            (node.scrollWidth > node.clientWidth &&
              /auto|scroll/.test(style.overflowX))
          )
            return;
        }
      }
      const touch = event.touches[0];
      gesture = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        distance: 0,
      };
    };
    const move = (event: TouchEvent) => {
      const current = gesture;
      if (!current) return;
      const touch = event.touches[0];
      if (!touch || touch.identifier !== current.id || scrollTop() > 0) {
        cancel();
        return;
      }
      const result = resolvePublicPullGesture(
        touch.clientX - current.x,
        touch.clientY - current.y,
        event.touches.length
      );
      if (result.kind === "cancel") {
        cancel();
        return;
      }
      if (result.kind === "pending") {
        // Pulling back to the origin disarms a previously long drag.
        current.distance = 0;
        if (phaseRef.current === "pulling" || phaseRef.current === "armed") {
          updatePhase("idle");
          paint(0);
        }
        return;
      }
      if (event.cancelable) event.preventDefault();
      clearDismissTimer();
      current.distance = result.distance;
      updatePhase(result.armed ? "armed" : "pulling");
      paint(result.distance);
    };
    const end = (event: TouchEvent) => {
      const current = gesture;
      gesture = null;
      if (
        !current ||
        event.touches.length ||
        current.distance < PUBLIC_PULL_REFRESH_THRESHOLD ||
        busy
      ) {
        if (phaseRef.current === "pulling" || phaseRef.current === "armed")
          dismiss();
        return;
      }
      refresh();
    };
    retryRef.current = refresh;
    dismissRef.current = dismiss;
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", end, { passive: true });
    window.addEventListener("touchcancel", cancel, { passive: true });
    return () => {
      active = false;
      gesture = null;
      clearDismissTimer();
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (!scrollRef) root.style.overscrollBehaviorY = previousOverscroll;
      retryRef.current = dismissRef.current = null;
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", cancel);
    };
  }, [scrollRef]);

  const terminal = phase === "success" || phase === "error";
  const label =
    phase === "refreshing"
      ? "pos.publicRefreshing"
      : phase === "success"
      ? "pos.publicRefreshed"
      : phase === "error"
      ? "pos.publicRefreshFailed"
      : phase === "armed"
      ? "waiter.releaseRefresh"
      : "waiter.pullRefresh";
  return (
    <div
      data-public-pull-refresh
      data-refresh-state={phase}
      data-refreshing={phase === "refreshing"}
      aria-hidden={phase === "idle"}
      className={
        scrollRef
          ? "yg-shell pointer-events-none sticky top-0 z-10 flex h-0 items-start justify-center"
          : "yg-shell pointer-events-none fixed inset-x-0 top-[calc(var(--yg-header-height,4.5rem)+0.5rem)] z-45 flex items-start justify-center px-3"
      }
    >
      <div
        ref={feedbackRef}
        role={phase === "error" ? "alert" : "status"}
        aria-live={phase === "error" ? "assertive" : "polite"}
        aria-atomic="true"
        className={`flex w-fit max-w-full items-center gap-2 rounded-2xl border border-yg-line bg-yg-bg2 px-2 py-1.5 font-yg-sans text-yg-ink opacity-0 shadow-lg ${
          phase === "idle"
            ? "invisible pointer-events-none"
            : "pointer-events-auto"
        } ${
          phase === "pulling" || phase === "armed"
            ? ""
            : "transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none"
        }`}
      >
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-yg-accent-soft text-yg-accent-strong"
        >
          {phase === "success" ? (
            <CircleCheck className="size-5" />
          ) : phase === "error" ? (
            <CircleAlert className="size-5" />
          ) : (
            <span ref={rotationRef} className="grid place-items-center">
              <RefreshCw
                className={
                  phase === "refreshing"
                    ? "size-5 motion-safe:animate-spin"
                    : "size-5"
                }
              />
            </span>
          )}
        </span>
        <span className="lao-tone-text min-w-0 flex-1 py-1 text-xs font-medium leading-5">
          {phase === "idle" ? "" : t(label)}
        </span>
        {phase === "error" ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("actions.tryAgain")}
            className="size-11 shrink-0 rounded-xl text-yg-accent-strong hover:bg-yg-panel-hover hover:text-yg-ink dark:hover:bg-yg-panel-hover dark:hover:text-yg-ink"
            onClick={() => retryRef.current?.()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
        {terminal ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("actions.close")}
            className="size-11 shrink-0 rounded-xl text-yg-muted hover:bg-yg-panel-hover hover:text-yg-ink dark:hover:bg-yg-panel-hover dark:hover:text-yg-ink"
            onClick={() => dismissRef.current?.()}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
