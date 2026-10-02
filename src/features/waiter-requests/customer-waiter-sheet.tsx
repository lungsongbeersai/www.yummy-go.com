"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  History,
  Send,
  Soup,
  Utensils,
  UtensilsCrossed,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { PublicSuccessDialog } from "@/components/common/public-success-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetHeader,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWaiterRequestsStore } from "@/stores/waiter-requests-store";
import type { WaiterItemKind } from "@/services/waiter-requests";
import { PublicPullToRefresh } from "@/features/public-pos/order/components/public-pull-to-refresh";
import { useWaiterUpdates } from "./use-waiter-updates";
const kinds: WaiterItemKind[] = ["bowl", "spoon", "chopsticks"];
const itemIcons = {
  bowl: Soup,
  spoon: Utensils,
  chopsticks: UtensilsCrossed,
  staff: Bell,
};
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  branch: string;
  table: string;
}
export function CustomerWaiterSheet({
  open,
  onOpenChange,
  token,
  branch,
  table,
}: Props) {
  const { t, i18n } = useTranslation();
  const [viewport, setViewport] = useState<{
    height: number;
    bottom: number;
  } | null>(null);
  useEffect(() => {
    const visual = window.visualViewport;
    if (!open || !visual) return;
    const update = () =>
      setViewport({
        height: Math.max(0, visual.height - 12),
        bottom: Math.max(
          0,
          window.innerHeight - visual.height - visual.offsetTop
        ),
      });
    update();
    visual.addEventListener("resize", update);
    visual.addEventListener("scroll", update);
    return () => {
      visual.removeEventListener("resize", update);
      visual.removeEventListener("scroll", update);
    };
  }, [open]);
  const [items, setItems] = useState<Partial<Record<WaiterItemKind, boolean>>>(
    {}
  );
  const [message, setMessage] = useState("");
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
  const submit = async () => {
    requestId.current ??= crypto.randomUUID();
    const ok = await send(token, {
      client_request_uuid: requestId.current,
      items: [],
      message,
    });
    if (ok) {
      setSent(true);
      requestId.current = null;
      setItems({});
      setMessage("");
    }
  };
  const dirty = () => {
    requestId.current = null;
    setSent(false);
  };
  return (
    <>
      <PublicSuccessDialog
        open={sent}
        onOpenChange={setSent}
        message={t("publicSuccess.waiter")}
      />
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!sending) onOpenChange(next);
        }}
      >
        <SheetContent
          side="bottom"
          style={
            viewport
              ? { maxHeight: viewport.height, bottom: viewport.bottom }
              : undefined
          }
          className="yg-shell mx-auto h-[min(540px,85dvh)] max-h-[85dvh] max-w-xl gap-4 overflow-hidden rounded-t-2xl border-yg-line bg-yg-panel p-4 pb-[max(16px,env(safe-area-inset-bottom))] font-yg-sans text-yg-ink sm:p-6 [&>[data-slot=sheet-close]]:size-10 [&>[data-slot=sheet-close]]:border [&>[data-slot=sheet-close]]:border-yg-divider [&>[data-slot=sheet-close]]:rounded-lg"
        >
          <SheetHeader className="shrink-0 gap-1.5 p-0 pr-12">
            <SheetTitle className="flex items-center gap-2 text-lg font-semibold text-yg-ink">
              <Bell className="size-5 text-yg-accent" />
              {t("waiter.title")}
            </SheetTitle>
            <SheetDescription className="text-sm leading-relaxed text-yg-muted">
              {t("waiter.description")}
            </SheetDescription>
          </SheetHeader>
          {error ? (
            <Alert>
              <AlertDescription>
                {t("waiter.failed")}{" "}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loading || sending}
                  onClick={refresh}
                >
                  {t("actions.tryAgain")}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}
          <Tabs
            defaultValue="send"
            className="min-h-0 flex-1 gap-4 overflow-hidden"
          >
            <TabsList className="grid w-full shrink-0 grid-cols-2 border border-yg-line bg-yg-accent-soft group-data-horizontal/tabs:h-12">
              <TabsTrigger
                value="send"
                className="min-h-10 gap-2 text-sm text-yg-muted data-active:bg-yg-panel data-active:text-yg-accent-strong"
              >
                <Send className="size-4" />
                {t("waiter.sendTab")}
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="min-h-10 gap-2 text-sm text-yg-muted data-active:bg-yg-panel data-active:text-yg-accent-strong"
              >
                <History className="size-4" />
                {t("waiter.historyTab")}
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="send"
              className="min-h-0 overflow-y-auto overscroll-contain"
            >
              <div className="grid gap-4 pb-2">
                <fieldset className="grid grid-cols-3 gap-2">
                  <legend className="mb-2 text-sm font-medium">
                    {t("waiter.quickSelect")}
                  </legend>
                  {kinds.map((kind) => (
                    <label
                      key={kind}
                      className="relative flex min-h-20 min-w-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-yg-line px-2 py-3 text-sm transition-colors has-[[data-state=checked]]:border-yg-accent has-[[data-state=checked]]:bg-yg-accent-soft has-[[data-state=checked]]:text-yg-accent-strong has-[[data-disabled]]:cursor-not-allowed"
                    >
                      <Checkbox
                        checked={items[kind] ?? false}
                        disabled={
                          sending ||
                          (!items[kind] &&
                            message.length + t(`waiter.${kind}`).length + 1 >
                              500)
                        }
                        aria-label={t(`waiter.${kind}`)}
                        className="absolute right-2 top-2 size-4 border-yg-divider data-checked:border-yg-accent data-checked:bg-yg-accent data-checked:text-yg-on-accent"
                        onCheckedChange={(checked) => {
                          dirty();
                          const selected = checked === true;
                          const name = t(`waiter.${kind}`);
                          setItems((previous) => ({
                            ...previous,
                            [kind]: selected,
                          }));
                          setMessage((previous) => {
                            const lines = previous.split("\n");
                            if (selected) {
                              if (
                                lines.some((line) =>
                                  line.trim().startsWith(name)
                                )
                              )
                                return previous;
                              return previous ? `${previous}\n${name}` : name;
                            }
                            // Keep quantities and notes already edited by the customer.
                            return lines
                              .filter((line) => line.trim() !== name)
                              .join("\n");
                          });
                        }}
                      />
                      {(() => {
                        const Icon = itemIcons[kind];
                        return (
                          <Icon
                            aria-hidden="true"
                            className="size-5 text-yg-accent"
                          />
                        );
                      })()}
                      <span className="max-w-full break-words text-center">
                        {t(`waiter.${kind}`)}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <label className="grid gap-2 text-sm">
                  {t("waiter.message")}
                  <Textarea
                    value={message}
                    disabled={sending}
                    maxLength={500}
                    placeholder={t("waiter.messagePlaceholder")}
                    className="min-h-28 border-yg-line bg-yg-panel text-yg-ink"
                    onChange={(e) => {
                      dirty();
                      setMessage(e.target.value);
                    }}
                  />
                </label>
                <p className="flex justify-between gap-3 text-xs text-yg-muted">
                  <span>{t("waiter.quantityHint")}</span>
                  <span className="shrink-0 tabular-nums">
                    {message.length}/500
                  </span>
                </p>
              </div>
              <div className="sticky bottom-0 border-t border-yg-line bg-yg-panel pt-3">
                <Button
                  className="h-12 w-full gap-2 rounded-lg bg-yg-accent text-yg-on-accent hover:bg-yg-accent-strong"
                  disabled={sending || !message.trim()}
                  onClick={() => void submit()}
                >
                  {sending ? (
                    <LoaderCircle className="size-4 motion-safe:animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {t(sending ? "common.loading" : "waiter.send")}
                </Button>
              </div>
            </TabsContent>
            <TabsContent
              value="history"
              ref={historyScrollRef}
              className="min-h-0 overflow-y-auto overscroll-contain"
            >
              <PublicPullToRefresh
                scrollRef={historyScrollRef}
                onRefresh={refreshHistory}
              />
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-yg-muted">
                  {t("waiter.historyTab")} ({requests.length})
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-10 rounded-lg border-yg-line text-yg-accent-strong"
                  disabled={loading}
                  onClick={refresh}
                  aria-label={t("actions.tryAgain")}
                >
                  <RefreshCw className="size-4" />
                </Button>
              </div>
              {loading ? (
                <div
                  role="status"
                  aria-label={t("common.loading")}
                  className="grid gap-3"
                >
                  {[0, 1, 2].map((index) => (
                    <Skeleton
                      key={index}
                      className="h-24 rounded-lg bg-yg-accent-soft"
                    />
                  ))}
                </div>
              ) : requests.length ? (
                requests.map((r) => (
                  <div
                    key={r.request_uuid}
                    className="mb-3 rounded-lg border border-yg-line p-4 text-sm"
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-yg-accent-soft px-2 py-1 text-xs font-medium text-yg-accent-strong">
                        {r.status === 2 ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : (
                          <Clock3 className="size-3.5" />
                        )}
                        {t(`waiter.status${r.status}`)}
                      </span>
                      <time
                        dateTime={r.created_at}
                        className="text-xs tabular-nums text-yg-muted"
                      >
                        {new Date(r.created_at).toLocaleString(
                          i18n.language === "en" ? "en-GB" : "lo-LA",
                          {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </time>
                    </div>
                    {r.items.length ? (
                      <p className="mb-1 font-medium">
                        {r.items
                          .map((i) => `${t(`waiter.${i.kind}`)} ×${i.qty}`)
                          .join(" · ")}
                      </p>
                    ) : null}
                    {r.message ? (
                      <p className="whitespace-pre-wrap break-words leading-relaxed text-yg-ink">
                        {r.message}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <Empty className="min-h-52">
                  <EmptyHeader>
                    <EmptyMedia
                      variant="icon"
                      className="size-12 rounded-full bg-yg-accent-soft text-yg-accent"
                    >
                      <History className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle className="text-yg-muted">
                      {t("waiter.emptyHistory")}
                    </EmptyTitle>
                  </EmptyHeader>
                </Empty>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
