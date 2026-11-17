"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle, ArrowRight, Bell, BellRing, Check, CheckCheck, Clock3,
  LoaderCircle, MessageSquareText, MessagesSquare, Receipt, RefreshCcw,
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
        <SheetHeader className="shrink-0 gap-3 bg-primary px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] text-primary-foreground sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full border border-primary-foreground/20 bg-primary-foreground/10">
                <MessagesSquare aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="mb-1 text-xs font-medium text-primary-foreground">{t("waiter.panel.eyebrow")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="text-xl font-bold tracking-tight text-primary-foreground">{t("waiter.chatTitle")}</SheetTitle>
                  <Badge className="h-6 min-w-6 border-primary-foreground/20 bg-primary-foreground px-2 text-xs font-semibold tabular-nums text-primary">{rows.length}</Badge>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground focus-visible:ring-primary-foreground/70"
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
                  className="size-11 rounded-xl text-primary-foreground/80 hover:bg-primary-foreground/15 hover:text-primary-foreground focus-visible:ring-primary-foreground/70"
                >
                  <X aria-hidden="true" className="size-5" />
                </Button>
              </SheetClose>
            </div>
          </div>
          <SheetDescription className="text-xs leading-relaxed text-primary-foreground">{t("waiter.panel.subtitle")}</SheetDescription>
        </SheetHeader>

        <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
          <Badge className="h-auto min-h-8 gap-2 whitespace-normal rounded-full border-warning/20 bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning-text">
            <BellRing aria-hidden="true" className="size-3.5 shrink-0" />
            {t("waiter.panel.waiting")} <span className="font-bold tabular-nums">{waitingCount}</span>
          </Badge>
          <Badge className="h-auto min-h-8 gap-2 whitespace-normal rounded-full border-info/20 bg-info/10 px-3 py-1.5 text-xs font-medium text-info-text">
            <CheckCheck aria-hidden="true" className="size-3.5 shrink-0" />
            {t("waiter.panel.inProgress")} <span className="font-bold tabular-nums">{progressCount}</span>
          </Badge>
        </div>

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
          <div className="shrink-0 border-b border-border px-4 pb-3 sm:px-5">
            <TabsList aria-label={t("waiter.panel.filterLabel")} className="min-h-13 w-full rounded-xl border border-border/60 p-1 group-data-horizontal/tabs:h-13">
              {filters.map((option) => (
                <TabsTrigger key={option.value} value={option.value} className="min-h-11 min-w-0 gap-1.5 rounded-lg px-2 text-xs font-semibold data-active:shadow-sm">
                  <span className="min-w-0 whitespace-normal text-center leading-tight">{t(`waiter.panel.${option.value}`)}</span>
                  <span className="min-w-5 rounded-md bg-foreground/5 px-1 py-0.5 text-2xs tabular-nums">{option.count}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent
            ref={scrollRef}
            value={filter}
            className="m-0 min-h-0 overflow-y-auto overscroll-y-contain bg-muted/40 p-4 sm:p-5"
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
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold text-muted-foreground">{t("waiter.chat.timelineLabel")}</h2>
              <span role="status" className="text-xs tabular-nums text-muted-foreground">{t("waiter.requestCount", { count: visibleRows.length })}</span>
            </div>
            {loading && !rows.length ? (
              <div className="flex flex-col gap-3" aria-label={t("waiter.panel.loading")}>
                <Skeleton className="h-36 w-5/6 rounded-2xl rounded-tl-sm" />
                <Skeleton className="ml-auto h-16 w-2/3 rounded-2xl rounded-tr-sm" />
                <Skeleton className="h-32 w-5/6 rounded-2xl rounded-tl-sm" />
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
            <ol aria-label={t("waiter.chat.timelineLabel")} className="flex flex-col gap-6">
              {visibleRows.map((request) => (
                <li key={request.request_uuid}>
                  <StaffRequestMessage request={request} busy={busy} onHandle={handle} onOpenBill={openBillRequest} />
                </li>
              ))}
            </ol>
          </TabsContent>
        </Tabs>
        <div className="flex shrink-0 items-start gap-2 border-t border-border bg-background px-4 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] pt-3.5 sm:px-5">
          <MessageSquareText aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-text" />
          <p className="text-xs leading-relaxed text-muted-foreground">{t("waiter.panel.footer")}</p>
        </div>
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
  const messageBody = (
    <>
      <span className="flex flex-wrap items-center gap-2">
        <Badge className={cn("h-auto min-h-6 max-w-full gap-1.5 whitespace-normal rounded-full border px-2 py-1 text-2xs", isBill ? "border-primary/20 bg-primary/10 text-primary-text" : "border-border bg-muted/50 text-muted-foreground")}>
          <RequestIcon aria-hidden="true" className="size-3.5 shrink-0" />{requestTypeLabel}
        </Badge>
        {waiting || updating ? (
          <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-2xs font-medium", updating ? "text-muted-foreground" : "text-warning-text")}>
            {updating ? <LoaderCircle aria-hidden="true" className="size-3.5 shrink-0 motion-safe:animate-spin" /> : <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />}
            {t(updating ? "waiter.panel.updating" : isBill ? "waiter.billStatus0" : "waiter.status0")}
          </span>
        ) : null}
      </span>
      {request.message.trim() ? <span id={messageId} className="whitespace-pre-wrap break-words text-sm font-normal leading-relaxed [overflow-wrap:anywhere]">{request.message}</span> : null}
      {request.items.length ? (
        <span role="list" aria-label={t("waiter.panel.items")} className="flex flex-wrap gap-1.5">
          {request.items.map((item) => {
            const Icon = itemIcons[item.kind];
            return (
              <span role="listitem" key={item.kind} className="flex min-w-0 items-center gap-1.5 rounded-xl border border-border/60 bg-muted/50 px-2.5 py-2 text-xs">
                <Icon aria-hidden="true" className="size-3.5 shrink-0 text-primary-text" />
                <span className="min-w-0 break-words font-medium">{t(`waiter.${item.kind}`)}</span>
                <span className="shrink-0 font-bold tabular-nums">×{item.qty}</span>
              </span>
            );
          })}
        </span>
      ) : null}
      <time dateTime={request.created_at} className="self-end text-2xs font-normal tabular-nums text-muted-foreground">
        {new Date(request.created_at).toLocaleString(i18n.language === "en" ? "en-GB" : "lo-LA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </time>
      {isBill ? <span className="flex items-center justify-between gap-2 border-t border-primary/15 pt-2 text-xs font-semibold text-primary-text"><span>{t("notifications.newOrderPopup.openTable")} · {tableName || t("nav.table")}</span><ArrowRight aria-hidden="true" className="size-4 shrink-0" /></span> : null}
    </>
  );

  return (
    <article
      data-request-status={request.status}
      data-request-type={isBill ? "bill" : "staff"}
      aria-label={`${requestTypeLabel} · ${tableName || t("nav.table")}`}
      aria-busy={updating}
      className="flex min-w-0 flex-col gap-3"
    >
      <div className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/15 bg-primary/10 text-primary-text">
          <MessagesSquare className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <h3 className="max-w-full break-words text-xs font-semibold text-muted-foreground">
            {t("nav.table")} · {tableName || t("nav.table")}
          </h3>
          {isBill ? (
            <Button
              type="button"
              variant="outline"
              data-testid={`staff-bill-open-${request.request_uuid}`}
              aria-label={`${t("notifications.newOrderPopup.openTable")} · ${tableName || t("nav.table")}`}
              aria-describedby={request.message.trim() ? messageId : undefined}
              disabled={!!busy || !canOpenBill}
              className="h-auto w-full min-w-0 flex-col items-stretch gap-3 whitespace-normal rounded-2xl rounded-tl-sm border-primary/25 bg-card p-3.5 text-left text-card-foreground shadow-sm hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-primary-text/30"
              onClick={() => onOpenBill(request)}
            >
              {messageBody}
            </Button>
          ) : (
            <div className="flex w-full min-w-0 flex-col gap-3 rounded-2xl rounded-tl-sm border border-border/70 bg-card p-3.5 text-card-foreground shadow-sm">{messageBody}</div>
          )}
        </div>
      </div>

      {!waiting ? (
        <div className="ml-11 flex max-w-[85%] flex-col items-end gap-1.5 self-end" role="status">
          <p className="text-2xs font-medium text-muted-foreground">{t("waiter.chat.staffLabel")}</p>
          <div className="flex items-start gap-2 rounded-2xl rounded-tr-sm bg-primary px-3.5 py-3 text-primary-foreground">
            <CheckCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p className="text-sm leading-relaxed">{t(`${isBill ? "waiter.billStatus" : "waiter.status"}${request.status}`)}</p>
          </div>
        </div>
      ) : null}

      <div className="ml-11 flex flex-wrap gap-2">
        {waiting || (isBill && request.status === 1) ? (
          <Button type="button" className="h-auto min-h-11 min-w-0 flex-1 gap-2 whitespace-normal rounded-xl px-3 py-2 text-xs font-semibold" disabled={!!busy || (isBill && !canOpenBill)} onClick={() => isBill ? onOpenBill(request) : void onHandle(request.request_uuid, 1)}>
            {isBill ? <Receipt aria-hidden="true" className="size-4" /> : <Check aria-hidden="true" className="size-4" />}<span className="min-w-0 flex-1">{t(isBill ? "notifications.newOrderPopup.openTable" : "waiter.accept")}</span><ArrowRight aria-hidden="true" className="ml-auto size-3.5" />
          </Button>
        ) : null}
        <Button type="button" variant={waiting ? "outline" : "default"} className="h-auto min-h-11 min-w-0 flex-1 gap-2 whitespace-normal rounded-xl px-3 py-2 text-xs font-semibold" disabled={!!busy} onClick={() => void onHandle(request.request_uuid, 2)}>
          <CheckCheck aria-hidden="true" className="size-4" /><span className="min-w-0 flex-1">{t(isBill ? "waiter.billComplete" : "waiter.complete")}</span>
        </Button>
      </div>
    </article>
  );
}
