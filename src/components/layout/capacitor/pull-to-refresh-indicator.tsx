import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function NativePullToRefreshIndicator({
  pullDistance,
  refreshing,
  threshold,
}: {
  pullDistance: number;
  refreshing: boolean;
  threshold: number;
}) {
  if (pullDistance <= 0 && !refreshing) return null;

  const progress = refreshing ? 1 : Math.min(pullDistance / threshold, 1);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center"
      style={{
        top: "calc(var(--app-shell-header-height) + env(safe-area-inset-top, 0px) + 8px)",
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
