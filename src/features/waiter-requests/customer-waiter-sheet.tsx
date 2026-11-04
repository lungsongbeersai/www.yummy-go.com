"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  CheckCircle2,
  Clock3,
  History,
  LoaderCircle,
  MessageSquareText,
  Minus,
  Plus,
  Receipt,
  RefreshCw,
  Send,
  Soup,
  Utensils,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { PublicSuccessDialog } from "@/components/common/public-success-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHandle,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { WaiterRequestType } from "@/services/waiter-requests";
import { useWaiterRequestsStore } from "@/stores/waiter-requests-store";
import { PublicPullToRefresh } from "@/features/public-pos/order/components/public-pull-to-refresh";
import {
  buildCustomerWaiterPayload,
  CUSTOMER_WAITER_KINDS,
  MAX_CUSTOMER_WAITER_MESSAGE,
  MAX_CUSTOMER_WAITER_QTY,
  findPendingBillRequest,
  resolveCustomerWaiterAttempt,
  type CustomerWaiterAttempt,
  type CustomerWaiterKind,
} from "./customer-waiter-payload";
import { useWaiterUpdates } from "./use-waiter-updates";

const itemIcons = { bowl: Soup, spoon: Utensils, chopsticks: UtensilsCrossed } satisfies Record<
  CustomerWaiterKind,
  typeof Soup
>;

// Customer-menu tokens also cover portals; the cashier's root .dark must not override them.
const TAB_TRIGGER_CLASS =
  "h-11 min-w-0 gap-2 rounded-xl px-2 text-sm text-yg-muted hover:text-yg-ink data-active:bg-yg-bg2 data-active:text-yg-accent-strong data-active:shadow-sm dark:text-yg-muted dark:hover:text-yg-ink dark:data-active:border-transparent dark:data-active:bg-yg-bg2 dark:data-active:text-yg-accent-strong";
const OUTLINE_ON_PANEL_CLASS =
  "border-yg-line bg-yg-bg2 text-yg-ink hover:bg-yg-panel-hover dark:border-yg-line dark:bg-yg-bg2 dark:hover:bg-yg-panel-hover";

type Status = 0 | 1 | 2;
const statusIcon: Record<Status, typeof Clock3> = { 0: Clock3, 1: Bell, 2: CheckCircle2 };
const statusClass: Record<Status, string> = {
  0: "border-yg-accent-line bg-yg-accent-soft text-yg-accent-strong",
  1: "border-transparent bg-yg-accent text-yg-on-accent",
  2: "border-yg-line bg-transparent text-yg-muted",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  branch: string;
  table: string;
  initialRequestType?: WaiterRequestType;
}

