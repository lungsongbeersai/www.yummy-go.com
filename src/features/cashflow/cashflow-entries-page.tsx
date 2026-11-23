"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CirclePlus, Info, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { businessDateInputValue } from "@/lib/format";
import { canManageCashflow } from "@/lib/permissions";
import { internalRoute } from "@/lib/routes";
import type {
  CashflowDirection,
  CashflowEntry,
  CashflowPaymentMethod,
  FetchCashflowEntriesParams,
  SaveCashflowEntryInput,
} from "@/services/cashflow";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCashflowStore } from "@/stores/cashflow-store";
import { createSessionGuard } from "@/stores/session-store-registry";
import { useToastStore } from "@/stores/toast-store";
import type { CashflowBranchControls } from "./cashflow-categories-page";
import { CashflowEntryDialog } from "./cashflow-entry-dialog";
import {
  formatCashflowAmount,
  formatCashflowDate,
  validCashflowDateRange,
} from "./cashflow-ui-utils";
import {
  CashflowAccessDenied,
  CashflowSelectField,
  CashflowWorkspace,
} from "./cashflow-workspace";

interface EntryFilters {
  dateFrom: string;
  dateTo: string;
  direction: "all" | CashflowDirection;
  expenseGroup: "all" | "shop" | "other";
  categoryUuid: string;
  paymentMethod: "all" | CashflowPaymentMethod;
  search: string;
}

function initialFilters(): EntryFilters {
  const today = businessDateInputValue();
  return {
    dateFrom: `${today.slice(0, 7)}-01`,
    dateTo: today,
    direction: "all",
    expenseGroup: "all",
    categoryUuid: "all",
    paymentMethod: "all",
    search: "",
  };
}

export function CashflowEntriesPage() {
  const user = useAuthStore((state) => state.user);
  if (!canManageCashflow(user?.status)) return <CashflowAccessDenied />;
  return (
    <CashflowEntriesBranchPage
      key={`${authStoreUuid(user)}:${user?.branch_uuid}:${user?.status}`}
    />
  );
}

function CashflowEntriesBranchPage() {
  const scope = useReportBranchSelection();
  const [selection, setSelection] = useState(scope.defaultBranchUuid);
  const branchUuid = scope.normalizeBranchFilters({
    branchUuid: selection,
  }).branchUuid;
  return (
    <EntriesList
      key={branchUuid}
      branchUuid={branchUuid}
      branchLabel={scope.branchLabelFor(branchUuid)}
      branchOptions={scope.branchOptions}
      branchLoading={scope.branchLoading}
      branchError={scope.branchError}
      canSelectBranch={scope.canSelectBranch}
      onBranchChange={setSelection}
    />
  );
}

