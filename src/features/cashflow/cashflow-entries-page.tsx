"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CirclePlus, Info, Pencil, RefreshCw, Shapes, SlidersHorizontal, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportDateRangeFields } from "@/features/report/shared/report-filter-fields";
import { formatReportDateRange } from "@/features/report/shared/report-date-format";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { businessDateInputValue } from "@/lib/format";
import { canManageCashflow } from "@/lib/permissions";
import { internalRoute } from "@/lib/routes";
import type { CashflowDirection, CashflowEntry, FetchCashflowEntriesParams, SaveCashflowEntryInput } from "@/services/cashflow";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useBranchStore } from "@/stores/branch-store";
import { useCashflowStore } from "@/stores/cashflow-store";
import { createSessionGuard } from "@/stores/session-store-registry";
import { useToastStore } from "@/stores/toast-store";
import type { CashflowBranchControls } from "./cashflow-categories-page";
import { CashflowCategoryBadges } from "./cashflow-category-badges";
import { CashflowEntryDialog } from "./cashflow-entry-dialog";
import { cashflowEntryNote } from "./cashflow-entry-input";
import { formatCashflowAmount, formatCashflowDate, validCashflowDateRange } from "./cashflow-ui-utils";
import { CashflowAccessDenied, CashflowSelectField, CashflowWorkspace } from "./cashflow-workspace";

interface EntryFilters {
  dateFrom: string;
  dateTo: string;
  direction: "all" | CashflowDirection;
  categoryUuid: string;
}

function initialFilters(): EntryFilters {
  const today = businessDateInputValue();
  return { dateFrom: `${today.slice(0, 7)}-01`, dateTo: today, direction: "all", categoryUuid: "all" };
}

export function CashflowEntriesPage() {
  const user = useAuthStore((state) => state.user);
  if (!canManageCashflow(user?.status)) return <CashflowAccessDenied />;
  return <CashflowEntriesBranchPage key={`${authStoreUuid(user)}:${user?.branch_uuid}:${user?.status}`} />;
}

function CashflowEntriesBranchPage() {
  const scope = useReportBranchSelection();
  const [selection, setSelection] = useState(scope.defaultBranchUuid);
  const branchUuid = scope.normalizeBranchFilters({ branchUuid: selection }).branchUuid;
  return <EntriesList key={branchUuid} branchUuid={branchUuid} branchLabel={scope.branchLabelFor(branchUuid)}
    branchOptions={scope.branchOptions} branchLoading={scope.branchLoading} branchError={scope.branchError}
    canSelectBranch={scope.canSelectBranch} onBranchChange={setSelection} />;
}