export function CustomerWaiterSheet({ open, onOpenChange, token, branch, table, initialRequestType }: Props) {
  const { t, i18n } = useTranslation();
  const choiceId = useId();
  const [tab, setTab] = useState<"send" | "history">("send");
  const [requestType, setRequestType] = useState<WaiterRequestType>(initialRequestType ?? "staff");
  const [quantities, setQuantities] = useState<Partial<Record<CustomerWaiterKind, number>>>({});
  const [notes, setNotes] = useState<Record<WaiterRequestType, string>>({ staff: "", bill: "" });
  const [sent, setSent] = useState(false);
  const [sentType, setSentType] = useState<WaiterRequestType>("staff");
  const requestAttempt = useRef<CustomerWaiterAttempt | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const historyScrollRef = useRef<HTMLDivElement | null>(null);

  const storedRequests = useWaiterRequestsStore((s) => s.publicRequests);
  const key = useWaiterRequestsStore((s) => s.publicKey);
  const requests = key === token ? storedRequests : [];
  const loading = useWaiterRequestsStore((s) => s.publicLoading);
  const billEnabled = useWaiterRequestsStore((s) => s.publicKey === token && s.publicBillRequestsEnabled);
  const sending = useWaiterRequestsStore((s) => s.sending);
  const error = useWaiterRequestsStore((s) => s.publicError);
  const load = useWaiterRequestsStore((s) => s.loadPublic);
  const send = useWaiterRequestsStore((s) => s.send);

  const refresh = useCallback(() => {
    if (open) void load(token);
  }, [load, open, token]);
  const refreshHistory = useCallback(() => load(token), [load, token]);
  useEffect(refresh, [refresh]);
  useWaiterUpdates(branch, refresh, table);

  const isBill = requestType === "bill";
  const note = notes[requestType];
  const pendingBill = findPendingBillRequest(requests);
  useEffect(() => {
    // A socket refresh can confirm a committed bill after its POST response was lost.
    // Once confirmed, a later explicit request after service needs a fresh UUID.
    if (isBill && pendingBill) requestAttempt.current = null;
  }, [isBill, pendingBill]);
  const payload = useMemo(() => buildCustomerWaiterPayload(
    quantities, note, t(isBill ? "waiter.billDefaultMessage" : "waiter.comeToTable"), requestType,
  ), [quantities, note, t, isBill, requestType]);
  const selectedCount = payload.items.reduce((sum, item) => sum + item.qty, 0);
  const hasDetails = selectedCount > 0 || Boolean(note.trim());
  const canSend = !sending && (!isBill || (billEnabled && !loading && !pendingBill));
  const pendingCount = requests.filter((request) => request.status !== 2).length;

  // ค่าที่ส่งเปลี่ยน = คำขอใหม่ (client_request_uuid ใหม่) — กดส่งซ้ำค่าเดิมยังใช้ id เดิม กันคำขอซ้ำ
  const dirty = () => {
    requestAttempt.current = null;
  };

  const changeQty = (kind: CustomerWaiterKind, delta: number) => {
    dirty();
    setQuantities((current) => ({
      ...current,
      [kind]: Math.min(MAX_CUSTOMER_WAITER_QTY, Math.max(0, (current[kind] ?? 0) + delta)),
    }));
  };

  const submit = async () => {
    if (!canSend) return;
    const attempt = resolveCustomerWaiterAttempt(payload, requestAttempt.current, () => crypto.randomUUID());
    requestAttempt.current = attempt;
    const ok = await send(token, {
      client_request_uuid: attempt.id,
      ...payload,
    });
    if (!ok) return;
    requestAttempt.current = null;
    if (!isBill) setQuantities({});
    setNotes((current) => ({ ...current, [requestType]: "" }));
    setSentType(requestType);
    setSent(true);
    // ส่งแล้วพาไปดูประวัติ ให้เห็นสถานะ "รอรับเรื่อง" ของคำขอที่เพิ่งส่ง
    setTab("history");
  };

  const formatTime = (value: string) =>
    new Date(value).toLocaleString(i18n.language === "en" ? "en-GB" : "lo-LA", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <>
      <PublicSuccessDialog open={sent} onOpenChange={setSent} message={t(sentType === "bill" ? "waiter.billSent" : "publicSuccess.waiter")} />
      <Drawer
        open={open}
        dismissible={!sending}
        handleOnly
        shouldScaleBackground={false}
        onOpenChange={(next) => {
          if (!sending) onOpenChange(next);
        }}
      >
        <DrawerContent
          aria-busy={sending}
          className="mx-auto flex h-[min(740px,92dvh)] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-t-3xl border border-b-0 border-yg-line bg-yg-bg2 p-0 font-yg-sans text-yg-ink shadow-xl before:hidden data-[vaul-drawer-direction=bottom]:max-h-[92dvh] [&>div:first-child]:hidden"
          onOpenAutoFocus={() => {
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            if (initialRequestType) {
              if (requestType !== initialRequestType) requestAttempt.current = null;
              setRequestType(initialRequestType);
              setTab(initialRequestType === "bill" && pendingBill ? "history" : "send");
            }
          }}
          onCloseAutoFocus={(event) => {
            if (opener.current?.isConnected) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
        >
          <DrawerHandle aria-label={t("actions.close")} className="my-0 grid h-11 w-full place-items-center rounded-none bg-transparent after:h-1 after:w-10 after:rounded-full after:bg-yg-divider" />

          <header className="flex shrink-0 items-start gap-3 px-4 pb-4 sm:px-5">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-yg-accent-line bg-yg-accent-soft text-yg-accent-strong">
              <Bell aria-hidden="true" className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="mb-1 text-[10px] font-semibold tracking-wide text-yg-accent-strong">{t("waiter.panel.eyebrow")}</p>
              <DrawerTitle className="text-xl font-bold leading-tight text-yg-ink">{t("waiter.serviceTitle")}</DrawerTitle>
              <DrawerDescription className="mt-1.5 text-sm leading-relaxed text-yg-muted">
                {t("waiter.serviceDescription")}
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("actions.close")}
                className="size-11 shrink-0 rounded-xl border border-yg-line bg-yg-bg2 text-yg-muted hover:bg-yg-panel-hover hover:text-yg-ink dark:hover:bg-yg-panel-hover"
                disabled={sending}
              >
                <X aria-hidden="true" />
              </Button>
            </DrawerClose>
          </header>

          {error ? (
            <Alert className="mx-4 mb-3 w-auto rounded-xl border-yg-accent-line bg-yg-accent-soft sm:mx-5">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-yg-ink">
                {t("waiter.failed")}
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("min-h-11 rounded-lg px-3", OUTLINE_ON_PANEL_CLASS)}
                  disabled={loading || sending}
                  onClick={refresh}
                >
                  {t("actions.tryAgain")}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value === "history" ? "history" : "send")}
            className="min-h-0 flex-1 gap-0 overflow-hidden"
          >
            <div className="shrink-0 border-b border-yg-line px-4 pb-4 sm:px-5">
              <TabsList aria-label={t("waiter.serviceTitle")} className="grid h-13 w-full grid-cols-2 rounded-2xl border border-yg-line bg-yg-accent-soft p-1 group-data-horizontal/tabs:h-13">
                <TabsTrigger value="send" className={TAB_TRIGGER_CLASS}>
                  <Send aria-hidden="true" className="size-4 shrink-0" />
                  <span className="min-w-0 whitespace-normal leading-tight">{t("waiter.sendTab")}</span>
                </TabsTrigger>
                <TabsTrigger value="history" className={TAB_TRIGGER_CLASS}>
                  <History aria-hidden="true" className="size-4 shrink-0" />
                  <span className="min-w-0 whitespace-normal leading-tight">{t("waiter.historyTab")}</span>
                  {pendingCount ? (
                    <Badge className="h-5 min-w-5 shrink-0 justify-center rounded-md bg-yg-accent px-1.5 tabular-nums text-yg-on-accent">
                      {pendingCount}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="send" className="flex min-h-0 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
                <div className="mb-5 flex flex-col gap-3">
                  <p id={`${choiceId}-label`} className="lao-tone-text text-sm font-semibold">{t("waiter.requestTypeLabel")}</p>
                  <ToggleGroup
                    type="single"
                    orientation="vertical"
                    value={requestType}
                    aria-labelledby={`${choiceId}-label`}
                    className="w-full gap-2.5"
                    onValueChange={(value) => {
                      if (value !== "staff" && value !== "bill") return;
                      dirty();
                      setRequestType(value);
                    }}
                  >
                    {(["staff", "bill"] as const).map((type) => {
                      const Icon = type === "bill" ? Receipt : Bell;
                      const selected = requestType === type;
                      return (
                        <ToggleGroupItem
                          key={type}
                          value={type}
                          aria-label={t(type === "bill" ? "waiter.requestBill" : "waiter.requestStaff")}
                          aria-describedby={`${choiceId}-${type}`}
                          disabled={sending || (type === "bill" && !billEnabled && !pendingBill)}
                          className="h-auto min-h-20 w-full justify-start gap-3 whitespace-normal rounded-2xl border border-yg-line bg-yg-bg2 px-3 py-3 text-left text-yg-ink hover:bg-yg-panel-hover hover:text-yg-ink focus-visible:ring-yg-accent data-[state=on]:border-yg-accent-line data-[state=on]:bg-yg-accent-soft data-[state=on]:text-yg-ink dark:bg-yg-bg2 dark:data-[state=on]:bg-yg-accent-soft dark:data-[state=on]:text-yg-ink"
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-yg-accent-soft text-yg-accent-strong"><Icon className="size-5" aria-hidden="true" /></span>
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="lao-tone-text text-sm font-semibold">{t(type === "bill" ? "waiter.requestBill" : "waiter.requestStaff")}</span>
                            <span id={`${choiceId}-${type}`} className="lao-tone-text text-xs font-normal leading-5 text-yg-muted">{t(type === "bill" ? "waiter.requestBillDescription" : "waiter.requestStaffDescription")}</span>
                          </span>
                          <span aria-hidden="true" className={cn("grid size-5 shrink-0 place-items-center rounded-full", selected ? "text-yg-accent-strong" : "border border-yg-line")}>{selected ? <CheckCircle2 className="size-5" /> : null}</span>
                        </ToggleGroupItem>
                      );
                    })}
                  </ToggleGroup>
                  {!loading && !billEnabled && !pendingBill ? <p className="lao-tone-text text-xs leading-5 text-yg-muted">{t("waiter.billUnavailable")}</p> : null}
                </div>

                {isBill ? (
                  <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-yg-accent-line bg-yg-accent-soft p-4">
                    <p className="lao-tone-text text-sm leading-6 text-yg-ink">{t(pendingBill ? "waiter.billPending" : "waiter.billNotice")}</p>
                    {pendingBill ? <span role="status" className="lao-tone-text text-sm font-semibold text-yg-accent-strong">{t(`waiter.billStatus${pendingBill.status}`)}</span> : null}
                  </div>
                ) : (
                <fieldset className="mb-5">
                  <legend className="mb-3 text-sm font-semibold">{t("waiter.quickSelect")}</legend>
                  <ul className="flex flex-col gap-2.5">
                    {CUSTOMER_WAITER_KINDS.map((kind) => {
                      const Icon = itemIcons[kind];
                      const qty = quantities[kind] ?? 0;
                      const name = t(`waiter.${kind}`);
                      return (
                        <li
                          key={kind}
                          className={cn("flex min-h-18 items-center gap-2.5 rounded-2xl border px-3 py-3 transition-colors motion-reduce:transition-none", qty > 0 ? "border-yg-accent-line bg-yg-accent-soft" : "border-yg-line bg-yg-bg2")}
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-yg-accent-soft text-yg-accent-strong"><Icon aria-hidden="true" className="size-5" /></span>
                          <span className="min-w-0 flex-1 break-words text-sm font-semibold">{name}</span>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              aria-label={t("waiter.decrease", { name })}
                              className={cn("size-11 rounded-xl", OUTLINE_ON_PANEL_CLASS)}
                              disabled={sending || qty === 0}
                              onClick={() => changeQty(kind, -1)}
                            >
                              <Minus aria-hidden="true" />
                            </Button>
                            <output
                              aria-live="polite"
                              aria-label={name}
                              className={cn(
                                "w-7 text-center text-base font-bold tabular-nums",
                                qty === 0 && "text-yg-muted",
                              )}
                            >
                              {qty}
                            </output>
                            <Button
                              type="button"
                              size="icon"
                              aria-label={t("waiter.increase", { name })}
                              className="size-11 rounded-xl bg-yg-accent text-yg-on-accent hover:bg-yg-accent-strong"
                              disabled={sending || qty >= MAX_CUSTOMER_WAITER_QTY}
                              onClick={() => changeQty(kind, 1)}
                            >
                              <Plus aria-hidden="true" />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>
                )}

                {!(isBill && pendingBill) ? (
                <label className="grid gap-2.5 text-sm font-semibold">
                  <span className="flex items-center gap-2"><MessageSquareText aria-hidden="true" className="size-4 text-yg-accent-strong" />{t("waiter.message")}</span>
                  <Textarea
                    value={note}
                    disabled={sending}
                    maxLength={MAX_CUSTOMER_WAITER_MESSAGE}
                    rows={3}
                    placeholder={t(isBill ? "waiter.billMessagePlaceholder" : "waiter.messagePlaceholder")}
                    className="min-h-28 resize-none rounded-2xl border-yg-line bg-yg-bg2 p-3.5 text-base font-normal leading-relaxed text-yg-ink placeholder:text-yg-muted dark:bg-yg-bg2"
                    onChange={(event) => {
                      dirty();
                      const value = event.target.value.slice(0, MAX_CUSTOMER_WAITER_MESSAGE);
                      setNotes((current) => ({ ...current, [requestType]: value }));
                    }}
                  />
                </label>
                ) : null}
                {!(isBill && pendingBill) ? <p className="mt-1.5 text-right text-xs tabular-nums text-yg-muted">
                  {note.length}/{MAX_CUSTOMER_WAITER_MESSAGE}
                </p> : null}
              </div>

              <div className="shrink-0 border-t border-yg-line bg-yg-bg2 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] sm:px-5">
                <Button
                  type="button"
                  className="h-13 w-full gap-2 rounded-2xl bg-yg-accent text-base font-semibold text-yg-on-accent shadow-sm hover:bg-yg-accent-strong"
                  disabled={sending || (!(isBill && pendingBill) && !canSend)}
                  onClick={() => isBill && pendingBill ? setTab("history") : void submit()}
                >
                  {sending ? (
                    <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
                  ) : isBill ? (
                    <Receipt aria-hidden="true" className="size-4" />
                  ) : hasDetails ? (
                    <Send aria-hidden="true" className="size-4" />
                  ) : (
                    <Bell aria-hidden="true" className="size-4" />
                  )}
                  {/* ยังไม่เลือกอะไร = ปุ่มเรียกพนักงานเฉยๆ / เลือกแล้ว = ส่งคำขอพร้อมจำนวน */}
                  {sending
                    ? t("common.loading")
                    : isBill
                      ? t(pendingBill ? "waiter.billViewHistory" : "waiter.billSubmit")
                    : selectedCount
                      ? t("waiter.sendWithCount", { count: selectedCount })
                      : hasDetails
                        ? t("waiter.send")
                        : t("waiter.title")}
                </Button>
              </div>
            </TabsContent>

            <TabsContent
              value="history"
              ref={historyScrollRef}
              className="min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(20px,env(safe-area-inset-bottom))] sm:px-5"
            >
              <PublicPullToRefresh scrollRef={historyScrollRef} onRefresh={refreshHistory} />
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-yg-ink">
                  {t("waiter.historyTab")} ({requests.length})
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  className="size-11 rounded-xl border border-yg-line bg-yg-bg2 text-yg-accent-strong hover:bg-yg-panel-hover dark:hover:bg-yg-panel-hover"
                  disabled={loading}
                  onClick={refresh}
                  aria-label={t("actions.refresh")}
                >
                  <RefreshCw aria-hidden="true" className={cn("size-4", loading && "motion-safe:animate-spin")} />
                </Button>
              </div>
              {loading && !requests.length ? (
                <div role="status" aria-label={t("common.loading")} className="grid gap-3">
                  {[0, 1, 2].map((index) => (
                    <Skeleton key={index} className="h-28 rounded-2xl bg-yg-accent-soft" />
                  ))}
                </div>
              ) : requests.length ? (
                <ol className="flex flex-col gap-3" aria-live="polite" aria-relevant="additions text">
                  {requests.map((request) => {
                    const StatusIcon = statusIcon[request.status];
                    return (
                      <li key={request.request_uuid} className="overflow-hidden rounded-2xl border border-yg-line bg-yg-bg2 p-4 text-sm shadow-sm">
                        <div className="mb-3 flex flex-wrap items-center gap-2.5">
                          <span className="lao-tone-text inline-flex min-h-7 items-center gap-1.5 rounded-lg bg-yg-accent-soft px-2.5 py-1 text-xs font-semibold text-yg-accent-strong">
                            {request.request_type === "bill" ? <Receipt className="size-3.5" aria-hidden="true" /> : <Bell className="size-3.5" aria-hidden="true" />}
                            {t(request.request_type === "bill" ? "waiter.typeBill" : "waiter.typeStaff")}
                          </span>
                          <span
                            className={cn(
                              "inline-flex min-h-7 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold",
                              statusClass[request.status],
                            )}
                          >
                            <StatusIcon aria-hidden="true" className="size-3.5" />
                            {t(request.request_type === "bill" ? `waiter.billStatus${request.status}` : `waiter.status${request.status}`)}
                          </span>
                          <time dateTime={request.created_at} className="ml-auto flex items-center gap-1 text-xs tabular-nums text-yg-muted">
                            <Clock3 aria-hidden="true" className="size-3" />
                            {formatTime(request.created_at)}
                          </time>
                        </div>
                        {request.items.length ? (
                          <ul className="mb-3 flex flex-wrap gap-2">
                            {request.items.map((item) => {
                              const Icon = item.kind === "staff" ? Bell : itemIcons[item.kind];
                              return (
                                <li key={item.kind} className="flex items-center gap-1.5 rounded-lg border border-yg-accent-line bg-yg-accent-soft px-2.5 py-2 text-xs font-medium text-yg-accent-strong">
                                  <Icon aria-hidden="true" className="size-3.5" />
                                  <span>{t(`waiter.${item.kind}`)}</span>
                                  <span className="font-bold tabular-nums">×{item.qty}</span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                        {request.message ? (
                          <div className="rounded-xl bg-yg-accent-soft p-3">
                            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-yg-accent-strong"><MessageSquareText aria-hidden="true" className="size-3.5" />{t("waiter.message")}</p>
                            <p className="whitespace-pre-wrap break-words leading-relaxed text-yg-ink">{request.message}</p>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <Empty className="min-h-60 rounded-2xl border border-dashed border-yg-line bg-yg-bg2">
                  <EmptyHeader>
                    <EmptyMedia variant="icon" className="size-14 rounded-2xl bg-yg-accent-soft text-yg-accent-strong">
                      <History className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle className="text-yg-muted">{t("waiter.emptyHistory")}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              )}
            </TabsContent>
          </Tabs>
        </DrawerContent>
      </Drawer>
    </>
  );
}
