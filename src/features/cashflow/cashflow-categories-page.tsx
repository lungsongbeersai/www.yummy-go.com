"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Pencil, Plus, RefreshCw, Shapes } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import {
  SettingsDialogBody,
  SettingsDialogContent,
  SettingsDialogFooter,
  SettingsDialogForm,
  SettingsDialogHeader,
} from "@/features/settings/shared/settings-shell";
import { canManageCashflow } from "@/lib/permissions";
import type {
  CashflowCategory,
  CashflowCategoryDirection,
  SaveCashflowCategoryInput,
} from "@/services/cashflow";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCashflowStore } from "@/stores/cashflow-store";
import { createSessionGuard } from "@/stores/session-store-registry";
import { useToastStore } from "@/stores/toast-store";
import {
  CashflowAccessDenied,
  CashflowSelectField,
  CashflowWorkspace,
} from "./cashflow-workspace";

export interface CashflowBranchControls {
  branchUuid: string;
  branchLabel: string;
  branchOptions: Array<{ value: string; label: string }>;
  canSelectBranch: boolean;
  branchLoading: boolean;
  branchError: string | null;
  onBranchChange: (value: string) => void;
}

export function CashflowCategoriesPage() {
  const user = useAuthStore((state) => state.user);
  if (!canManageCashflow(user?.status)) return <CashflowAccessDenied />;
  return (
    <CashflowCategoriesBranchPage
      key={`${authStoreUuid(user)}:${user?.branch_uuid}:${user?.status}`}
    />
  );
}

