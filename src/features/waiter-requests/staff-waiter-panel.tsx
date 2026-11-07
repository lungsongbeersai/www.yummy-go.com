"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
import { createMutationUuid } from "@/lib/pos/mutation-identity";
import type { WaiterRequest } from "@/services/waiter-requests";
import { useWaiterRequestsStore } from "@/stores/waiter-requests-store";
import { useNavigationGuardStore } from "@/stores/navigation-guard-store";
import { billRequestOrderUrl } from "./bill-request-navigation";

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
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const runGuardedNavigation = useNavigationGuardStore((state) => state.run);
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
  const refresh = useCallback(() => {
    if (branch) void load(branch);
  }, [branch, load]);
  const waitingCount = rows.filter((row) => row.status === 0).length;
  const progressCount = rows.filter((row) => row.status === 1).length;
  const visibleRows = rows.filter((row) => filter === "all" || row.status === (filter === "waiting" ? 0 : 1));
  const filters = [
    { value: "all", count: rows.length },
    { value: "waiting", count: waitingCount },
    { value: "inProgress", count: progressCount },
  ] as const;

  function openBillRequest(request: WaiterRequest) {
    const target = billRequestOrderUrl(request, i18n.language, createMutationUuid());
    if (!target) return;
    runGuardedNavigation(() => {
      void (async () => {
        if (request.status === 0 && !await handle(request.request_uuid, 1)) return;
        if (useWaiterRequestsStore.getState().staffKey !== branch) return;
        onOpenChange(false);
        router.push(target);
      })();
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        data-testid="staff-waiter-panel"
        showCloseButton={false}
        className="gap-0 overflow-hidden border-l-0 bg-background font-lao data-[side=right]:w-full data-[side=right]:sm:max-w-[520px]"
        onOpenAutoFocus={() => {
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setFilter("all");
        }}
        onCloseAutoFocus={(event) => {
          if (opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus();
          }
        }}
      >
        <SheetHeader className="shrink-0 gap-4 bg-primary px-4 pb-5 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] text-primary-foreground sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 shadow-sm">
                <MessagesSquare aria-hidden="true" className="size-6" />
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
                aria-label={t("actions.tryAgain")}
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

        <div className="grid shrink-0 grid-cols-2 gap-3 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-warning/20 bg-warning/10 px-3 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning-text"><BellRing aria-hidden="true" className="size-5" /></span>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none tabular-nums text-warning-text">{waitingCount}</p>
              <p className="mt-1 break-words text-xs font-medium text-warning-text">{t("waiter.panel.waiting")}</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-info/20 bg-info/10 px-3 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-info/15 text-info-text"><CheckCheck aria-hidden="true" className="size-5" /></span>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none tabular-nums text-info-text">{progressCount}</p>
              <p className="mt-1 break-words text-xs font-medium text-info-text">{t("waiter.panel.inProgress")}</p>
            </div>
          </div>
        </div>

        <Tabs
          value={filter}
          onValueChange={(value) => {
            if (value === "all" || value === "waiting" || value === "inProgress") setFilter(value);
          }}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="shrink-0 border-b border-border px-4 pb-4 sm:px-5">
            <TabsList aria-label={t("waiter.panel.filterLabel")} className="min-h-13 w-full rounded-xl border border-border/60 p-1 group-data-horizontal/tabs:h-13">
              {filters.map((option) => (
                <TabsTrigger key={option.value} value={option.value} className="min-h-11 min-w-0 gap-1.5 rounded-lg px-2 text-xs font-semibold data-active:shadow-sm">
                  <span className="min-w-0 whitespace-normal text-center leading-tight">{t(`waiter.panel.${option.value}`)}</span>
                  <span className="min-w-5 rounded-md bg-foreground/5 px-1 py-0.5 text-2xs tabular-nums">{option.count}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value={filter} className="m-0 min-h-0 overflow-y-auto overscroll-y-contain bg-muted/40 p-4 sm:p-5">
            {error ? (
              <Alert variant="destructive" className="mb-4 rounded-xl bg-background">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>{t("waiter.failed")}</AlertTitle>
              </Alert>
            ) : null}
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold text-muted-foreground">{t("waiter.panel.requests")}</h2>
              <span className="text-xs tabular-nums text-muted-foreground">{t("waiter.requestCount", { count: visibleRows.length })}</span>
            </div>
            {loading && !rows.length ? (
              <div className="flex flex-col gap-3" aria-label={t("waiter.panel.loading")}>
                <Skeleton className="h-52 w-full rounded-2xl" />
                <Skeleton className="h-40 w-full rounded-2xl" />
              </div>
            ) : null}
            {!visibleRows.length && !loading && !error ? (
              <Empty className="min-h-64 rounded-2xl border border-border/70 bg-card px-5">
                <EmptyHeader className="gap-2">
                  <EmptyMedia variant="icon" className="size-14 rounded-2xl bg-primary/10 text-primary-text"><MessagesSquare className="size-6" /></EmptyMedia>
                  <EmptyTitle className="text-base">{t(rows.length ? "waiter.panel.emptyFilterTitle" : "waiter.panel.emptyTitle")}</EmptyTitle>
                  <EmptyDescription className="text-sm">{t(rows.length ? "waiter.panel.emptyFilterDescription" : "waiter.panel.emptyDescription")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
            <div className="flex flex-col gap-4">
              {visibleRows.map((request) => (
                <StaffRequestCard key={request.request_uuid} request={request} busy={busy} onHandle={handle} onOpenBill={openBillRequest} />
              ))}
            </div>
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

interface StaffRequestCardProps {
  request: WaiterRequest;
  busy: string;
  onHandle: (id: string, status: 1 | 2) => Promise<boolean>;
  onOpenBill: (request: WaiterRequest) => void;
}

function StaffRequestCard({ request, busy, onHandle, onOpenBill }: StaffRequestCardProps) {
  const { t, i18n } = useTranslation();
  const isBill = request.request_type === "bill";
  const RequestIcon = isBill ? Receipt : Bell;
  const requestTypeLabel = t(isBill ? "waiter.typeBill" : "waiter.typeStaff");
  const waiting = request.status === 0;
  const updating = busy === request.request_uuid;
  const tableName = i18n.language === "en"
    ? request.table_name_eng || request.table_name_la
    : request.table_name_la || request.table_name_eng;

  return (
    <article
      data-request-status={request.status}
      data-request-type={isBill ? "bill" : "staff"}
      aria-label={`${requestTypeLabel} · ${tableName || t("nav.table")}`}
      aria-busy={updating}
      className={cn("overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm", waiting ? "border-warning/25" : "border-info/25")}
    >
      <div aria-hidden="true" className={cn("h-1", waiting ? "bg-warning" : "bg-info")} />
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", waiting ? "bg-warning/10 text-warning-text" : "bg-info/10 text-info-text")}>
              <RequestIcon aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <Badge className={cn("mb-1 h-auto min-h-6 max-w-full whitespace-normal rounded-lg border px-2 py-1 text-2xs", isBill ? "border-primary/20 bg-primary/10 text-primary-text" : "border-border bg-muted/50 text-muted-foreground")}>
                {requestTypeLabel}
              </Badge>
              <p className="text-2xs font-medium text-muted-foreground">{t("nav.table")}</p>
              <h3 className="break-words text-lg font-bold leading-tight">{tableName || t("nav.table")}</h3>
            </div>
          </div>
          <div className="flex max-w-[48%] shrink-0 flex-col items-end gap-2">
            <Badge className={cn("h-auto min-h-6 gap-1.5 whitespace-normal border px-2 py-1 text-right text-2xs", waiting ? "border-warning/20 bg-warning/10 text-warning-text" : "border-info/20 bg-info/10 text-info-text")}>
              {updating ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /> : <span aria-hidden="true" className={cn("size-1.5 rounded-full", waiting ? "bg-warning" : "bg-info")} />}
              {t(updating ? "waiter.panel.updating" : `${isBill ? "waiter.billStatus" : "waiter.status"}${request.status}`)}
            </Badge>
            <time dateTime={request.created_at} className="flex items-center gap-1 text-2xs tabular-nums text-muted-foreground">
              <Clock3 aria-hidden="true" className="size-3" />
              {new Date(request.created_at).toLocaleTimeString(i18n.language === "en" ? "en-GB" : "lo-LA", { hour: "2-digit", minute: "2-digit" })}
            </time>
          </div>
        </div>
        {request.items.length ? (
          <div>
            <p className="mb-2 text-2xs font-medium text-muted-foreground">{t("waiter.panel.items")}</p>
            <div className="grid grid-cols-2 gap-2">
              {request.items.map((item) => {
                const Icon = itemIcons[item.kind];
                return (
                  <div key={item.kind} className="flex min-w-0 items-center gap-2 rounded-xl border border-border/60 bg-muted/50 px-2.5 py-2.5">
                    <Icon aria-hidden="true" className="size-4 shrink-0 text-primary-text" />
                    <span className="min-w-0 flex-1 break-words text-xs font-medium">{t(`waiter.${item.kind}`)}</span>
                    <span className="shrink-0 rounded-md bg-card px-1.5 py-0.5 text-xs font-bold tabular-nums">×{item.qty}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
        {request.message.trim() ? (
          <div className="rounded-xl border border-primary/10 bg-primary/5 p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold text-primary-text"><MessageSquareText aria-hidden="true" className="size-3.5" />{t("waiter.panel.customerMessage")}</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{request.message}</p>
          </div>
        ) : null}
      </div>
      <div className="flex gap-2 border-t border-border/70 bg-muted/25 px-4 py-3">
        {waiting || (isBill && request.status === 1) ? (
          <Button type="button" className="h-auto min-h-11 min-w-0 flex-1 gap-2 whitespace-normal rounded-xl px-3 py-2 text-xs font-semibold" disabled={!!busy || (isBill && !request.table_uuid.trim())} onClick={() => isBill ? onOpenBill(request) : void onHandle(request.request_uuid, 1)}>
            <Check aria-hidden="true" className="size-4" /><span className="min-w-0 flex-1">{t(isBill ? waiting ? "waiter.billAccept" : "notifications.newOrderPopup.openTable" : "waiter.accept")}</span><ArrowRight aria-hidden="true" className="ml-auto size-3.5" />
          </Button>
        ) : null}
        <Button type="button" variant={waiting ? "outline" : "default"} className="h-auto min-h-11 min-w-0 flex-1 gap-2 whitespace-normal rounded-xl px-3 py-2 text-xs font-semibold" disabled={!!busy} onClick={() => void onHandle(request.request_uuid, 2)}>
          <CheckCheck aria-hidden="true" className="size-4" /><span className="min-w-0 flex-1">{t(isBill ? "waiter.billComplete" : "waiter.complete")}</span>
        </Button>
      </div>
    </article>
  );
}
