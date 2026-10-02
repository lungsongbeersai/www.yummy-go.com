import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function NativePullToRefreshIndicator({
  pullDistance,
  refreshing,
  threshold,
  local = false,
}: {
  pullDistance: number;
  refreshing: boolean;
  threshold: number;
  local?: boolean;
}) {
  if (pullDistance <= 0 && !refreshing) return null;

  const progress = refreshing ? 1 : Math.min(pullDistance / threshold, 1);

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none inset-x-0 z-30 flex justify-center", local ? "absolute" : "fixed")}
      style={{
        top: local ? "8px" : "calc(var(--app-shell-header-height) + env(safe-area-inset-top, 0px) + 8px)",
        opacity: progress,
      }}
    >
      <div className="flex size-9 items-center justify-center rounded-full border border-border bg-card shadow-md">
        <RefreshCw
          className={cn("size-4 text-primary", refreshing && "animate-spin")}
          style={refreshing ? undefined : { transform: `rotate(${progress * 180}deg)` }}
        />
      </div>
    </div>
  );
}
