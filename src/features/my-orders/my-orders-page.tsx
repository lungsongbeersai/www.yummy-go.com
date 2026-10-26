"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Clock3, MapPin, PackageCheck, ReceiptText, Utensils } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ordersPlacedByMe, type MyOrder, type MyOrderStatus } from "@/features/my-orders/my-orders-data";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useMyOrdersStore } from "@/stores/my-orders-store";

const STATUS_TONE: Record<MyOrderStatus, string> = {
  ordered: "border-pending/30 bg-pending/10 text-pending",
  waiting_to_send: "border-warning/30 bg-warning/10 text-warning",
  sent_to_kitchen: "border-info/30 bg-info/10 text-info",
  preparing: "border-warning/30 bg-warning/10 text-warning",
  served: "border-success/30 bg-success/10 text-success",
};

const STATUS_ACCENT: Record<MyOrderStatus, string> = {
  ordered: "border-l-pending",
  waiting_to_send: "border-l-warning",
  sent_to_kitchen: "border-l-info",
  preparing: "border-l-warning",
  served: "border-l-success",
};

const STATUS_KEY: Record<MyOrderStatus, string> = {
  ordered: "myOrders.status.ordered",
  waiting_to_send: "myOrders.status.waiting_to_send",
  sent_to_kitchen: "myOrders.status.sent_to_kitchen",
  preparing: "myOrders.status.preparing",
  served: "myOrders.status.served",
};

