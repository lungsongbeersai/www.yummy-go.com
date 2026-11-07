"use client";

import { CircleAlert, MessageCircle, MessageCircleMore } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { collectOrderAlerts } from "@/lib/pos/order-alerts";
import { usePosStore } from "@/stores/pos-store";
import { useAuthStore } from "@/stores/auth-store";
import { useWaiterRequestsStore } from "@/stores/waiter-requests-store";

export function StaffWaiterChatButton() {
  const { t } = useTranslation();
  const branch = useAuthStore((state) => state.user?.branch_uuid ?? "");
  const requests = useWaiterRequestsStore((state) => state.staffRequests);
  const zoneOptions = usePosStore((state) => state.zoneOptions);
  const key = useWaiterRequestsStore((state) => state.staffKey);
  const panelOpen = useWaiterRequestsStore((state) => state.staffPanelOpen);
  const setPanelOpen = useWaiterRequestsStore((state) => state.setStaffPanelOpen);
  const error = useWaiterRequestsStore((state) => state.staffError);
  const count = key === branch ? requests.length : 0;
  const hasPending = count > 0;
  const hasError = Boolean(error && key === branch);
  const hasNotice = collectOrderAlerts(zoneOptions).length > 0 ||
    (key === branch && requests.some((request) => request.status === 0));
  const animateNotice = hasNotice && !panelOpen && !hasError;

  if (!branch) return null;

  return (
    <div className="absolute bottom-4 right-4 z-30 max-w-[calc(100%_-_2rem)] sm:bottom-5 sm:right-5">
      <Button
        type="button"
        size="lg"
        variant="outline"
        aria-label={t("waiter.chatOpen", { count })}
        aria-haspopup="dialog"
        aria-expanded={panelOpen}
        data-pending-notice={animateNotice ? "true" : undefined}
        onClick={() => setPanelOpen(true)}
        className={cn(
          "h-14 max-w-full justify-start gap-3 rounded-full border-primary/20 bg-card pl-2 pr-4 font-lao text-card-foreground shadow-lg shadow-primary/10 ring-1 ring-primary/5 hover:bg-card hover:shadow-xl hover:shadow-primary/15 aria-expanded:bg-card aria-expanded:text-card-foreground dark:bg-card dark:hover:bg-card motion-safe:transition-[box-shadow,border-color,transform] motion-safe:hover:-translate-y-0.5 motion-reduce:transition-none",
          hasPending && "border-primary/35",
          animateNotice && "pos-pending-notice",
          hasError && "border-destructive/30"
        )}
      >
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary-text ring-1 ring-inset ring-primary/10", animateNotice && "text-current")}>
          {hasPending ? (
            <MessageCircleMore aria-hidden="true" className="size-5" />
          ) : (
            <MessageCircle aria-hidden="true" className="size-5" />
          )}
        </span>
        <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
          <span className="max-w-full truncate text-sm font-semibold leading-5">{t("waiter.chatTitle")}</span>
          {hasError ? (
            <span className="max-w-full truncate text-xs font-medium leading-4 text-destructive">{t("waiter.failed")}</span>
          ) : hasPending ? (
            <span className={cn("max-w-full truncate text-xs font-normal leading-4 text-muted-foreground", animateNotice && "text-current")}>
              {t("waiter.requestCount", { count })}
            </span>
          ) : null}
        </span>
        {hasPending ? (
          <Badge className={cn("ml-1 h-8 min-w-8 shrink-0 justify-center border-warning/20 bg-warning/10 px-2.5 text-sm font-semibold tabular-nums text-warning-text", animateNotice && "border-border bg-card text-card-foreground")}>
            {count > 99 ? "99+" : count}
          </Badge>
        ) : hasError ? (
          <CircleAlert aria-hidden="true" className="ml-1 size-4 text-destructive" />
        ) : null}
      </Button>
      <span role="status" className="sr-only">
        {hasError ? t("waiter.failed") : t("waiter.chatOpen", { count })}
      </span>
    </div>
  );
}
