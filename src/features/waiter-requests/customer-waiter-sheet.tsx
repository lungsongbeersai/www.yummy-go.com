"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock3,
  LoaderCircle,
  MessagesSquare,
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
import { Skeleton } from "@/components/ui/skeleton";
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
  const [itemsOpen, setItemsOpen] = useState(false);
  const requestAttempt = useRef<CustomerWaiterAttempt | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const initialFocusFrame = useRef<number | null>(null);
  const requestTypeRefs = useRef<Record<WaiterRequestType, HTMLButtonElement | null>>({ staff: null, bill: null });
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
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
    setItemsOpen(false);
    followLatest.current = true;
    window.requestAnimationFrame(scrollToLatest);
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
        <DrawerHandle aria-label={t("actions.close")} className="my-0 grid h-7 w-full place-items-center rounded-none bg-transparent after:h-1 after:w-10 after:rounded-full after:bg-yg-divider" />
        <header className="flex shrink-0 items-center gap-3 border-b border-yg-line px-4 pb-4 sm:px-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-yg-accent-soft text-yg-accent-strong">
            <MessagesSquare aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <DrawerTitle className="text-lg font-bold leading-tight text-yg-ink">{t("waiter.chat.customerTitle")}</DrawerTitle>
            <DrawerDescription className="mt-1 text-xs leading-relaxed text-yg-muted">{t("waiter.serviceDescription")}</DrawerDescription>
          </div>
          {pendingCount ? <Badge className="h-6 min-w-6 justify-center border-yg-accent-line bg-yg-accent-soft px-1.5 text-xs tabular-nums text-yg-accent-strong">{pendingCount}</Badge> : null}
          <Button size="icon" variant="ghost" type="button" className="size-11 shrink-0 rounded-xl text-yg-muted hover:bg-yg-panel-hover hover:text-yg-ink dark:hover:bg-yg-panel-hover" disabled={loading} onClick={refresh} aria-label={t("actions.refresh")}>
            <RefreshCw aria-hidden="true" className={cn("size-4", loading && "motion-safe:animate-spin")} />
          </Button>
          <DrawerClose asChild>
            <Button type="button" variant="ghost" size="icon" aria-label={t("actions.close")} className="size-11 shrink-0 rounded-xl text-yg-muted hover:bg-yg-panel-hover hover:text-yg-ink dark:hover:bg-yg-panel-hover" disabled={sending}>
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

        <form className="flex max-h-[55dvh] shrink-0 flex-col gap-3 overflow-y-auto overscroll-contain border-t border-yg-line bg-yg-bg2 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] sm:px-5" onSubmit={(event) => {
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
                <ToggleGroupItem key={type} ref={(element) => { requestTypeRefs.current[type] = element; }} value={type} aria-label={t(type === "bill" ? "waiter.requestBill" : "waiter.requestStaff")} aria-describedby={`${choiceId}-${type}`} disabled={sending || (type === "bill" && !billEnabled && !pendingBill)} className="h-auto min-h-11 min-w-0 gap-2 whitespace-normal rounded-xl border border-yg-line bg-yg-bg2 px-2 py-2 text-xs text-yg-muted hover:bg-yg-panel-hover hover:text-yg-ink focus-visible:ring-yg-accent data-[state=on]:border-yg-accent-line data-[state=on]:bg-yg-accent-soft data-[state=on]:text-yg-accent-strong dark:bg-yg-bg2 dark:data-[state=on]:bg-yg-accent-soft dark:data-[state=on]:text-yg-accent-strong">
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span>{t(type === "bill" ? "waiter.requestBill" : "waiter.requestStaff")}</span>
                  <span id={`${choiceId}-${type}`} className="sr-only">{t(type === "bill" ? "waiter.requestBillDescription" : "waiter.requestStaffDescription")}</span>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          {!loading && !billEnabled && !pendingBill ? <p className="text-xs leading-5 text-yg-muted">{t("waiter.billUnavailable")}</p> : null}
          {isBill ? (
            <div className="rounded-xl border border-yg-accent-line bg-yg-accent-soft px-3 py-2.5 text-xs leading-relaxed text-yg-ink">
              <p>{t(pendingBill ? "waiter.billPending" : "waiter.billNotice")}</p>
              {pendingBill ? <p role="status" className="mt-1 font-semibold text-yg-accent-strong">{t(`waiter.billStatus${pendingBill.status}`)}</p> : null}
            </div>
          ) : (
            <div>
              <Button type="button" variant="outline" className={cn("min-h-11 w-full justify-start gap-2 rounded-xl text-xs", OUTLINE_ON_PANEL_CLASS)} aria-expanded={itemsOpen} aria-controls={`${choiceId}-items`} disabled={sending} onClick={() => setItemsOpen((value) => !value)}>
                <Plus aria-hidden="true" className="size-4" />{t("waiter.quickSelect")}
                {selectedCount ? <Badge className="border-yg-accent-line bg-yg-accent-soft text-yg-accent-strong">{selectedCount}</Badge> : null}
                <ChevronDown aria-hidden="true" className={cn("ml-auto size-4 transition-transform motion-reduce:transition-none", itemsOpen && "rotate-180")} />
              </Button>
              <fieldset id={`${choiceId}-items`} hidden={!itemsOpen} className="mt-2">
                <legend className="sr-only">{t("waiter.quickSelect")}</legend>
                <ul className="flex flex-col gap-1.5">
                  {CUSTOMER_WAITER_KINDS.map((kind) => {
                    const Icon = itemIcons[kind];
                    const qty = quantities[kind] ?? 0;
                    const name = t(`waiter.${kind}`);
                    return (
                      <li key={kind} className={cn("flex items-center gap-2 rounded-xl border px-2 py-1", qty > 0 ? "border-yg-accent-line bg-yg-accent-soft" : "border-yg-line bg-yg-bg2")}>
                        <Icon aria-hidden="true" className="size-4 shrink-0 text-yg-accent-strong" />
                        <span className="min-w-0 flex-1 break-words text-xs font-medium">{name}</span>
                        <Button type="button" variant="outline" size="icon" aria-label={t("waiter.decrease", { name })} className={cn("size-11 rounded-xl", OUTLINE_ON_PANEL_CLASS)} disabled={sending || qty === 0} onClick={() => changeQty(kind, -1)}><Minus aria-hidden="true" /></Button>
                        <output aria-live="polite" aria-label={name} className={cn("w-6 shrink-0 text-center text-sm font-bold tabular-nums", qty === 0 && "text-yg-muted")}>{qty}</output>
                        <Button type="button" size="icon" aria-label={t("waiter.increase", { name })} className="size-11 rounded-xl bg-yg-accent text-yg-on-accent hover:bg-yg-accent-strong" disabled={sending || qty >= MAX_CUSTOMER_WAITER_QTY} onClick={() => changeQty(kind, 1)}><Plus aria-hidden="true" /></Button>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            </div>
          )}
          {!(isBill && pendingBill) ? (
            <div>
              <label htmlFor={`${choiceId}-message`} className="sr-only">{t("waiter.message")}</label>
              <Textarea id={`${choiceId}-message`} value={note} disabled={sending} maxLength={MAX_CUSTOMER_WAITER_MESSAGE} rows={2} placeholder={t(isBill ? "waiter.billMessagePlaceholder" : "waiter.messagePlaceholder")} className="max-h-28 min-h-14 resize-none rounded-2xl border-yg-line bg-yg-bg2 px-3 py-2.5 text-base font-normal leading-relaxed text-yg-ink placeholder:text-yg-muted dark:bg-yg-bg2" onChange={(event) => {
                dirty();
                const value = event.target.value.slice(0, MAX_CUSTOMER_WAITER_MESSAGE);
                setNotes((current) => ({ ...current, [requestType]: value }));
              }} />
              {note.length ? <p className="mt-1 text-right text-xs tabular-nums text-yg-muted">{note.length}/{MAX_CUSTOMER_WAITER_MESSAGE}</p> : null}
            </div>
          ) : null}
          <Button type={isBill && pendingBill ? "button" : "submit"} className="h-auto min-h-12 w-full shrink-0 gap-2 whitespace-normal rounded-2xl bg-yg-accent px-3 py-3 text-sm font-semibold text-yg-on-accent shadow-sm hover:bg-yg-accent-strong" disabled={sending || (!(isBill && pendingBill) && !canSend)} onClick={() => {
            if (isBill && pendingBill) {
              chatScrollRef.current?.querySelector<HTMLElement>(`[data-request-id="${pendingBill.request_uuid}"]`)?.scrollIntoView({ block: "nearest" });
            }
          }}>
            {sending ? <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" /> : isBill ? <Receipt aria-hidden="true" className="size-4" /> : hasDetails ? <Send aria-hidden="true" className="size-4" /> : <Bell aria-hidden="true" className="size-4" />}
            {sending ? t("common.loading") : isBill ? t(pendingBill ? "waiter.billViewHistory" : "waiter.billSubmit") : selectedCount ? t("waiter.sendWithCount", { count: selectedCount }) : hasDetails ? t("waiter.send") : t("waiter.title")}
          </Button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
