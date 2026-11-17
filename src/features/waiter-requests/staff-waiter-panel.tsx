"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle, Bell, BellRing, Check, CheckCheck, Clock3,
  LoaderCircle, MessagesSquare, Receipt, RefreshCcw,
  Soup, Utensils, UtensilsCrossed, X,
} from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { WaiterRequest } from "@/services/waiter-requests";
import { useWaiterRequestsStore } from "@/stores/waiter-requests-store";
import { useOpenBillRequest } from "./use-open-bill-request";

interface StaffWaiterPanelProps {
  branch: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type RequestFilter = "all" | "waiting" | "inProgress";

const itemIcons = {
  bowl: Soup,
  spoon: Utensils,
  chopsticks: UtensilsCrossed,
  staff: BellRing,
};

export function StaffWaiterPanel({ branch, open, onOpenChange }: StaffWaiterPanelProps) {
  const { t } = useTranslation();
  const openBillRequest = useOpenBillRequest(branch, onOpenChange);
  const storedRows = useWaiterRequestsStore((state) => state.staffRequests);
  const key = useWaiterRequestsStore((state) => state.staffKey);
  const rows = key === branch ? storedRows : [];
  const load = useWaiterRequestsStore((state) => state.loadStaff);
  const handle = useWaiterRequestsStore((state) => state.handle);
  const busy = useWaiterRequestsStore((state) => state.handling);
  const error = useWaiterRequestsStore((state) => state.staffError);
  const loading = useWaiterRequestsStore((state) => state.staffLoading);
  const [filter, setFilter] = useState<RequestFilter>("all");
  const opener = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const followLatest = useRef(true);
  const refresh = useCallback(() => {
    if (branch) void load(branch);
  }, [branch, load]);
  const waitingCount = rows.filter((row) => row.status === 0).length;
  const progressCount = rows.filter((row) => row.status === 1).length;
  const visibleRows = rows
    .filter((row) => filter === "all" || row.status === (filter === "waiting" ? 0 : 1))
    .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
  const timelineVersion = visibleRows.map((row) => `${row.request_uuid}:${row.status}`).join("|");
  const filters = [
    { value: "all", count: rows.length },
    { value: "waiting", count: waitingCount },
    { value: "inProgress", count: progressCount },
  ] as const;

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      const element = scrollRef.current;
      if (element && followLatest.current) element.scrollTop = element.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, filter, timelineVersion]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-testid="staff-waiter-panel"
        showCloseButton={false}
        className="gap-0 overflow-hidden border-l-0 bg-background font-lao data-[side=right]:w-full data-[side=right]:sm:max-w-[520px]"
        onOpenAutoFocus={() => {
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          followLatest.current = true;
          setFilter("all");
        }}
        onCloseAutoFocus={(event) => {
          if (opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus();
          }
        }}
      >
        <SheetHeader className="shrink-0 bg-primary px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top,0px))] text-primary-foreground sm:px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-foreground/10">
                <MessagesSquare aria-hidden="true" className="size-4" />
              </span>
              <SheetTitle className="min-w-0 break-words text-lg font-bold text-primary-foreground">{t("waiter.chatTitle")}</SheetTitle>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 rounded-lg text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground focus-visible:ring-primary-foreground/70"
                disabled={loading}
                onClick={refresh}
                aria-label={t("actions.refresh")}
              >
                <RefreshCcw aria-hidden="true" className={cn("size-4", loading && "motion-safe:animate-spin")} />
              </Button>
              <SheetClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("actions.close")}
                  className="size-11 rounded-lg text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground focus-visible:ring-primary-foreground/70"
                >
                  <X aria-hidden="true" className="size-5" />
                </Button>
              </SheetClose>
            </div>
          </div>
          <SheetDescription className="sr-only">{t("waiter.panel.subtitle")}</SheetDescription>
        </SheetHeader>

        <Tabs
          value={filter}
          onValueChange={(value) => {
            if (value === "all" || value === "waiting" || value === "inProgress") {
              followLatest.current = true;
              setFilter(value);
            }
          }}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="shrink-0 border-b border-border px-3 py-2 sm:px-4">
            <TabsList aria-label={t("waiter.panel.filterLabel")} className="min-h-12 w-full rounded-lg p-0.5 group-data-horizontal/tabs:h-12">
              {filters.map((option) => (
                <TabsTrigger key={option.value} value={option.value} className="min-h-11 min-w-0 gap-1.5 rounded-md px-1.5 text-xs font-semibold text-muted-foreground data-active:shadow-sm">
                  <span className="min-w-0 whitespace-normal text-center leading-tight">{t(`waiter.panel.${option.value}`)}</span>
                  <span className="min-w-5 rounded bg-foreground/5 px-1 py-0.5 text-xs tabular-nums">{option.count}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent
            ref={scrollRef}
            value={filter}
            className="m-0 min-h-0 overflow-y-auto overscroll-y-contain bg-muted/40 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:px-4"
            onScroll={(event) => {
              const element = event.currentTarget;
              followLatest.current = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
            }}
          >
            {error ? (
              <Alert variant="destructive" className="mb-4 rounded-xl bg-background">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>{t("waiter.failed")}</AlertTitle>
              </Alert>
            ) : null}
            <span role="status" className="sr-only">{t("waiter.requestCount", { count: visibleRows.length })}</span>
            {loading && !rows.length ? (
              <div className="flex flex-col gap-3" aria-label={t("waiter.panel.loading")}>
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-36 w-full rounded-xl" />
              </div>
            ) : null}
            {!visibleRows.length && !loading && !error ? (
              <Empty className="min-h-64 border-0 px-5">
                <EmptyHeader className="gap-2">
                  <EmptyMedia variant="icon" className="size-14 rounded-full bg-primary/10 text-primary-text"><MessagesSquare className="size-6" /></EmptyMedia>
                  <EmptyTitle className="text-base">{t(rows.length ? "waiter.panel.emptyFilterTitle" : "waiter.panel.emptyTitle")}</EmptyTitle>
                  <EmptyDescription className="text-sm">{t(rows.length ? "waiter.panel.emptyFilterDescription" : "waiter.panel.emptyDescription")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
            <ol aria-label={t("waiter.panel.requests")} className="flex flex-col gap-3">
              {visibleRows.map((request) => (
                <li key={request.request_uuid}>
                  <StaffRequestMessage request={request} busy={busy} onHandle={handle} onOpenBill={openBillRequest} />
                </li>
              ))}
            </ol>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

interface StaffRequestMessageProps {
  request: WaiterRequest;
  busy: string;
  onHandle: (id: string, status: 1 | 2) => Promise<boolean>;
  onOpenBill: (request: WaiterRequest) => void;
}

function StaffRequestMessage({ request, busy, onHandle, onOpenBill }: StaffRequestMessageProps) {
  const { t, i18n } = useTranslation();
  const messageId = useId();
  const isBill = request.request_type === "bill";
  const RequestIcon = isBill ? Receipt : Bell;
  const requestTypeLabel = t(isBill ? "waiter.typeBill" : "waiter.typeStaff");
  const waiting = request.status === 0;
  const updating = busy === request.request_uuid;
  const tableName = i18n.language === "en"
    ? request.table_name_eng || request.table_name_la
    : request.table_name_la || request.table_name_eng;
  const canOpenBill = isBill && request.status !== 2 && Boolean(request.table_uuid.trim() && request.request_uuid.trim());
  const statusLabel = t(updating
    ? "waiter.panel.updating"
    : waiting ? "waiter.panel.waiting" : request.status === 1 ? "waiter.panel.inProgress" : "waiter.panel.completed");
  const messageBody = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 items-start gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary-text">
            <RequestIcon aria-hidden="true" className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span role="heading" aria-level={3} className="break-words text-base font-bold leading-snug [overflow-wrap:anywhere]">
              {t("nav.table")} · {tableName || t("nav.table")}
            </span>
            <span className="text-xs font-medium text-muted-foreground">{requestTypeLabel}</span>
          </span>
        </span>
        <Badge role="status" aria-atomic="true" className={cn(
          "h-auto min-h-6 max-w-[45%] shrink-0 gap-1 whitespace-normal rounded-md px-2 py-1 text-xs font-medium",
          updating ? "border-border bg-muted text-muted-foreground"
            : waiting ? "border-warning/20 bg-warning/10 text-warning-text"
              : "border-info/20 bg-info/10 text-info-text",
        )}>
          {updating ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /> : waiting ? <Clock3 aria-hidden="true" /> : <CheckCheck aria-hidden="true" />}
          {statusLabel}
        </Badge>
      </span>
      {request.message.trim() ? <span id={messageId} className="whitespace-pre-wrap break-words text-sm font-normal leading-relaxed [overflow-wrap:anywhere]">{request.message}</span> : null}
      {request.items.length ? (
        <span role="list" aria-label={t("waiter.panel.items")} className="flex flex-wrap gap-1.5">
          {request.items.map((item) => {
            const Icon = itemIcons[item.kind];
            return (
              <span role="listitem" key={item.kind} className="flex min-w-0 items-center gap-1.5 rounded-md border border-border/60 bg-muted/50 px-2 py-1.5 text-xs">
                <Icon aria-hidden="true" className="size-3.5 shrink-0 text-primary-text" />
                <span className="min-w-0 break-words font-medium">{t(`waiter.${item.kind}`)}</span>
                <span className="shrink-0 font-bold tabular-nums">×{item.qty}</span>
              </span>
            );
          })}
        </span>
      ) : null}
      <span className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        {isBill ? <span className="mr-auto inline-flex min-h-8 items-center rounded-md bg-primary px-2.5 text-sm font-semibold text-primary-foreground">{t("waiter.panel.openTable")}</span> : null}
        <time dateTime={request.created_at} className="text-xs font-normal tabular-nums text-muted-foreground">
          {new Date(request.created_at).toLocaleString(i18n.language === "en" ? "en-GB" : "lo-LA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </time>
      </span>
    </>
  );

  return (
    <article
      data-request-status={request.status}
      data-request-type={isBill ? "bill" : "staff"}
      aria-label={`${requestTypeLabel} · ${tableName || t("nav.table")}`}
      aria-busy={updating}
      className={cn("min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs", isBill ? "border-primary/30" : "border-border")}
    >
      {isBill ? (
        <Button
          type="button"
          variant="ghost"
          data-testid={`staff-bill-open-${request.request_uuid}`}
          aria-label={`${t("waiter.panel.openTable")} · ${tableName || t("nav.table")}`}
          aria-describedby={request.message.trim() ? messageId : undefined}
          disabled={!!busy || !canOpenBill}
          className="h-auto w-full min-w-0 flex-col items-stretch gap-2 whitespace-normal rounded-none p-3 text-left text-card-foreground hover:bg-primary/5 hover:text-card-foreground focus-visible:-outline-offset-2 focus-visible:ring-inset"
          onClick={() => onOpenBill(request)}
        >
          {messageBody}
        </Button>
      ) : (
        <div className="flex min-w-0 flex-col gap-2 p-3">{messageBody}</div>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-border/60 px-3 py-2">
        {!isBill && waiting ? (
          <Button type="button" className="h-auto min-h-11 min-w-0 flex-1 gap-1.5 whitespace-normal rounded-lg px-2.5 py-2 text-sm font-semibold" disabled={!!busy} onClick={() => void onHandle(request.request_uuid, 1)}>
            <Check aria-hidden="true" className="size-4" /><span className="min-w-0">{t("waiter.accept")}</span>
          </Button>
        ) : null}
        <Button type="button" variant={waiting || isBill ? "outline" : "default"} className={cn("h-auto min-h-11 min-w-0 gap-1.5 whitespace-normal rounded-lg px-2.5 py-2 text-sm font-semibold", !isBill && "flex-1")} disabled={!!busy} onClick={() => void onHandle(request.request_uuid, 2)}>
          <CheckCheck aria-hidden="true" className="size-4" /><span className="min-w-0">{t(isBill ? "waiter.billComplete" : "waiter.panel.completed")}</span>
        </Button>
      </div>
    </article>
  );
}