function formatDate(value: string, options: Intl.DateTimeFormatOptions) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function OrderStatus({ status }: { status: MyOrderStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={`h-6 gap-1.5 rounded-full px-2.5 text-[0.6875rem] ${STATUS_TONE[status]}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {t(STATUS_KEY[status])}
    </Badge>
  );
}

function OrderCard({ order, selected, onSelect }: { order: MyOrder; selected: boolean; onSelect: () => void }) {
  const { t } = useTranslation();
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const contributors = order.placedBy === "You"
    ? t("myOrders.placedByYou")
    : order.isPlacedByMe
      ? t("myOrders.youAndContributors", { contributors: order.placedBy })
      : order.placedBy;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-xl text-left outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/50 ${selected ? "ring-2 ring-primary/70" : ""}`}
    >
      <Card className={`gap-0 border-l-4 py-0 transition-colors ${STATUS_ACCENT[order.status]} ${selected ? "bg-primary/5" : "hover:bg-muted/30"}`}>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">#{order.reference}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(order.placedAt, { hour: "2-digit", minute: "2-digit" })} · {t("myOrders.itemsCount", { count: itemCount })}</p>
            </div>
            <OrderStatus status={order.status} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-info/10 px-2 py-1 font-medium text-info"><MapPin className="size-3.5" aria-hidden="true" />{order.zone}</span>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 font-medium text-primary"><Utensils className="size-3.5" aria-hidden="true" />{t("myOrders.table")} {order.table}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-2.5 text-xs text-muted-foreground">
            <span className="truncate">{t("myOrders.placedBy")} <span className="font-medium text-foreground">{contributors}</span></span>
            <span className="ml-2 flex shrink-0 items-center gap-1"><Clock3 className="size-3.5" aria-hidden="true" />{formatDate(order.placedAt, { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function OrderDetails({ order }: { order: MyOrder }) {
  const { t } = useTranslation();
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const contributors = order.placedBy === "You"
    ? t("myOrders.placedByYou")
    : order.isPlacedByMe
      ? t("myOrders.youAndContributors", { contributors: order.placedBy })
      : order.placedBy;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-info/10 p-3 text-info">
          <p className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide opacity-80">{t("myOrders.zone")}</p>
          <p className="flex items-center gap-1.5 text-sm font-semibold"><MapPin className="size-4" aria-hidden="true" />{order.zone}</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-3 text-primary">
          <p className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide opacity-80">{t("myOrders.table")}</p>
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Utensils className="size-4" aria-hidden="true" />{order.table}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{order.placedBy === "You" ? t("myOrders.yourItems") : t("myOrders.orderItems")}</h3>
          <Badge variant="secondary" className="rounded-full tabular-nums">{t("myOrders.itemsCount", { count: itemCount })}</Badge>
        </div>
        <div className="divide-y rounded-lg border bg-card">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {order.placedBy === "You" ? t("myOrders.addedByYou") : item.placedBy}
                  {item.note ? ` · ${item.note}` : ""}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium tabular-nums">× {item.quantity}</span>
            </div>
          ))}
        </div>
      </div>

      <Separator />
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="min-w-0"><p className="mb-1 text-muted-foreground">{order.placedBy === "You" ? t("myOrders.placedBy") : t("myOrders.contributors")}</p><p className="truncate font-medium">{contributors}</p></div>
        <div><p className="mb-1 text-muted-foreground">{t("myOrders.placedAt")}</p><p className="flex items-center gap-1 font-medium"><Clock3 className="size-3.5" />{formatDate(order.placedAt, { dateStyle: "medium", timeStyle: "short" })}</p></div>
      </div>
    </div>
  );
}

function OrderListSkeleton() {
  return <div className="flex flex-col gap-3" aria-label="Loading orders">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-36 w-full rounded-xl" />)}</div>;
}

export function MyOrdersPage() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const orders = useMyOrdersStore((state) => state.orders);
  const loading = useMyOrdersStore((state) => state.loading);
  const error = useMyOrdersStore((state) => state.error);
  const load = useMyOrdersStore((state) => state.load);
  const [activeTab, setActiveTab] = useState("all");
  const [requestedOrderId, setRequestedOrderId] = useState<string | null>(null);
  const [isCompact, setIsCompact] = useState(true);

  useEffect(() => {
    if (!user?.branch_uuid) return;
    void load({ branchUuid: user.branch_uuid, userId: user.uuid, lang: language });
  }, [language, load, user?.branch_uuid, user?.uuid]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsCompact(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const showTabs = (user?.status ?? 0) >= 1 && (user?.status ?? 0) <= 3;
  const personalOrders = useMemo(() => ordersPlacedByMe(orders, user?.uuid ?? ""), [orders, user?.uuid]);
  const visibleOrders = activeTab === "mine" ? personalOrders : orders;
  const selectedOrderId = requestedOrderId && visibleOrders.some((order) => order.id === requestedOrderId)
    ? requestedOrderId
    : isCompact ? null : visibleOrders[0]?.id ?? null;
  const selectedOrder = visibleOrders.find((order) => order.id === selectedOrderId) ?? null;
  const kitchenCount = orders.filter((order) => order.status === "sent_to_kitchen" || order.status === "preparing").length;
  const retry = () => {
    if (user?.branch_uuid) void load({ branchUuid: user.branch_uuid, userId: user.uuid, lang: language });
  };

  const stats = [
    { label: t("myOrders.openOrders"), value: orders.length, icon: ReceiptText, tone: "text-primary bg-primary/10" },
    { label: t("myOrders.personalOrders"), value: personalOrders.length, icon: PackageCheck, tone: "text-info bg-info/10" },
    { label: t("myOrders.inKitchen"), value: kitchenCount, icon: Utensils, tone: "text-warning bg-warning/10" },
  ];

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 pb-8 sm:gap-6 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{t("myOrders.eyebrow")}</p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">{t("myOrders.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("myOrders.description")}</p>
        </div>
        <Badge variant="outline" className="h-7 w-fit gap-1.5 rounded-full px-2.5"><span className="size-1.5 rounded-full bg-success" />POS</Badge>
      </header>

      <section aria-label={t("myOrders.summary")} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon, tone }, index) => (
          <Card key={label} className={`py-0 ${index === 2 ? "col-span-2 sm:col-span-1" : ""}`}>
            <CardContent className="flex items-center gap-3 p-3.5 sm:p-4">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="size-5" aria-hidden="true" /></span>
              <div className="min-w-0"><p className="text-xl font-semibold tabular-nums">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {showTabs && (
          <TabsList className="grid min-h-11 w-full grid-cols-2 bg-muted/70 p-1 sm:w-fit sm:min-w-96">
            <TabsTrigger value="all" className="h-9 gap-2 px-4">{t("myOrders.allOrders")}<span className="rounded-full bg-background/80 px-2 py-0.5 text-[0.625rem]">{orders.length}</span></TabsTrigger>
            <TabsTrigger value="mine" className="h-9 gap-2 px-4">{t("myOrders.placedByMe")}<span className="rounded-full bg-background/80 px-2 py-0.5 text-[0.625rem]">{personalOrders.length}</span></TabsTrigger>
          </TabsList>
        )}

        <div className="grid gap-5 pt-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <section aria-label={t("myOrders.orderList")} className="flex min-w-0 flex-col gap-3">
            <div className="flex items-end justify-between gap-3 px-1">
              <div><h2 className="text-base font-semibold">{t("myOrders.orderList")}</h2><p className="text-xs text-muted-foreground">{t("myOrders.activeCount", { count: visibleOrders.length })} · {t("myOrders.checkedOutHidden")}</p></div>
              <span className="shrink-0 text-xs text-muted-foreground">{t("myOrders.newestFirst")}</span>
            </div>
            {error && <Alert variant="destructive"><AlertTitle>{t("myOrders.loadErrorTitle")}</AlertTitle><AlertDescription className="flex flex-wrap items-center justify-between gap-3"><span>{error}</span><Button variant="outline" size="sm" onClick={retry}>{t("myOrders.retry")}</Button></AlertDescription></Alert>}
            {loading ? <OrderListSkeleton /> : visibleOrders.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {visibleOrders.map((order) => <OrderCard key={order.id} order={order} selected={selectedOrderId === order.id} onSelect={() => setRequestedOrderId(order.id)} />)}
              </div>
            ) : !error ? (
              <Card>
                <Empty className="min-h-64">
                  <EmptyHeader><EmptyMedia variant="icon"><ReceiptText /></EmptyMedia><EmptyTitle>{t("myOrders.emptyTitle")}</EmptyTitle><EmptyDescription>{t("myOrders.emptyDescription")}</EmptyDescription></EmptyHeader>
                </Empty>
              </Card>
            ) : null}
          </section>

          <section aria-label={t("myOrders.details")} className="hidden min-w-0 lg:block">
            <Card className="sticky top-4 gap-0 py-0">
              <CardHeader className="border-b py-4"><CardTitle className="text-base">{t("myOrders.details")}</CardTitle></CardHeader>
              {selectedOrder ? (
                <CardContent className="flex flex-col gap-5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-lg font-semibold">#{selectedOrder.reference}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(selectedOrder.placedAt, { dateStyle: "medium", timeStyle: "short" })}</p></div>
                    <OrderStatus status={selectedOrder.status} />
                  </div>
                  <OrderDetails order={selectedOrder} />
                </CardContent>
              ) : (
                <Empty className="min-h-72"><EmptyHeader><EmptyMedia variant="icon"><ReceiptText /></EmptyMedia><EmptyTitle>{t("myOrders.selectOrder")}</EmptyTitle><EmptyDescription>{t("myOrders.selectOrderDescription")}</EmptyDescription></EmptyHeader></Empty>
              )}
            </Card>
          </section>
        </div>
      </Tabs>

      <Dialog open={Boolean(selectedOrder) && isCompact} onOpenChange={(open) => { if (!open) setRequestedOrderId(null); }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg lg:hidden">
          <DialogHeader><DialogTitle>{t("myOrders.details")} · #{selectedOrder?.reference}</DialogTitle><DialogDescription>{t("myOrders.table")} {selectedOrder?.table} · {selectedOrder?.zone}</DialogDescription></DialogHeader>
          {selectedOrder && <div className="flex justify-end"><OrderStatus status={selectedOrder.status} /></div>}
          {selectedOrder && <OrderDetails order={selectedOrder} />}
          <Button variant="outline" className="min-h-10" onClick={() => setRequestedOrderId(null)}>{t("myOrders.closeDetails")}</Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
