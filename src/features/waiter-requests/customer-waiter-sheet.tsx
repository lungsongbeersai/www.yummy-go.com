"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  CheckCircle2,
  Clock3,
  History,
  LoaderCircle,
  Minus,
  Plus,
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
import { cn } from "@/lib/utils";
import { useWaiterRequestsStore } from "@/stores/waiter-requests-store";
import type { WaiterItemKind } from "@/services/waiter-requests";
import { PublicPullToRefresh } from "@/features/public-pos/order/components/public-pull-to-refresh";
import { useWaiterUpdates } from "./use-waiter-updates";

// ลูกค้าเรียกพนักงานจากหน้าสั่งอาหาร (QR) — Drawer ขึ้นจากล่างทุกขนาดจอ (มือถือเป็นหลัก ปัดลงเพื่อปิดได้)
// ของที่ขอเป็นปุ่ม −/+ แทน checkbox ที่เคยแทรกชื่อลงข้อความให้ลูกค้าพิมพ์จำนวนเอง แต่สัญญากับ API คงเดิม:
// ส่ง items: [] + message ที่ประกอบจากสิ่งที่เลือก (หน้าพนักงานอ่าน message อยู่แล้ว ไม่ต้องแก้ Backend)

const kinds = ["bowl", "spoon", "chopsticks"] as const satisfies readonly WaiterItemKind[];
type RequestKind = (typeof kinds)[number];
const itemIcons = { bowl: Soup, spoon: Utensils, chopsticks: UtensilsCrossed } satisfies Record<
  RequestKind,
  typeof Soup
>;
const MAX_MESSAGE = 500;

// หน้าเมนู QR บังคับธีมสว่างเสมอ (data-yg-theme="light") แต่ <html class="dark"> ของเครื่องที่ตั้งโหมดมืดยังทำให้
// variant dark: ใน primitive ของ shadcn ทำงาน (แท็บโปร่ง ตัวอักษรจาง, switch/ช่องข้อความกลืนกับพื้นขาว) — ทับค่า dark:
// ด้วย token yg-* ชุดเดียวกับโหมดสว่าง (cn/tailwind-merge ตัด dark: ของ primitive ทิ้งเพราะ variant ตรงกัน)
const TAB_TRIGGER_CLASS =
  "h-full gap-2 rounded-lg text-sm text-yg-muted hover:text-yg-ink data-active:bg-yg-panel data-active:text-yg-accent-strong data-active:shadow-sm dark:text-yg-muted dark:hover:text-yg-ink dark:data-active:border-transparent dark:data-active:bg-yg-panel dark:data-active:text-yg-accent-strong";
const OUTLINE_ON_PANEL_CLASS =
  "border-yg-line bg-yg-panel text-yg-ink hover:bg-yg-panel-hover dark:border-yg-line dark:bg-yg-panel dark:hover:bg-yg-panel-hover";
const MAX_QTY = 9;

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
}