function EntriesList({
  branchUuid,
  branchLabel,
  branchOptions,
  branchLoading,
  branchError,
  canSelectBranch,
  onBranchChange,
}: CashflowBranchControls) {
  const { t, i18n } = useTranslation();
  const entries = useCashflowStore((state) => state.entries);
  const categories = useCashflowStore((state) => state.categories);
  const entriesBranchUuid = useCashflowStore(
    (state) => state.entriesBranchUuid
  );
  const categoriesBranchUuid = useCashflowStore(
    (state) => state.categoriesBranchUuid
  );
  const loading = useCashflowStore((state) => state.entriesLoading);
  const categoriesLoading = useCashflowStore(
    (state) => state.categoriesLoading
  );
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
  const [draft, setDraft] = useState<EntryFilters>(initialFilters);
  const [applied, setApplied] = useState(draft);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CashflowEntry | null>(null);
  const [newDirection, setNewDirection] =
    useState<CashflowDirection>("expense");
  const [deleteTarget, setDeleteTarget] = useState<CashflowEntry | null>(null);
  const mounted = useRef(true);
  const visibleEntries = entriesBranchUuid === branchUuid ? entries : [];
  const visibleCategories =
    categoriesBranchUuid === branchUuid ? categories : [];
  const validDates = validCashflowDateRange(draft.dateFrom, draft.dateTo);
  const request = useMemo<FetchCashflowEntriesParams>(
    () => ({
      branch_uuid_fk: branchUuid,
      date_from: applied.dateFrom,
      date_to: applied.dateTo,
      page,
      limit: 20,
      direction: applied.direction,
      expense_group: applied.expenseGroup,
      category_uuid_fk:
        applied.categoryUuid === "all" ? undefined : applied.categoryUuid,
      payment_method: applied.paymentMethod,
      search: applied.search.trim(),
    }),
    [branchUuid, applied, page]
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (branchUuid) void load(request).catch(() => undefined);
  }, [branchUuid, request, load]);
  useEffect(() => {
    if (branchUuid)
      void loadCategories({
        branch_uuid_fk: branchUuid,
        include_inactive: true,
      }).catch(() => undefined);
  }, [branchUuid, loadCategories]);

  const paymentLabel = (value: CashflowPaymentMethod) =>
    t(`cashflow.paymentMethods.${value}`, {
      defaultValue:
        value === "cash"
          ? "Cash"
          : value === "transfer"
          ? "Bank transfer"
          : "Other",
    });
  const sourceLabel = (row: CashflowEntry) =>
    row.direction === "income"
      ? t("cashflow.otherIncome", { defaultValue: "Other income" })
      : t(`cashflow.expenseGroups.${row.expense_group || "other"}`, {
          defaultValue:
            row.expense_group === "shop" ? "Shop expense" : "Other expense",
        });
  const categoryOptions = visibleCategories
    .filter(
      (category) =>
        draft.direction === "all" ||
        category.direction === "both" ||
        category.direction === draft.direction
    )
    .map((category) => ({
      value: category.category_uuid,
      label: category.name,
    }));

  async function refresh() {
    await Promise.allSettled([
      load(request),
      loadCategories({ branch_uuid_fk: branchUuid, include_inactive: true }),
    ]);
  }

  async function handleSave(input: SaveCashflowEntryInput) {
    const isSession = createSessionGuard();
    try {
      await save(input);
      if (!mounted.current || !isSession()) return;
      setDialogOpen(false);
      showToast({
        title: t("cashflow.entrySaved", { defaultValue: "Entry saved" }),
        tone: "success",
      });
      await load(request).catch(() => undefined);
    } catch (failure: unknown) {
      if (mounted.current && isSession())
        showToast({
          title: t("settings.saveFailed"),
          description:
            failure instanceof Error
              ? failure.message
              : t("toasts.pleaseTryAgain"),
          tone: "error",
        });
    }
  }

  async function handleDelete() {
    if (!deleteTarget || saving) return;
    const isSession = createSessionGuard();
    try {
      await remove(deleteTarget.entry_uuid, deleteTarget.version, branchUuid);
      if (!mounted.current || !isSession()) return;
      setDeleteTarget(null);
      showToast({
        title: t("cashflow.entryDeleted", { defaultValue: "Entry deleted" }),
        tone: "success",
      });
      if (visibleEntries.length === 1 && page > 1) setPage(page - 1);
      else await load(request).catch(() => undefined);
    } catch (failure: unknown) {
      if (mounted.current && isSession())
        showToast({
          title: t("settings.deleteFailed"),
          description:
            failure instanceof Error
              ? failure.message
              : t("toasts.pleaseTryAgain"),
          tone: "error",
        });
    }
  }

  function openCreate(direction: CashflowDirection) {
    setEditing(null);
    setNewDirection(direction);
    setDialogOpen(true);
  }

  const rowActions = (row: CashflowEntry) => (
    <div className="flex shrink-0 justify-end gap-1">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="min-h-11 min-w-11"
        disabled={saving}
        aria-label={`${t("actions.edit")} ${row.description}`}
        onClick={() => {
          setEditing(row);
          setDialogOpen(true);
        }}
      >
        <Pencil aria-hidden />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="min-h-11 min-w-11 text-destructive"
        disabled={saving}
        aria-label={`${t("actions.delete")} ${row.description}`}
        onClick={() => setDeleteTarget(row)}
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
  const amount = (row: CashflowEntry) => (
    <span
      className={`font-bold tabular-nums ${
        row.direction === "income" ? "text-success" : "text-destructive"
      }`}
    >
      {row.direction === "income" ? "+" : "−"}
      {formatCashflowAmount(row.amount, row.currency)}
    </span>
  );

  return (
    <CashflowWorkspace
      active="entries"
      title={t("cashflow.entriesTitle", {
        defaultValue: "Income and expenses",
      })}
      description={t("cashflow.entriesHint", {
        defaultValue:
          "Record other income, shop expenses, and other expenses for the selected branch.",
      })}
      branchLabel={branchLabel}
      actions={
        <>
          <Button
            className="min-h-11"
            variant="outline"
            disabled={!branchUuid || saving || categoriesLoading}
            onClick={() => openCreate("income")}
          >
            <CirclePlus aria-hidden />
            {t("cashflow.addIncome", { defaultValue: "Add income" })}
          </Button>
          <Button
            className="min-h-11"
            disabled={!branchUuid || saving || categoriesLoading}
            onClick={() => openCreate("expense")}
          >
            <CirclePlus aria-hidden />
            {t("cashflow.addExpense", { defaultValue: "Add expense" })}
          </Button>
        </>
      }
    >
      <Alert>
        <Info aria-hidden />
        <AlertDescription className="text-sm leading-6">
          {t("cashflow.salesAutomaticHint", {
            defaultValue:
              "Sales income is included automatically in the report. Add only other income here to avoid counting sales twice.",
          })}{" "}
          <Link
            href={internalRoute("/report/income-expenses")}
            className="font-semibold underline underline-offset-4"
          >
            {t("cashflow.viewReport", { defaultValue: "View report" })}
          </Link>
        </AlertDescription>
      </Alert>
      {branchError || error || entriesError || categoriesError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {branchError || error || entriesError || categoriesError}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || !branchUuid}
              onClick={() => void refresh()}
            >
              <RefreshCw aria-hidden />
              {t("actions.tryAgain")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <form
        className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (validDates && branchUuid) {
            setPage(1);
            setApplied({ ...draft });
          }
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CashflowSelectField
            id="cashflow-entry-branch"
            label={t("nav.branch")}
            value={branchUuid}
            options={branchOptions}
            disabled={!canSelectBranch || branchLoading || saving}
            onValueChange={onBranchChange}
          />
          <Field className="gap-2">
            <FieldLabel htmlFor="cashflow-date-from">
              {t("cashflow.fields.dateFrom", { defaultValue: "From date" })}
            </FieldLabel>
            <Input
              id="cashflow-date-from"
              className="min-h-11"
              type="date"
              required
              value={draft.dateFrom}
              max={draft.dateTo || undefined}
              onChange={(event) =>
                setDraft({ ...draft, dateFrom: event.target.value })
              }
            />
          </Field>
          <Field className="gap-2">
            <FieldLabel htmlFor="cashflow-date-to">
              {t("cashflow.fields.dateTo", { defaultValue: "To date" })}
            </FieldLabel>
            <Input
              id="cashflow-date-to"
              className="min-h-11"
              type="date"
              required
              value={draft.dateTo}
              min={draft.dateFrom || undefined}
              onChange={(event) =>
                setDraft({ ...draft, dateTo: event.target.value })
              }
            />
          </Field>
          <CashflowSelectField
            id="cashflow-entry-direction"
            label={t("cashflow.directionLabel", { defaultValue: "Type" })}
            value={draft.direction}
            onValueChange={(value) =>
              setDraft({
                ...draft,
                direction: value as EntryFilters["direction"],
                expenseGroup: "all",
                categoryUuid: "all",
              })
            }
            options={[
              { value: "all", label: t("common.all") },
              {
                value: "income",
                label: t("cashflow.directions.income", {
                  defaultValue: "Income",
                }),
              },
              {
                value: "expense",
                label: t("cashflow.directions.expense", {
                  defaultValue: "Expense",
                }),
              },
            ]}
          />
          <CashflowSelectField
            id="cashflow-entry-expense-group"
            label={t("cashflow.fields.expenseGroup", {
              defaultValue: "Expense group",
            })}
            value={draft.expenseGroup}
            disabled={draft.direction === "income"}
            onValueChange={(value) =>
              setDraft({
                ...draft,
                expenseGroup: value as EntryFilters["expenseGroup"],
              })
            }
            options={[
              { value: "all", label: t("common.all") },
              {
                value: "shop",
                label: t("cashflow.expenseGroups.shop", {
                  defaultValue: "Shop expense",
                }),
              },
              {
                value: "other",
                label: t("cashflow.expenseGroups.other", {
                  defaultValue: "Other expense",
                }),
              },
            ]}
          />
          <CashflowSelectField
            id="cashflow-entry-category"
            label={t("cashflow.fields.category", { defaultValue: "Category" })}
            value={draft.categoryUuid}
            disabled={categoriesLoading}
            onValueChange={(value) =>
              setDraft({ ...draft, categoryUuid: value })
            }
            options={[
              { value: "all", label: t("common.all") },
              ...categoryOptions,
            ]}
          />
          <CashflowSelectField
            id="cashflow-entry-payment"
            label={t("cashflow.fields.paymentMethod", {
              defaultValue: "Payment method",
            })}
            value={draft.paymentMethod}
            onValueChange={(value) =>
              setDraft({
                ...draft,
                paymentMethod: value as EntryFilters["paymentMethod"],
              })
            }
            options={[
              { value: "all", label: t("common.all") },
              ...(["cash", "transfer", "other"] as const).map((value) => ({
                value,
                label: paymentLabel(value),
              })),
            ]}
          />
          <Field className="gap-2">
            <FieldLabel htmlFor="cashflow-entry-search">
              {t("common.search")}
            </FieldLabel>
            <Input
              id="cashflow-entry-search"
              className="min-h-11"
              value={draft.search}
              onChange={(event) =>
                setDraft({ ...draft, search: event.target.value })
              }
              placeholder={t("cashflow.searchEntries", {
                defaultValue: "Description or reference",
              })}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          {!validDates ? (
            <p className="text-sm text-destructive">
              {t("cashflow.invalidDateRange", {
                defaultValue: "Choose a valid date range.",
              })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("cashflow.baseCurrencyHint", {
                defaultValue:
                  "Reports combine all currencies in LAK using each entry's saved rate.",
              })}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={loading || !branchUuid}
              onClick={() => void refresh()}
              aria-label={t("cashflow.refresh", { defaultValue: "Refresh" })}
            >
              <RefreshCw aria-hidden />
            </Button>
            <Button
              type="submit"
              className="min-h-11"
              disabled={!validDates || !branchUuid || loading}
            >
              {t("cashflow.applyFilters", { defaultValue: "Apply filters" })}
            </Button>
          </div>
        </div>
      </form>
      {loading || entriesBranchUuid !== branchUuid ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : visibleEntries.length ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="divide-y divide-border md:hidden">
            {visibleEntries.map((row) => (
              <article key={row.entry_uuid} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <h2 className="break-words font-bold">{row.description}</h2>
                    <p className="break-words text-sm text-muted-foreground">
                      {row.category_name}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {sourceLabel(row)}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    {amount(row)}
                    {row.currency !== "LAK" ? (
                      <p className="text-sm tabular-nums text-muted-foreground">
                        ≈ {formatCashflowAmount(row.base_amount)}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatCashflowDate(row.entry_date, i18n.language)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
                  <p className="text-sm text-muted-foreground">
                    {paymentLabel(row.payment_method)}
                    {row.reference ? ` · ${row.reference}` : ""}
                  </p>
                  {rowActions(row)}
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("cashflow.fields.date", { defaultValue: "Date" })}
                  </TableHead>
                  <TableHead>
                    {t("cashflow.fields.description", {
                      defaultValue: "Description",
                    })}
                  </TableHead>
                  <TableHead>
                    {t("cashflow.directionLabel", { defaultValue: "Type" })}
                  </TableHead>
                  <TableHead>
                    {t("cashflow.fields.paymentMethod", {
                      defaultValue: "Payment method",
                    })}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("cashflow.fields.amount", { defaultValue: "Amount" })}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("cashflow.fields.baseAmount", {
                      defaultValue: "Amount in LAK",
                    })}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEntries.map((row) => (
                  <TableRow key={row.entry_uuid}>
                    <TableCell className="whitespace-nowrap">
                      {formatCashflowDate(row.entry_date, i18n.language)}
                    </TableCell>
                    <TableCell className="max-w-sm">
                      <p className="whitespace-normal break-words font-semibold">
                        {row.description}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {row.category_name}
                        {row.reference ? ` · ${row.reference}` : ""}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{sourceLabel(row)}</Badge>
                    </TableCell>
                    <TableCell>{paymentLabel(row.payment_method)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {amount(row)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {formatCashflowAmount(row.base_amount)}
                    </TableCell>
                    <TableCell>{rowActions(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t border-border p-4">
            <AppPagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              disabled={loading || saving}
              rangeLabel={t("cashflow.recordCount", {
                count: total,
                defaultValue: "{{count}} records",
              })}
            />
          </div>
        </section>
      ) : (
        <EmptyState
          title={t("cashflow.noEntries", { defaultValue: "No entries found" })}
          description={t("cashflow.noEntriesHint", {
            defaultValue:
              "Add other income or an expense, or choose another date range.",
          })}
        />
      )}
      <CashflowEntryDialog
        key={`${editing?.entry_uuid ?? "new"}:${newDirection}:${dialogOpen}`}
        branchUuid={branchUuid}
        branchLabel={branchLabel}
        open={dialogOpen}
        saving={saving}
        editing={editing}
        initialDirection={newDirection}
        categories={visibleCategories}
        categoriesLoading={categoriesLoading}
        error={error}
        onOpenChange={(open) => {
          if (!saving) setDialogOpen(open);
        }}
        onSave={handleSave}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !saving) setDeleteTarget(null);
        }}
        title={t("cashflow.deleteEntry", { defaultValue: "Delete entry" })}
        description={t("cashflow.deleteEntryHint", {
          defaultValue:
            "Delete this income or expense entry? It will no longer be included in your reports.",
        })}
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("actions.delete")}
        confirmPending={saving}
        onConfirm={() => void handleDelete()}
      />
    </CashflowWorkspace>
  );
}