function EntriesList({ branchUuid, branchLabel, branchOptions, branchLoading, branchError, canSelectBranch, onBranchChange }: CashflowBranchControls) {
  const { t, i18n } = useTranslation();
  const entries = useCashflowStore((state) => state.entries);
  const categories = useCashflowStore((state) => state.categories);
  const entriesBranchUuid = useCashflowStore((state) => state.entriesBranchUuid);
  const categoriesBranchUuid = useCashflowStore((state) => state.categoriesBranchUuid);
  const loading = useCashflowStore((state) => state.entriesLoading);
  const categoriesLoading = useCashflowStore((state) => state.categoriesLoading);
  const saving = useCashflowStore((state) => state.saving);
  const error = useCashflowStore((state) => state.error);
  const categoriesError = useCashflowStore((state) => state.categoriesError);
  const entriesError = useCashflowStore((state) => state.entriesError);
  const total = useCashflowStore((state) => state.total);
  const totalPages = useCashflowStore((state) => state.totalPages);
  const load = useCashflowStore((state) => state.loadEntries);
  const loadCategories = useCashflowStore((state) => state.loadCategories);
  const save = useCashflowStore((state) => state.saveEntry);
  const remove = useCashflowStore((state) => state.removeEntry);
  const showToast = useToastStore((state) => state.show);
  const setSelectedBranch = useBranchStore((state) => state.setSelectedBranch);
  const [filters, setFilters] = useState<EntryFilters>(initialFilters);
  const [dateDraft, setDateDraft] = useState(() => ({ from: initialFilters().dateFrom, to: initialFilters().dateTo }));
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CashflowEntry | null>(null);
  const [newDirection, setNewDirection] = useState<CashflowDirection>("expense");
  const [deleteTarget, setDeleteTarget] = useState<CashflowEntry | null>(null);
  const mounted = useRef(true);
  const visibleEntries = entriesBranchUuid === branchUuid ? entries : [];
  const visibleCategories = categoriesBranchUuid === branchUuid ? categories : [];
  const validDates = validCashflowDateRange(dateDraft.from, dateDraft.to);
  const request = useMemo<FetchCashflowEntriesParams>(() => ({
    branch_uuid_fk: branchUuid, date_from: filters.dateFrom, date_to: filters.dateTo, page, limit: 20,
    direction: filters.direction, category_uuid_fk: filters.categoryUuid === "all" ? undefined : filters.categoryUuid,
  }), [branchUuid, filters, page]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (branchUuid) void load(request).catch(() => undefined); }, [branchUuid, request, load]);
  useEffect(() => {
    if (branchUuid) void loadCategories({ branch_uuid_fk: branchUuid, include_inactive: true }).catch(() => undefined);
  }, [branchUuid, loadCategories]);

  async function refresh() {
    await Promise.allSettled([load(request), loadCategories({ branch_uuid_fk: branchUuid, include_inactive: true })]);
  }

  function selectCategory(categoryUuid: string) {
    setPage(1);
    setFilters((current) => ({ ...current, categoryUuid }));
  }

  async function handleSave(input: SaveCashflowEntryInput) {
    const isSession = createSessionGuard();
    try {
      const saved = await save(input);
      if (!mounted.current || !isSession()) return;
      setDialogOpen(false);
      setPage(1);
      // Keep the saved row visible even when its date or category changed.
      setFilters((current) => ({
        ...current,
        ...(saved.entry_date < current.dateFrom || saved.entry_date > current.dateTo
          ? { dateFrom: saved.entry_date, dateTo: saved.entry_date } : {}),
        direction: current.direction === "all" ? "all" : saved.direction,
        categoryUuid: current.categoryUuid === "all" ? "all" : saved.category_uuid_fk,
      }));
      showToast({ title: t("cashflow.entrySaved", { defaultValue: "Entry saved" }), tone: "success" });
    } catch (failure: unknown) {
      if (mounted.current && isSession()) showToast({ title: t("settings.saveFailed"),
        description: failure instanceof Error ? failure.message : t("toasts.pleaseTryAgain"), tone: "error" });
    }
  }

  async function handleDelete() {
    if (!deleteTarget || saving) return;
    const isSession = createSessionGuard();
    try {
      await remove(deleteTarget.entry_uuid, deleteTarget.version, branchUuid);
      if (!mounted.current || !isSession()) return;
      setDeleteTarget(null);
      showToast({ title: t("cashflow.entryDeleted", { defaultValue: "Entry deleted" }), tone: "success" });
      if (visibleEntries.length === 1 && page > 1) setPage(page - 1);
      else await load(request).catch(() => undefined);
    } catch (failure: unknown) {
      if (mounted.current && isSession()) showToast({ title: t("settings.deleteFailed"),
        description: failure instanceof Error ? failure.message : t("toasts.pleaseTryAgain"), tone: "error" });
    }
  }

  function openCreate(direction: CashflowDirection) {
    setEditing(null);
    setNewDirection(direction);
    setDialogOpen(true);
  }

  const rowActions = (row: CashflowEntry) => <div className="flex shrink-0 gap-1">
    <Button type="button" size="icon" variant="ghost" className="min-h-11 min-w-11" disabled={saving}
      aria-label={`${t("actions.edit")} ${row.note || row.description || row.category_name}`}
      onClick={() => { setEditing(row); setDialogOpen(true); }}><Pencil className="size-4" aria-hidden /></Button>
    <Button type="button" size="icon" variant="ghost" className="min-h-11 min-w-11 text-destructive" disabled={saving}
      aria-label={`${t("actions.delete")} ${row.note || row.description || row.category_name}`}
      onClick={() => setDeleteTarget(row)}><Trash2 className="size-4" aria-hidden /></Button>
  </div>;
  const amount = (row: CashflowEntry) => <span className={`whitespace-nowrap font-bold tabular-nums ${row.direction === "income" ? "text-success" : "text-destructive"}`}>
    {row.direction === "income" ? "+" : "−"}{formatCashflowAmount(row.amount, row.currency)}
  </span>;
  const categoryBadge = (row: CashflowEntry) => <Badge asChild variant="outline" className={`h-auto max-w-full gap-1.5 whitespace-normal px-3 text-sm ${row.direction === "income" ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
    <button type="button" className="min-h-11 text-left" disabled={saving}
      onClick={() => selectCategory(row.category_uuid_fk)}>{row.direction === "income" ? <ArrowDownLeft aria-hidden /> : <ArrowUpRight aria-hidden />}<span className="sr-only">{t(`cashflow.directions.${row.direction}`)}: </span>{row.category_name}</button>
  </Badge>;

  return <CashflowWorkspace compact active="entries" title={t("cashflow.entriesTitle")} description="" branchLabel={branchLabel} branchUuid={branchUuid}
    actions={<>
      <Button id="cashflow-add-income" type="button" className="min-h-11" variant="outline"
        aria-label={t("cashflow.addIncome")} disabled={!branchUuid || saving || categoriesLoading} onClick={() => openCreate("income")}>
        <CirclePlus className="size-4" aria-hidden />{t("cashflow.addIncome")}
      </Button>
      <Button id="cashflow-add-expense" type="button" className="min-h-11"
        aria-label={t("cashflow.addExpense")} disabled={!branchUuid || saving || categoriesLoading} onClick={() => openCreate("expense")}>
        <CirclePlus className="size-4" aria-hidden />{t("cashflow.addExpense")}
      </Button>
    </>}>
    {branchError || error || entriesError || categoriesError ? <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-2">
      <span>{branchError || error || entriesError || categoriesError}</span><Button type="button" variant="outline" size="sm" disabled={loading || !branchUuid} onClick={() => void refresh()}>{t("actions.tryAgain")}</Button>
    </AlertDescription></Alert> : null}

    <div className="flex items-start gap-2 rounded-lg bg-info/10 px-3 py-2.5 text-sm text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden /><p>{t("cashflow.salesAutomaticHint")}</p></div>

    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-3 sm:p-4" aria-label={t("report.filters.currentFilters")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button type="button" variant="outline" className="min-h-11 min-w-0" aria-label={t("report.filters.openFilters")}
            onClick={() => { setDateDraft({ from: filters.dateFrom, to: filters.dateTo }); setFilterOpen(true); }}>
            <SlidersHorizontal className="size-4 shrink-0" aria-hidden /><span className="truncate">{formatReportDateRange(filters.dateFrom, filters.dateTo)}</span>
          </Button>
          <Button type="button" variant="outline" size="icon" className="min-h-11 min-w-11" disabled={loading || !branchUuid}
            onClick={() => void refresh()} aria-label={t("cashflow.refresh")}><RefreshCw aria-hidden className={loading ? "size-4 animate-spin" : "size-4"} /></Button>
        </div>
        <div className="flex rounded-lg bg-muted p-1" role="group" aria-label={t("cashflow.directionLabel")}>
          {(["all", "income", "expense"] as const).map((direction) => <Button key={direction} type="button" size="sm"
            className="min-h-10 px-3" aria-pressed={filters.direction === direction} disabled={saving}
            variant={filters.direction === direction ? "default" : "ghost"}
            onClick={() => { setPage(1); setFilters((current) => ({ ...current, direction, categoryUuid: "all" })); }}>
            {direction === "all" ? t("common.all") : t(`cashflow.directions.${direction}`)}
          </Button>)}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-sm font-medium">{t("cashflow.fields.category")}</span>
        <Button asChild type="button" variant="ghost" size="sm" className="min-h-11 text-muted-foreground"><Link href={internalRoute("/finance/categories")} onClick={() => setSelectedBranch(branchUuid)}><Shapes className="size-4" aria-hidden />{t("cashflow.manageCategories")}</Link></Button>
      </div>
      <CashflowCategoryBadges categories={visibleCategories} direction={filters.direction}
        selectedUuid={filters.categoryUuid} onSelect={selectCategory} disabled={saving || !branchUuid} loading={categoriesLoading} allowAll />
    </section>

    {loading || entriesBranchUuid !== branchUuid ? <div className="flex flex-col gap-2" role="status" aria-label={t("common.loading")}>
      {[0, 1, 2].map((key) => <Skeleton key={key} className="h-20 w-full rounded-lg" />)}
    </div> : visibleEntries.length ? <section className="overflow-hidden rounded-xl border border-border bg-card" aria-label={t("cashflow.entriesTitle")}>
      <div className="divide-y divide-border md:hidden">{visibleEntries.map((row) => <article key={row.entry_uuid} data-entry-uuid={row.entry_uuid} className="flex flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm text-muted-foreground">{formatCashflowDate(row.entry_date, i18n.language)}</span>{amount(row)}</div>
        <div className="flex items-start justify-between gap-2"><div className="flex min-w-0 flex-1 flex-col gap-2">{categoryBadge(row)}<p data-entry-note={row.entry_uuid} title={cashflowEntryNote(row)} className="line-clamp-2 break-words text-sm">{cashflowEntryNote(row) || "—"}</p></div>{rowActions(row)}</div>
      </article>)}</div>
      <div className="hidden overflow-x-auto md:block"><Table>
        <TableHeader><TableRow><TableHead>{t("cashflow.fields.date")}</TableHead><TableHead>{t("cashflow.fields.category")}</TableHead><TableHead className="text-right">{t("cashflow.fields.amount")}</TableHead><TableHead>{t("cashflow.fields.note")}</TableHead></TableRow></TableHeader>
        <TableBody>{visibleEntries.map((row) => <TableRow key={row.entry_uuid} data-entry-uuid={row.entry_uuid}>
          <TableCell className="whitespace-nowrap">{formatCashflowDate(row.entry_date, i18n.language)}</TableCell><TableCell>{categoryBadge(row)}</TableCell><TableCell className="text-right">{amount(row)}</TableCell>
          <TableCell><div className="flex items-center justify-between gap-3"><span data-entry-note={row.entry_uuid} title={cashflowEntryNote(row)} className="line-clamp-2 max-w-md break-words">{cashflowEntryNote(row) || "—"}</span>{rowActions(row)}</div></TableCell>
        </TableRow>)}</TableBody>
      </Table></div>
      <div className="border-t border-border px-3 py-2"><AppPagination page={page} totalPages={totalPages} onPageChange={setPage}
        disabled={loading || saving} rangeLabel={t("cashflow.recordCount", { count: total })} /></div>
    </section> : <EmptyState title={t("cashflow.noEntries")} description={t("cashflow.noEntriesHint")} />}

    <CashflowEntryDialog key={`${editing?.entry_uuid ?? "new"}:${newDirection}:${dialogOpen}`} branchUuid={branchUuid} branchLabel={branchLabel}
      open={dialogOpen} saving={saving} editing={editing} initialDirection={newDirection} categories={visibleCategories}
      categoriesLoading={categoriesLoading} error={error} onOpenChange={(open) => { if (!saving) setDialogOpen(open); }} onSave={handleSave} />
    <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !saving) setDeleteTarget(null); }}
      title={t("cashflow.deleteEntry")} description={t("cashflow.deleteEntryHint")} cancelLabel={t("actions.cancel")}
      confirmLabel={t("actions.delete")} confirmPending={saving} onConfirm={() => void handleDelete()} />
    <Dialog open={filterOpen} onOpenChange={setFilterOpen}><DialogContent className="sm:max-w-lg">
      <DialogHeader><DialogTitle>{t("report.filters.currentFilters")}</DialogTitle><DialogDescription className="sr-only">{formatReportDateRange(filters.dateFrom, filters.dateTo)}</DialogDescription></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        {canSelectBranch && branchOptions.length > 1 ? <div className="sm:col-span-2"><CashflowSelectField id="cashflow-entry-branch" label={t("nav.branch")} value={branchUuid} options={branchOptions}
          disabled={branchLoading || saving} onValueChange={onBranchChange} /></div> : null}
        <ReportDateRangeFields idPrefix="cashflow-entry-filter" dateFrom={dateDraft.from} dateTo={dateDraft.to}
          onDateFromChange={(from) => setDateDraft((current) => ({ ...current, from }))} onDateToChange={(to) => setDateDraft((current) => ({ ...current, to }))} />
      </div>
      {!validDates ? <p className="text-sm text-destructive">{t("cashflow.invalidDateRange")}</p> : null}
      <DialogFooter><Button type="button" variant="outline" onClick={() => setFilterOpen(false)}>{t("actions.close")}</Button>
        <Button type="button" disabled={!validDates || !branchUuid} onClick={() => { setPage(1); setFilters((current) => ({ ...current, dateFrom: dateDraft.from, dateTo: dateDraft.to })); setFilterOpen(false); }}>{t("cashflow.applyFilters")}</Button>
      </DialogFooter>
    </DialogContent></Dialog>
  </CashflowWorkspace>;
}