export function CustomerWaiterSheet({ open, onOpenChange, token, branch, table }: Props) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<"send" | "history">("send");
  const [quantities, setQuantities] = useState<Partial<Record<RequestKind, number>>>({});
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const requestId = useRef<string | null>(null);
  const historyScrollRef = useRef<HTMLDivElement | null>(null);

  const storedRequests = useWaiterRequestsStore((s) => s.publicRequests);
  const key = useWaiterRequestsStore((s) => s.publicKey);
  const requests = key === token ? storedRequests : [];
  const loading = useWaiterRequestsStore((s) => s.publicLoading);
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

  // บรรทัดที่ประกอบจากสิ่งที่เลือก — นำหน้าโน้ตของลูกค้าใน message ที่ส่ง
  const selectionLines = useMemo(
    () =>
      kinds.flatMap((kind) => {
        const qty = quantities[kind] ?? 0;
        return qty > 0 ? [`${t(`waiter.${kind}`)} × ${qty}`] : [];
      }),
    [quantities, t],
  );
  const selectedCount = kinds.reduce((sum, kind) => sum + (quantities[kind] ?? 0), 0);
  const prefix = selectionLines.join("\n");
  // รวมแล้วต้องไม่เกินที่ API รับ — โน้ตได้พื้นที่ที่เหลือจากบรรทัดของที่เลือก
  const noteLimit = Math.max(0, MAX_MESSAGE - (prefix ? prefix.length + 1 : 0));
  const details = [prefix, note.trim()].filter(Boolean).join("\n");
  // เปิดหน้านี้ = อยากให้พนักงานมาที่โต๊ะอยู่แล้ว จึงไม่มีตัวเลือก "ให้มาที่โต๊ะ" แยก — ไม่เลือกอะไรก็กดเรียกได้ทันที
  // โดยส่งข้อความว่าให้มาที่โต๊ะ (API ต้องมี message ไม่ว่าง และหน้าพนักงานแสดง message)
  const message = details || t("waiter.comeToTable");
  const canSend = !sending;
  const pendingCount = requests.filter((request) => request.status !== 2).length;

  // ค่าที่ส่งเปลี่ยน = คำขอใหม่ (client_request_uuid ใหม่) — กดส่งซ้ำค่าเดิมยังใช้ id เดิม กันคำขอซ้ำ
  const dirty = () => {
    requestId.current = null;
  };

  const changeQty = (kind: RequestKind, delta: number) => {
    dirty();
    setQuantities((current) => ({
      ...current,
      [kind]: Math.min(MAX_QTY, Math.max(0, (current[kind] ?? 0) + delta)),
    }));
  };

  const submit = async () => {
    if (!canSend) return;
    requestId.current ??= crypto.randomUUID();
    const ok = await send(token, {
      client_request_uuid: requestId.current,
      items: [],
      message,
    });
    if (!ok) return;
    requestId.current = null;
    setQuantities({});
    setNote("");
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
      <PublicSuccessDialog open={sent} onOpenChange={setSent} message={t("publicSuccess.waiter")} />
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
          className="yg-shell mx-auto flex h-[min(640px,90dvh)] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-t-2xl border-t border-yg-line bg-yg-panel p-0 font-yg-sans text-yg-ink before:hidden data-[vaul-drawer-direction=bottom]:max-h-[90dvh] [&>div:first-child]:hidden"
        >
          <DrawerHandle aria-label={t("actions.close")} className="bg-yg-divider" />

          <header className="flex shrink-0 items-start gap-3 px-4 pb-3 sm:px-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-yg-accent-soft text-yg-accent">
              <Bell aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DrawerTitle className="text-base font-semibold text-yg-ink">{t("waiter.title")}</DrawerTitle>
              <DrawerDescription className="text-sm leading-snug text-yg-muted">
                {t("waiter.description")}
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("actions.close")}
                className="size-11 shrink-0 rounded-full text-yg-muted hover:bg-yg-panel-hover hover:text-yg-ink dark:hover:bg-yg-panel-hover"
                disabled={sending}
              >
                <X aria-hidden="true" />
              </Button>
            </DrawerClose>
          </header>

          {error ? (
            <Alert className="mx-4 mb-3 w-auto border-yg-line bg-yg-card sm:mx-5">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-yg-ink">
                {t("waiter.failed")}
                <Button
                  variant="outline"
                  size="sm"
                  className={OUTLINE_ON_PANEL_CLASS}
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
            <div className="shrink-0 px-4 pb-3 sm:px-5">
              <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-yg-accent-soft p-1 group-data-horizontal/tabs:h-11">
                <TabsTrigger value="send" className={TAB_TRIGGER_CLASS}>
                  <Send aria-hidden="true" className="size-4" />
                  {t("waiter.sendTab")}
                </TabsTrigger>
                <TabsTrigger value="history" className={TAB_TRIGGER_CLASS}>
                  <History aria-hidden="true" className="size-4" />
                  {t("waiter.historyTab")}
                  {pendingCount ? (
                    <Badge className="h-5 min-w-5 rounded-full bg-yg-accent px-1.5 tabular-nums text-yg-on-accent">
                      {pendingCount}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="send" className="flex min-h-0 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-5">
                <fieldset className="mb-4">
                  <legend className="mb-2 text-sm font-medium">{t("waiter.quickSelect")}</legend>
                  <ul className="divide-y divide-yg-line overflow-hidden rounded-xl border border-yg-line">
                    {kinds.map((kind) => {
                      const Icon = itemIcons[kind];
                      const qty = quantities[kind] ?? 0;
                      const name = t(`waiter.${kind}`);
                      return (
                        <li
                          key={kind}
                          className={cn("flex min-h-14 items-center gap-3 px-3 py-2", qty > 0 && "bg-yg-accent-soft")}
                        >
                          <Icon aria-hidden="true" className="size-5 shrink-0 text-yg-accent" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              aria-label={t("waiter.decrease", { name })}
                              className={cn("size-10 rounded-full", OUTLINE_ON_PANEL_CLASS)}
                              disabled={sending || qty === 0}
                              onClick={() => changeQty(kind, -1)}
                            >
                              <Minus aria-hidden="true" />
                            </Button>
                            <output
                              aria-live="polite"
                              aria-label={name}
                              className={cn(
                                "w-8 text-center text-base font-semibold tabular-nums",
                                qty === 0 && "text-yg-muted",
                              )}
                            >
                              {qty}
                            </output>
                            <Button
                              type="button"
                              size="icon"
                              aria-label={t("waiter.increase", { name })}
                              className="size-10 rounded-full bg-yg-accent text-yg-on-accent hover:bg-yg-accent-strong"
                              disabled={sending || qty >= MAX_QTY}
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

                <label className="grid gap-2 text-sm font-medium">
                  {t("waiter.message")}
                  <Textarea
                    value={note}
                    disabled={sending}
                    maxLength={noteLimit}
                    rows={3}
                    placeholder={t("waiter.messagePlaceholder")}
                    className="min-h-20 resize-none border-yg-line bg-yg-panel font-normal text-yg-ink placeholder:text-yg-muted dark:bg-yg-panel"
                    onChange={(event) => {
                      dirty();
                      setNote(event.target.value.slice(0, noteLimit));
                    }}
                  />
                </label>
                <p className="mt-1.5 text-right text-xs tabular-nums text-yg-muted">
                  {note.length}/{noteLimit}
                </p>
              </div>

              <div className="shrink-0 border-t border-yg-line bg-yg-panel px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-5">
                <Button
                  className="h-12 w-full gap-2 rounded-xl bg-yg-accent text-base text-yg-on-accent hover:bg-yg-accent-strong"
                  disabled={!canSend}
                  onClick={() => void submit()}
                >
                  {sending ? (
                    <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />
                  ) : details ? (
                    <Send aria-hidden="true" className="size-4" />
                  ) : (
                    <Bell aria-hidden="true" className="size-4" />
                  )}
                  {/* ยังไม่เลือกอะไร = ปุ่มเรียกพนักงานเฉยๆ / เลือกแล้ว = ส่งคำขอพร้อมจำนวน */}
                  {sending
                    ? t("common.loading")
                    : selectedCount
                      ? t("waiter.sendWithCount", { count: selectedCount })
                      : details
                        ? t("waiter.send")
                        : t("waiter.title")}
                </Button>
              </div>
            </TabsContent>

            <TabsContent
              value="history"
              ref={historyScrollRef}
              className="min-h-0 overflow-y-auto overscroll-contain px-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:px-5"
            >
              <PublicPullToRefresh scrollRef={historyScrollRef} onRefresh={refreshHistory} />
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-yg-muted">
                  {t("waiter.historyTab")} ({requests.length})
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-10 rounded-full text-yg-accent-strong hover:bg-yg-panel-hover dark:hover:bg-yg-panel-hover"
                  disabled={loading}
                  onClick={refresh}
                  aria-label={t("actions.tryAgain")}
                >
                  <RefreshCw aria-hidden="true" className={cn("size-4", loading && "motion-safe:animate-spin")} />
                </Button>
              </div>
              {loading && !requests.length ? (
                <div role="status" aria-label={t("common.loading")} className="grid gap-3">
                  {[0, 1, 2].map((index) => (
                    <Skeleton key={index} className="h-20 rounded-xl bg-yg-accent-soft" />
                  ))}
                </div>
              ) : requests.length ? (
                <ol className="grid gap-3">
                  {requests.map((request) => {
                    const StatusIcon = statusIcon[request.status];
                    return (
                      <li key={request.request_uuid} className="rounded-xl border border-yg-line bg-yg-card p-3 text-sm">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                              statusClass[request.status],
                            )}
                          >
                            <StatusIcon aria-hidden="true" className="size-3.5" />
                            {t(`waiter.status${request.status}`)}
                          </span>
                          <time dateTime={request.created_at} className="text-xs tabular-nums text-yg-muted">
                            {formatTime(request.created_at)}
                          </time>
                        </div>
                        {request.items.length ? (
                          <p className="mb-1 font-medium">
                            {request.items.map((item) => `${t(`waiter.${item.kind}`)} × ${item.qty}`).join(" · ")}
                          </p>
                        ) : null}
                        {request.message ? (
                          <p className="whitespace-pre-wrap break-words leading-relaxed text-yg-ink">
                            {request.message}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <Empty className="min-h-52">
                  <EmptyHeader>
                    <EmptyMedia variant="icon" className="size-12 rounded-full bg-yg-accent-soft text-yg-accent">
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
