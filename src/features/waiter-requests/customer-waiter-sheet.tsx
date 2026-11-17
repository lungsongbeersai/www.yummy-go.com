"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MessagesSquare,
  Minus,
  PencilLine,
  Plus,
  Receipt,
  RefreshCw,
  Send,
  Soup,
  Utensils,
  UtensilsCrossed,
  X,
} from "lucide-react";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupTextarea } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
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
const BILL_QUICK_MESSAGE_KEYS = ["checkTable", "receipt", "readyToPay"] as const;

// Customer-menu tokens also cover portals; the cashier's root .dark must not override them.
const OUTLINE_ON_PANEL_CLASS =
  "border-yg-line bg-yg-bg2 text-yg-ink hover:bg-yg-panel-hover dark:border-yg-line dark:bg-yg-bg2 dark:hover:bg-yg-panel-hover";

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
  const [requestType, setRequestType] = useState<WaiterRequestType>(initialRequestType ?? "staff");
  const [quantities, setQuantities] = useState<Partial<Record<CustomerWaiterKind, number>>>({});
  const [notes, setNotes] = useState<Record<WaiterRequestType, string>>({ staff: "", bill: "" });
  const requestAttempt = useRef<CustomerWaiterAttempt | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const initialFocusFrame = useRef<number | null>(null);
  const requestTypeRefs = useRef<Record<WaiterRequestType, HTMLButtonElement | null>>({ staff: null, bill: null });
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const pendingBillButtonRef = useRef<HTMLButtonElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const itemButtonRefs = useRef<Partial<Record<CustomerWaiterKind, HTMLButtonElement | null>>>({});
  const followLatest = useRef(true);

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

  const scrollToLatest = useCallback(() => {
    const scroll = chatScrollRef.current;
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
  }, []);
  useEffect(() => {
    if (!open || !followLatest.current) return;
    const frame = window.requestAnimationFrame(scrollToLatest);
    return () => window.cancelAnimationFrame(frame);
  }, [open, storedRequests, key, scrollToLatest]);

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
  const sendActionLabel = sending
    ? t("common.loading")
    : isBill
      ? t("waiter.billSubmit")
      : selectedCount
        ? t("waiter.sendWithCount", { count: selectedCount })
        : t(hasDetails ? "waiter.send" : "waiter.title");
  const canSend = !sending && (!isBill || (billEnabled && !loading && !pendingBill));
  const pendingCount = requests.filter((request) => request.status !== 2).length;
  // The API prioritizes an active bill; a conversation needs chronological order.
  const timeline = [...requests].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));

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
    const ok = await send(token, { client_request_uuid: attempt.id, ...payload });
    if (!ok) return;
    requestAttempt.current = null;
    if (!isBill) setQuantities({});
    setNotes((current) => ({ ...current, [requestType]: "" }));
    followLatest.current = true;
    window.requestAnimationFrame(() => {
      scrollToLatest();
      if (isBill) pendingBillButtonRef.current?.focus({ preventScroll: true });
    });
  };

  const formatTime = (value: string) =>
    new Date(value).toLocaleString(i18n.language === "en" ? "en-GB" : "lo-LA", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

  return (
    <Drawer open={open} dismissible={!sending} handleOnly shouldScaleBackground={false} onOpenChange={(next) => {
      if (!sending) onOpenChange(next);
    }}>
      <DrawerContent
        data-testid="customer-waiter-chat"
        aria-busy={sending}
        className="mx-auto flex h-[min(740px,92dvh)] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-t-3xl border border-b-0 border-yg-line bg-yg-bg2 p-0 font-yg-sans text-yg-ink shadow-xl before:hidden data-[vaul-drawer-direction=bottom]:max-h-[92dvh] [&>div:first-child]:hidden"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          const nextRequestType = initialRequestType ?? "staff";
          if (requestType !== nextRequestType) requestAttempt.current = null;
          setRequestType(nextRequestType);
          followLatest.current = true;
          initialFocusFrame.current = window.requestAnimationFrame(() => {
            initialFocusFrame.current = null;
            const choice = requestTypeRefs.current[nextRequestType];
            const target = choice && !choice.disabled ? choice : chatScrollRef.current;
            target?.focus({ preventScroll: true });
            scrollToLatest();
          });
        }}
        onCloseAutoFocus={(event) => {
          if (initialFocusFrame.current !== null) {
            window.cancelAnimationFrame(initialFocusFrame.current);
            initialFocusFrame.current = null;
          }
          if (opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus();
          }
        }}
      >
        <DrawerHandle aria-label={t("actions.close")} className="my-0 grid h-6 w-full place-items-center rounded-none bg-transparent after:h-1 after:w-10 after:rounded-full after:bg-yg-divider" />
        <header className="flex shrink-0 items-center gap-2 border-b border-yg-line px-4 pb-3 sm:px-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-yg-accent-soft text-yg-accent-strong">
            <MessagesSquare aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <DrawerTitle className="text-base font-bold leading-snug text-yg-ink">{t("waiter.chat.customerTitle")}</DrawerTitle>
            <DrawerDescription className="sr-only">{t("waiter.serviceDescription")}</DrawerDescription>
          </div>
          {pendingCount ? <Badge className="h-6 min-w-6 justify-center border-yg-accent-line bg-yg-accent-soft px-1.5 text-xs tabular-nums text-yg-accent-strong">{pendingCount}</Badge> : null}
          <Button size="icon" variant="outline" type="button" className={cn("size-10 shrink-0 rounded-xl shadow-sm", OUTLINE_ON_PANEL_CLASS)} disabled={loading} onClick={refresh} aria-label={t("actions.refresh")}>
            <RefreshCw aria-hidden="true" className={cn("size-4", loading && "motion-safe:animate-spin")} />
          </Button>
          <DrawerClose asChild>
            <Button type="button" variant="outline" size="icon" aria-label={t("actions.close")} className={cn("size-10 shrink-0 rounded-xl shadow-sm", OUTLINE_ON_PANEL_CLASS)} disabled={sending}>
              <X aria-hidden="true" />
            </Button>
          </DrawerClose>
        </header>

        {error ? (
          <Alert className="mx-4 mt-3 w-auto shrink-0 rounded-xl border-yg-accent-line bg-yg-accent-soft sm:mx-5">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-yg-ink">
              {t("waiter.failed")}
              <Button variant="outline" size="sm" className={cn("min-h-11 rounded-lg px-3", OUTLINE_ON_PANEL_CLASS)} disabled={loading || sending} onClick={refresh}>{t("actions.tryAgain")}</Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <div ref={chatScrollRef} tabIndex={0} aria-label={t("waiter.chat.timelineLabel")} className="min-h-24 flex-1 overflow-y-auto overscroll-contain bg-yg-accent-soft/40 px-4 py-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yg-accent sm:px-5" onScroll={(event) => {
          const scroll = event.currentTarget;
          followLatest.current = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 64;
        }}>
          <PublicPullToRefresh scrollRef={chatScrollRef} onRefresh={refreshHistory} />
          {loading && !requests.length ? (
            <div role="status" aria-label={t("common.loading")} className="grid gap-4">
              <Skeleton className="h-20 w-4/5 rounded-2xl bg-yg-accent-soft" />
              <Skeleton className="ml-auto h-24 w-3/4 rounded-2xl bg-yg-accent-soft" />
            </div>
          ) : null}
          {!loading && !requests.length && !error ? (
            <Empty className="max-w-[90%] items-start rounded-2xl rounded-tl-sm border border-yg-line bg-yg-bg2 p-4 text-left shadow-sm">
              <EmptyHeader className="items-start gap-2 text-left">
                <p className="text-xs font-semibold text-yg-accent-strong">{t("waiter.chat.staffLabel")}</p>
                <EmptyTitle className="text-sm text-yg-ink">{t("waiter.chat.welcome")}</EmptyTitle>
                <EmptyDescription className="text-xs leading-relaxed text-yg-muted">{t("waiter.chat.hint")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          <ol role="log" aria-label={t("waiter.chat.timelineLabel")} aria-live="polite" aria-relevant="additions text" className="flex flex-col gap-5">
            {timeline.map((request) => {
              const bill = request.request_type === "bill";
              const RequestIcon = bill ? Receipt : Bell;
              return (
                <li key={request.request_uuid} data-request-id={request.request_uuid} className="flex min-w-0 flex-col gap-3 text-sm">
                  <div className="ml-auto flex max-w-[90%] min-w-0 flex-col items-end gap-1.5">
                    <span className="px-1 text-xs text-yg-muted">{t("waiter.chat.you")}</span>
                    <div className="max-w-full rounded-2xl rounded-tr-sm bg-yg-accent px-4 py-3 text-yg-on-accent shadow-sm">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold"><RequestIcon aria-hidden="true" className="size-3.5 shrink-0" />{t(bill ? "waiter.typeBill" : "waiter.typeStaff")}</p>
                      {request.message ? <p className="whitespace-pre-wrap [overflow-wrap:anywhere] leading-relaxed">{request.message}</p> : null}
                      {request.items.length ? (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {request.items.map((item) => {
                            const Icon = item.kind === "staff" ? Bell : itemIcons[item.kind];
                            return <li key={item.kind} className="flex items-center gap-1.5 rounded-lg border border-yg-on-accent/30 px-2 py-1.5 text-xs"><Icon aria-hidden="true" className="size-3.5 shrink-0" />{t(`waiter.${item.kind}`)}<span className="font-semibold tabular-nums">×{item.qty}</span></li>;
                          })}
                        </ul>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap justify-end gap-x-2 gap-y-1 px-1 text-xs text-yg-muted">
                      <time dateTime={request.created_at} className="tabular-nums">{formatTime(request.created_at)}</time>
                      {request.status === 0 ? <span className="flex items-center gap-1"><Clock3 aria-hidden="true" className="size-3" />{t(bill ? "waiter.billStatus0" : "waiter.status0")}</span> : null}
                    </div>
                  </div>
                  {request.status !== 0 ? (
                    <div className="flex max-w-[90%] items-start gap-2">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-yg-accent-soft text-yg-accent-strong"><MessagesSquare aria-hidden="true" className="size-4" /></span>
                      <div className="min-w-0 rounded-2xl rounded-tl-sm border border-yg-line bg-yg-bg2 px-4 py-3 shadow-sm">
                        <p className="mb-1 text-xs font-semibold text-yg-accent-strong">{t("waiter.chat.staffLabel")}</p>
                        <p className="flex items-start gap-1.5 text-sm text-yg-ink"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-yg-accent-strong" />{t(bill ? `waiter.billStatus${request.status}` : `waiter.status${request.status}`)}</p>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>

        <form data-testid="customer-waiter-compose" className="flex max-h-[55dvh] shrink-0 flex-col gap-2 overflow-y-auto overscroll-contain border-t border-yg-line bg-yg-bg2 px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5" onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}>
          <ToggleGroup type="single" value={requestType} aria-label={t("waiter.requestTypeLabel")} className="grid w-full grid-cols-2 gap-2" onValueChange={(value) => {
            if (value !== "staff" && value !== "bill") return;
            dirty();
            setRequestType(value);
          }}>
            {(["staff", "bill"] as const).map((type) => {
              const Icon = type === "bill" ? Receipt : Bell;
              return (
                <ToggleGroupItem key={type} ref={(element) => { requestTypeRefs.current[type] = element; }} value={type} aria-label={t(type === "bill" ? "waiter.requestBill" : "waiter.requestStaff")} aria-describedby={`${choiceId}-${type}`} disabled={sending || (type === "bill" && !billEnabled && !pendingBill)} className="h-auto min-h-9 min-w-0 gap-2 whitespace-normal rounded-xl border border-yg-accent-line bg-yg-bg2 px-2 py-1.5 text-xs font-semibold text-yg-ink shadow-sm hover:bg-yg-panel-hover hover:text-yg-ink focus-visible:ring-yg-accent data-[state=on]:border-yg-accent data-[state=on]:bg-yg-accent data-[state=on]:text-yg-on-accent data-[state=on]:hover:bg-yg-accent-strong data-[state=on]:hover:text-yg-on-accent dark:bg-yg-bg2 dark:data-[state=on]:bg-yg-accent dark:data-[state=on]:text-yg-on-accent">
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span>{t(type === "bill" ? "waiter.requestBill" : "waiter.requestStaff")}</span>
                  <span id={`${choiceId}-${type}`} className="sr-only">{t(type === "bill" ? "waiter.requestBillDescription" : "waiter.requestStaffDescription")}</span>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          {!loading && !billEnabled && !pendingBill ? <p className="text-xs leading-5 text-yg-muted">{t("waiter.billUnavailable")}</p> : null}
          {isBill ? (
            <div className="grid min-w-0 gap-1.5">
              <p id={`${choiceId}-bill-messages-label`} className="text-xs font-medium text-yg-accent-strong">{t("waiter.billQuickMessagesLabel")}</p>
              <div
                data-testid="customer-bill-quick-messages"
                data-vaul-no-drag
                role="region"
                aria-labelledby={`${choiceId}-bill-messages-label`}
                tabIndex={0}
                className="yg-rail snap-x snap-proximity overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-xl px-0.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yg-accent"
              >
                <div className="flex w-max gap-1.5">
                  {BILL_QUICK_MESSAGE_KEYS.map((preset) => {
                    const message = t(`waiter.billQuickMessages.${preset}`);
                    const selected = notes.bill === message;
                    return (
                      <Button
                        key={preset}
                        type="button"
                        variant="outline"
                        data-bill-message={preset}
                        aria-pressed={selected}
                        disabled={sending || loading || !billEnabled || Boolean(pendingBill)}
                        className={cn(
                          "h-9 snap-start gap-1.5 rounded-full px-3 text-xs font-medium shadow-sm focus-visible:ring-yg-accent",
                          selected
                            ? "border-yg-accent bg-yg-accent-soft text-yg-accent-strong hover:bg-yg-panel-hover hover:text-yg-accent-strong dark:bg-yg-accent-soft dark:hover:bg-yg-panel-hover"
                            : OUTLINE_ON_PANEL_CLASS,
                        )}
                        onClick={() => {
                          if (notes.bill === message) return;
                          // A preset can match the default payload; preserve its retry UUID.
                          setNotes((current) => ({ ...current, bill: message }));
                        }}
                      >
                        {selected ? <CheckCircle2 aria-hidden="true" className="size-3.5" /> : <Receipt aria-hidden="true" className="size-3.5" />}
                        {message}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-xl border border-yg-accent-line bg-yg-accent-soft px-3 py-2.5 text-xs leading-relaxed text-yg-ink">
                <p>{t(pendingBill ? "waiter.billPending" : "waiter.billNotice")}</p>
                {pendingBill ? <p role="status" className="mt-1 font-semibold text-yg-accent-strong">{t(`waiter.billStatus${pendingBill.status}`)}</p> : null}
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <p id={`${choiceId}-items-label`} className="sr-only">{t("waiter.quickSelect")}</p>
              <div
                data-testid="customer-waiter-items"
                data-vaul-no-drag
                role="region"
                aria-labelledby={`${choiceId}-items-label`}
                tabIndex={0}
                className="yg-rail snap-x snap-proximity overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-xl px-0.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yg-accent"
              >
                <ul className="flex w-max items-center gap-1.5">
                  {CUSTOMER_WAITER_KINDS.map((kind) => {
                    const Icon = itemIcons[kind];
                    const qty = quantities[kind] ?? 0;
                    const name = t(`waiter.${kind}`);
                    return (
                      <li key={kind} className={cn("flex shrink-0 snap-start items-center rounded-full border shadow-sm", qty > 0 ? "border-yg-accent bg-yg-accent-soft" : "border-yg-accent-line bg-yg-bg2")}>
                        {qty > 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t("waiter.decrease", { name })}
                            className="size-9 rounded-full text-yg-accent-strong hover:bg-yg-panel-hover hover:text-yg-accent-strong focus-visible:ring-yg-accent dark:hover:bg-yg-panel-hover"
                            disabled={sending}
                            onClick={() => {
                              if (qty === 1) itemButtonRefs.current[kind]?.focus({ preventScroll: true });
                              changeQty(kind, -1);
                            }}
                          >
                            <Minus aria-hidden="true" className="size-4" />
                          </Button>
                        ) : null}
                        <Badge
                          asChild
                          variant="outline"
                          className={cn(
                            "h-9 min-w-26 cursor-pointer justify-start gap-1.5 rounded-full border-0 bg-transparent px-2.5 text-xs text-yg-ink hover:bg-yg-panel-hover focus-visible:ring-yg-accent disabled:cursor-not-allowed disabled:opacity-50 dark:bg-transparent dark:hover:bg-yg-panel-hover",
                            qty > 0 && "text-yg-accent-strong",
                          )}
                        >
                          <button
                            ref={(element) => { itemButtonRefs.current[kind] = element; }}
                            type="button"
                            aria-label={t("waiter.increase", { name })}
                            disabled={sending || qty >= MAX_CUSTOMER_WAITER_QTY}
                            onClick={() => changeQty(kind, 1)}
                          >
                            <span className="text-yg-accent-strong"><Icon aria-hidden="true" className="size-4" /></span>
                            <span>{name}</span>
                            <output aria-live="polite" aria-label={name} className={cn("ml-auto min-w-4 text-center font-bold tabular-nums", qty === 0 && "text-yg-muted")}>{qty}</output>
                            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-yg-accent text-yg-on-accent"><Plus aria-hidden="true" className="size-3.5" /></span>
                          </button>
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
          {isBill && pendingBill ? (
            <Button ref={pendingBillButtonRef} type="button" className="min-h-11 w-full gap-2 whitespace-normal rounded-xl bg-yg-accent px-3 py-2 text-sm font-semibold text-yg-on-accent shadow-sm hover:bg-yg-accent-strong" disabled={sending} onClick={() => {
              chatScrollRef.current?.querySelector<HTMLElement>(`[data-request-id="${pendingBill.request_uuid}"]`)?.scrollIntoView({ block: "nearest" });
            }}>
              <Receipt aria-hidden="true" className="size-4" />
              {t("waiter.billViewHistory")}
            </Button>
          ) : (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`${choiceId}-message`} className="flex items-center gap-1.5 text-xs font-semibold text-yg-accent-strong">
                  <PencilLine aria-hidden="true" className="size-3.5" />
                  {t("waiter.message")}
                </label>
                {note.length ? <span className="shrink-0 text-xs tabular-nums text-yg-muted">{note.length}/{MAX_CUSTOMER_WAITER_MESSAGE}</span> : null}
              </div>
              <div className="flex items-end gap-2">
                <InputGroup
                  data-testid="customer-waiter-message-box"
                  data-disabled={sending || undefined}
                  aria-label={t("waiter.message")}
                  className="h-auto min-w-0 flex-1 rounded-xl border-yg-accent/40 bg-yg-accent-soft/20 text-yg-ink shadow-inner has-data-[align=block-start]:rounded-xl has-[textarea]:rounded-xl has-[[data-slot=input-group-control]:focus-visible]:border-yg-accent has-[[data-slot=input-group-control]:focus-visible]:ring-yg-accent/25 dark:bg-yg-accent-soft/20"
                >
                  {!isBill && payload.items.length ? (
                    <InputGroupAddon
                      align="block-start"
                      id={`${choiceId}-selected-items`}
                      data-testid="customer-waiter-selected-items"
                      className="flex-wrap gap-1.5 px-3 pb-0 pt-2 text-yg-ink"
                      onClick={() => messageInputRef.current?.focus({ preventScroll: true })}
                    >
                      {payload.items.map((item) => {
                        const Icon = item.kind === "staff" ? Bell : itemIcons[item.kind];
                        return (
                          <Badge key={item.kind} variant="outline" data-selected-item={item.kind} className="h-6 gap-1.5 rounded-lg border-yg-accent-line bg-yg-accent-soft px-2 text-xs text-yg-accent-strong dark:bg-yg-accent-soft">
                            <span><Icon aria-hidden="true" className="size-3.5" /></span>
                            {t(`waiter.${item.kind}`)}
                            <span className="font-semibold tabular-nums">×{item.qty}</span>
                          </Badge>
                        );
                      })}
                    </InputGroupAddon>
                  ) : null}
                  <InputGroupTextarea
                    ref={messageInputRef}
                    id={`${choiceId}-message`}
                    data-testid="customer-waiter-message"
                    aria-describedby={!isBill && payload.items.length ? `${choiceId}-selected-items` : undefined}
                    value={note}
                    disabled={sending}
                    maxLength={MAX_CUSTOMER_WAITER_MESSAGE}
                    rows={1}
                    placeholder={t(isBill ? "waiter.billMessagePlaceholder" : "waiter.chat.writePlaceholder")}
                    className="max-h-24 min-h-11 min-w-0 w-full px-3 py-2 text-base font-normal leading-relaxed text-yg-ink placeholder:text-yg-muted"
                    onChange={(event) => {
                      dirty();
                      const value = event.target.value.slice(0, MAX_CUSTOMER_WAITER_MESSAGE);
                      setNotes((current) => ({ ...current, [requestType]: value }));
                    }}
                  />
                </InputGroup>
                <Button
                  type="submit"
                  data-testid="customer-waiter-send"
                  aria-label={`${t("waiter.chat.sendAction")}: ${sendActionLabel}`}
                  className="h-11 min-w-17 shrink-0 gap-1.5 rounded-xl bg-yg-accent px-3 text-sm font-semibold text-yg-on-accent shadow-sm hover:bg-yg-accent-strong"
                  disabled={!canSend}
                >
                  {sending ? <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> : <Send aria-hidden="true" className="size-4" />}
                  {t("waiter.chat.sendAction")}
                </Button>
              </div>
            </div>
          )}
        </form>
      </DrawerContent>
    </Drawer>
  );
}