function CashflowCategoriesBranchPage() {
  const scope = useReportBranchSelection();
  const [selection, setSelection] = useState(scope.defaultBranchUuid);
  const branchUuid = scope.normalizeBranchFilters({
    branchUuid: selection,
  }).branchUuid;
  return (
    <CategoryList
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

function CategoryList({
  branchUuid,
  branchLabel,
  branchOptions,
  branchLoading,
  branchError,
  canSelectBranch,
  onBranchChange,
}: CashflowBranchControls) {
  const { t } = useTranslation();
  const categories = useCashflowStore((state) => state.categories);
  const categoriesBranchUuid = useCashflowStore(
    (state) => state.categoriesBranchUuid
  );
  const loading = useCashflowStore((state) => state.categoriesLoading);
  const saving = useCashflowStore((state) => state.saving);
  const error = useCashflowStore((state) => state.error);
  const load = useCashflowStore((state) => state.loadCategories);
  const save = useCashflowStore((state) => state.saveCategory);
  const archive = useCashflowStore((state) => state.removeCategory);
  const showToast = useToastStore((state) => state.show);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("all");
  const [status, setStatus] = useState("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CashflowCategory | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CashflowCategory | null>(
    null
  );
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (branchUuid)
      void load({ branch_uuid_fk: branchUuid, include_inactive: true }).catch(
        () => undefined
      );
  }, [branchUuid, load]);

  const rows = useMemo(
    () =>
      categoriesBranchUuid === branchUuid
        ? categories.filter(
            (row) =>
              row.name
                .toLocaleLowerCase()
                .includes(search.trim().toLocaleLowerCase()) &&
              (direction === "all" ||
                row.direction === direction ||
                row.direction === "both") &&
              (status === "all" || row.is_active === (status === "active"))
          )
        : [],
    [categories, categoriesBranchUuid, branchUuid, search, direction, status]
  );
  const directionLabel = (value: CashflowCategoryDirection) =>
    t(`cashflow.directions.${value}`, {
      defaultValue:
        value === "both"
          ? "Income and expense"
          : value === "income"
          ? "Income"
          : "Expense",
    });

  async function handleSave(input: SaveCashflowCategoryInput) {
    const isSession = createSessionGuard();
    try {
      await save(input);
      if (!mounted.current || !isSession()) return false;
      showToast({
        title: t("cashflow.categorySaved", { defaultValue: "Category saved" }),
        tone: "success",
      });
      setDialogOpen(false);
      await load({ branch_uuid_fk: branchUuid, include_inactive: true }).catch(
        () => undefined
      );
      return true;
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
      return false;
    }
  }

  async function handleArchive() {
    if (!archiveTarget || saving) return;
    const isSession = createSessionGuard();
    try {
      await archive(archiveTarget.category_uuid, branchUuid);
      if (!mounted.current || !isSession()) return;
      setArchiveTarget(null);
      showToast({
        title: t("cashflow.categoryArchived", {
          defaultValue: "Category deactivated",
        }),
        tone: "success",
      });
      await load({ branch_uuid_fk: branchUuid, include_inactive: true }).catch(
        () => undefined
      );
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

  const actions = (row: CashflowCategory) => (
    <div className="flex shrink-0 gap-1">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="min-h-11 min-w-11"
        disabled={saving}
        aria-label={`${t("actions.edit")} ${row.name}`}
        onClick={() => {
          setEditing(row);
          setDialogOpen(true);
        }}
      >
        <Pencil aria-hidden />
      </Button>
      {row.is_active ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="min-h-11 min-w-11 text-destructive"
          disabled={saving}
          aria-label={`${t("cashflow.archiveCategory", {
            defaultValue: "Deactivate category",
          })} ${row.name}`}
          onClick={() => setArchiveTarget(row)}
        >
          <Archive aria-hidden />
        </Button>
      ) : null}
    </div>
  );

  return (
    <CashflowWorkspace
      active="categories"
      title={t("cashflow.categoriesTitle", {
        defaultValue: "Income and expense categories",
      })}
      description={t("cashflow.categoriesHint", {
        defaultValue:
          "Create categories for income, expenses, or both. Each branch keeps its own categories.",
      })}
      branchLabel={branchLabel}
      actions={
        <Button
          className="min-h-11"
          disabled={!branchUuid || saving || loading}
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus aria-hidden />
          {t("cashflow.addCategory", { defaultValue: "Add category" })}
        </Button>
      }
    >
      {branchError || error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{branchError || error}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void load({
                  branch_uuid_fk: branchUuid,
                  include_inactive: true,
                }).catch(() => undefined)
              }
              disabled={loading || !branchUuid}
            >
              <RefreshCw aria-hidden />
              {t("actions.tryAgain")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      <section className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <CashflowSelectField
          id="cashflow-category-branch"
          label={t("nav.branch")}
          value={branchUuid}
          options={branchOptions}
          disabled={!canSelectBranch || branchLoading || saving}
          onValueChange={onBranchChange}
        />
        <Field className="gap-2">
          <FieldLabel htmlFor="cashflow-category-search">
            {t("cashflow.searchCategories", {
              defaultValue: "Search categories",
            })}
          </FieldLabel>
          <Input
            id="cashflow-category-search"
            className="min-h-11"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("cashflow.categoryName", {
              defaultValue: "Category name",
            })}
          />
        </Field>
        <CashflowSelectField
          id="cashflow-category-direction"
          label={t("cashflow.directionLabel", { defaultValue: "Type" })}
          value={direction}
          onValueChange={setDirection}
          options={[
            { value: "all", label: t("common.all") },
            { value: "income", label: directionLabel("income") },
            { value: "expense", label: directionLabel("expense") },
            { value: "both", label: directionLabel("both") },
          ]}
        />
        <CashflowSelectField
          id="cashflow-category-status"
          label={t("common.status")}
          value={status}
          onValueChange={setStatus}
          options={[
            { value: "active", label: t("common.active") },
            { value: "inactive", label: t("common.inactive") },
            { value: "all", label: t("common.all") },
          ]}
        />
      </section>
      {loading || categoriesBranchUuid !== branchUuid ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : rows.length ? (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <Shapes className="size-4 text-primary" aria-hidden />
            <h2 className="font-bold">
              {t("cashflow.categoriesTitle", { defaultValue: "Categories" })}
            </h2>
            <Badge variant="secondary">{rows.length}</Badge>
          </div>
          <div className="divide-y divide-border md:hidden">
            {rows.map((row) => (
              <article
                key={row.category_uuid}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="flex min-w-0 flex-col gap-2">
                  <h3 className="break-words font-bold">{row.name}</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {directionLabel(row.direction)}
                    </Badge>
                    <Badge variant={row.is_active ? "secondary" : "outline"}>
                      {t(row.is_active ? "common.active" : "common.inactive")}
                    </Badge>
                  </div>
                </div>
                {actions(row)}
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("cashflow.categoryName", {
                      defaultValue: "Category name",
                    })}
                  </TableHead>
                  <TableHead>
                    {t("cashflow.directionLabel", { defaultValue: "Type" })}
                  </TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.category_uuid}>
                    <TableCell className="font-semibold">{row.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {directionLabel(row.direction)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.is_active ? "secondary" : "outline"}>
                        {t(row.is_active ? "common.active" : "common.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">{actions(row)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : (
        <EmptyState
          title={t("cashflow.noCategories", {
            defaultValue: "No categories found",
          })}
          description={t("cashflow.noCategoriesHint", {
            defaultValue:
              "Add a category or adjust the filters to get started.",
          })}
        />
      )}
      <CashflowCategoryDialog
        key={`${editing?.category_uuid ?? "new"}:${dialogOpen}`}
        branchUuid={branchUuid}
        branchLabel={branchLabel}
        editing={editing}
        open={dialogOpen}
        saving={saving}
        error={error}
        onOpenChange={(open) => {
          if (!saving) setDialogOpen(open);
        }}
        onSave={handleSave}
      />
      <ConfirmDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open && !saving) setArchiveTarget(null);
        }}
        title={t("cashflow.archiveCategory", {
          defaultValue: "Deactivate category",
        })}
        description={t("cashflow.archiveCategoryHint", {
          defaultValue:
            "Deactivate this category? Existing records remain available in your reports.",
        })}
        cancelLabel={t("actions.cancel")}
        confirmLabel={t("cashflow.archive", { defaultValue: "Deactivate" })}
        confirmPending={saving}
        onConfirm={() => void handleArchive()}
      />
    </CashflowWorkspace>
  );
}

function CashflowCategoryDialog({
  branchUuid,
  branchLabel,
  editing,
  open,
  saving,
  error,
  onOpenChange,
  onSave,
}: {
  branchUuid: string;
  branchLabel: string;
  editing: CashflowCategory | null;
  open: boolean;
  saving: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: SaveCashflowCategoryInput) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(editing?.name ?? "");
  const [direction, setDirection] = useState<CashflowCategoryDirection>(
    editing?.direction ?? "both"
  );
  const [active, setActive] = useState(editing?.is_active ?? true);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SettingsDialogContent className="sm:max-w-xl" showCloseButton={!saving}>
        <SettingsDialogForm
          onSubmit={(event) => {
            event.preventDefault();
            if (!saving && name.trim())
              void onSave({
                branch_uuid_fk: branchUuid,
                category_uuid: editing?.category_uuid,
                name: name.trim(),
                direction,
                is_active: active,
              });
          }}
        >
          <SettingsDialogHeader>
            <DialogTitle>
              {t(editing ? "cashflow.editCategory" : "cashflow.addCategory", {
                defaultValue: editing ? "Edit category" : "Add category",
              })}
            </DialogTitle>
            <DialogDescription>{branchLabel}</DialogDescription>
          </SettingsDialogHeader>
          <SettingsDialogBody className="flex flex-col gap-5">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <Field className="gap-2">
              <FieldLabel htmlFor="cashflow-category-name">
                {t("cashflow.categoryName", { defaultValue: "Category name" })}
              </FieldLabel>
              <Input
                id="cashflow-category-name"
                className="min-h-11"
                maxLength={120}
                required
                autoFocus
                disabled={saving}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <CashflowSelectField
              id="cashflow-category-form-direction"
              label={t("cashflow.categorySupports", {
                defaultValue: "Use this category for",
              })}
              description={t("cashflow.categorySupportsHint", {
                defaultValue:
                  "A shared category can be used for both income and expense entries.",
              })}
              value={direction}
              disabled={saving}
              onValueChange={(value) =>
                setDirection(value as CashflowCategoryDirection)
              }
              options={[
                {
                  value: "both",
                  label: t("cashflow.directions.both", {
                    defaultValue: "Income and expense",
                  }),
                },
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
            <Field orientation="horizontal" className="min-h-11">
              <div className="flex-1">
                <FieldLabel
                  htmlFor="cashflow-category-active"
                  className="min-h-11 items-center"
                >
                  {t("common.active")}
                </FieldLabel>
                <FieldDescription className="text-sm">
                  {t("cashflow.activeCategoryHint", {
                    defaultValue:
                      "Only active categories can be selected for new entries.",
                  })}
                </FieldDescription>
              </div>
              <Switch
                id="cashflow-category-active"
                checked={active}
                disabled={saving}
                onCheckedChange={setActive}
              />
            </Field>
          </SettingsDialogBody>
          <SettingsDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              {t("actions.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={saving || !name.trim() || !branchUuid}
            >
              {saving ? <Spinner aria-hidden /> : null}
              {t("actions.save")}
            </Button>
          </SettingsDialogFooter>
        </SettingsDialogForm>
      </SettingsDialogContent>
    </Dialog>
  );
}
