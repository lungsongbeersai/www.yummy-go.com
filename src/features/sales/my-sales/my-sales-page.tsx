"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RefreshCw, Search, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUrlPagination } from "@/hooks/use-url-pagination";
import type { UrlPaginationState } from "@/lib/url-pagination";
import type { MySalesParams } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useMySalesStore } from "@/stores/my-sales-store";
import { MySalesOrders } from "./my-sales-orders";
import {
  MY_SALES_KITCHEN_OPTIONS as KITCHEN_OPTIONS,
  MY_SALES_LIMIT_OPTIONS as LIMIT_OPTIONS,
  MY_SALES_PAYMENT_OPTIONS as PAYMENT_OPTIONS,
} from "./my-sales-options";

interface Filters {
  search: string;
  date_start: string;
  date_end: string;
  kitchen_status: NonNullable<MySalesParams["kitchen_status"]>;
  payment_status: NonNullable<MySalesParams["payment_status"]>;
}

const emptyFilters: Filters = { search: "", date_start: "", date_end: "", kitchen_status: "all", payment_status: "all" };

export function MySalesPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const user = useAuthStore((state) => state.user);
  const orders = useMySalesStore((state) => state.orders);
  const summary = useMySalesStore((state) => state.summary);
  const pagination = useMySalesStore((state) => state.pagination);
  const loading = useMySalesStore((state) => state.loading);
  const error = useMySalesStore((state) => state.error);
  const queryKey = useMySalesStore((state) => state.queryKey);
  const loadSales = useMySalesStore((state) => state.load);
  const reset = useMySalesStore((state) => state.reset);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const { page, limit, goToPage, changeLimit, resetPage } = useUrlPagination({ initialPagination, limitOptions: LIMIT_OPTIONS });
  const userUuid = user?.uuid ?? "";
  const branchUuid = user?.branch_uuid ?? "";
  const validDates = !draft.date_start || !draft.date_end || draft.date_start <= draft.date_end;
  const reload = useCallback(async () => {
    if (!userUuid) return;
    await loadSales({ ...filters, page, limit: typeof limit === "number" ? limit : 20, lang: language }, `${userUuid}:${branchUuid}`).catch(() => undefined);
  }, [branchUuid, filters, language, limit, loadSales, page, userUuid]);

  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, 30_000);
    const refreshOnFocus = () => { if (document.visibilityState === "visible") void reload(); };
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [reload]);

  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (queryKey && !loading && !error && page > Math.max(1, pagination.total_pages)) goToPage(Math.max(1, pagination.total_pages));
  }, [error, goToPage, loading, page, pagination.total_pages, queryKey]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validDates) return;
    setFilters({ ...draft, search: draft.search.trim() });
    resetPage();
  }

  const stats = [
    { label: t("mySales.orderCount"), value: summary.order_count },
    { label: t("mySales.pendingKitchen"), value: summary.pending_kitchen_count },
    { label: t("mySales.kitchen.sent"), value: summary.sent_kitchen_count },
    { label: t("mySales.payment.unpaid"), value: summary.unpaid_count },
    { label: t("mySales.payment.paid"), value: summary.paid_count },
    { label: t("mySales.payment.cancelled"), value: summary.cancelled_count },
  ];
  const start = orders.length ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const end = orders.length ? Math.min(pagination.total, start + orders.length - 1) : 0;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-muted/20 font-lao">
      <header className="shrink-0 border-b border-border bg-card px-3 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-base font-semibold"><UserRound className="size-4 shrink-0 text-primary-text" />{t("mySales.title")}</h1>
            <p className="mt-1 text-xs text-muted-foreground">{t("mySales.description")}{user?.branch_name ? ` · ${user.branch_name}` : ""}</p>
          </div>
          <Button type="button" variant="outline" className="min-h-10 shrink-0" disabled={loading} onClick={() => void reload()}><RefreshCw className="size-4" /><span className="hidden sm:inline">{t("mySales.refresh")}</span><span className="sr-only sm:hidden">{t("mySales.refresh")}</span></Button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-3 sm:p-5">
          <form onSubmit={applyFilters} className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-3 sm:p-4 lg:grid-cols-6">
            <div className="col-span-2 flex flex-col gap-1.5 lg:col-span-2">
              <Label htmlFor="my-sales-search">{t("mySales.search")}</Label>
              <Input id="my-sales-search" className="min-h-10" value={draft.search} placeholder={t("mySales.searchPlaceholder")} onChange={(event) => setDraft({ ...draft, search: event.target.value })} />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5"><Label htmlFor="my-sales-from">{t("mySales.dateFrom")}</Label><Input id="my-sales-from" className="min-h-10 min-w-0" type="date" value={draft.date_start} max={draft.date_end || undefined} onChange={(event) => setDraft({ ...draft, date_start: event.target.value })} /></div>
            <div className="flex min-w-0 flex-col gap-1.5"><Label htmlFor="my-sales-to">{t("mySales.dateTo")}</Label><Input id="my-sales-to" className="min-h-10 min-w-0" type="date" value={draft.date_end} min={draft.date_start || undefined} onChange={(event) => setDraft({ ...draft, date_end: event.target.value })} /></div>
            <div className="flex min-w-0 flex-col gap-1.5"><Label htmlFor="my-sales-kitchen">{t("mySales.kitchenLabel")}</Label><Select value={draft.kitchen_status} onValueChange={(value) => { if (KITCHEN_OPTIONS.some((option) => option === value)) setDraft({ ...draft, kitchen_status: value as Filters["kitchen_status"] }); }}><SelectTrigger id="my-sales-kitchen" className="min-h-10 w-full"><SelectValue /></SelectTrigger><SelectContent>{KITCHEN_OPTIONS.map((status) => <SelectItem key={status} value={status}>{t(`mySales.kitchen.${status}`)}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex min-w-0 flex-col gap-1.5"><Label htmlFor="my-sales-payment">{t("mySales.paymentLabel")}</Label><Select value={draft.payment_status} onValueChange={(value) => { if (PAYMENT_OPTIONS.some((option) => option === value)) setDraft({ ...draft, payment_status: value as Filters["payment_status"] }); }}><SelectTrigger id="my-sales-payment" className="min-h-10 w-full"><SelectValue /></SelectTrigger><SelectContent>{PAYMENT_OPTIONS.map((status) => <SelectItem key={status} value={status}>{t(`mySales.payment.${status}`)}</SelectItem>)}</SelectContent></Select></div>
            {!validDates ? <p className="col-span-2 text-xs text-destructive lg:col-span-6" role="alert">{t("mySales.invalidDates")}</p> : null}
            <div className="col-span-2 flex flex-wrap justify-end gap-2 lg:col-span-6">
              <Button type="button" variant="ghost" className="min-h-10" disabled={loading} onClick={() => { setDraft(emptyFilters); setFilters(emptyFilters); resetPage(); }}>{t("mySales.clearFilters")}</Button>
              <Button type="submit" className="min-h-10" disabled={loading || !validDates}><Search className="size-4" />{t("mySales.applyFilters")}</Button>
            </div>
          </form>
          {error ? <Alert variant="destructive"><AlertTitle>{t("mySales.loadFailed")}</AlertTitle><AlertDescription>{error}</AlertDescription><Button type="button" variant="outline" className="mt-2 min-h-10" onClick={() => void reload()}>{t("mySales.retry")}</Button></Alert> : null}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-live="polite">
            {stats.map((stat) => <div key={stat.label} className="rounded-lg border border-border bg-card px-3 py-3"><p className="text-xs text-muted-foreground">{stat.label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{stat.value.toLocaleString()}</p></div>)}
          </div>
          <section aria-label={t("mySales.title")} aria-busy={loading}>
            {(loading && !orders.length) || (!queryKey && userUuid) ? <LoadingState label={t("mySales.loading")} variant="table" /> : orders.length ? <MySalesOrders orders={orders} /> : !error ? <div className="rounded-lg border border-border bg-card py-8"><EmptyState title={t("mySales.empty")} description={t("mySales.emptyDescription")} /></div> : null}
          </section>
          <AppPagination disabled={loading} page={page} totalPages={pagination.total_pages} onPageChange={goToPage} rangeLabel={t("mySales.range", { start, end, total: pagination.total })} pageSize={{ value: limit, onChange: changeLimit, options: LIMIT_OPTIONS }} />
        </div>
      </div>
    </div>
  );
}
