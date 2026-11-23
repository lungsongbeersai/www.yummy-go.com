"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Pencil, Plus, RefreshCw, Search, Shapes } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useReportBranchSelection } from "@/features/report/shared/use-report-branch-selection";
import { SettingsDialogBody, SettingsDialogContent, SettingsDialogFooter, SettingsDialogForm, SettingsDialogHeader } from "@/features/settings/shared/settings-shell";
import { canManageCashflow } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { CashflowCategory, CashflowCategoryDirection, SaveCashflowCategoryInput } from "@/services/cashflow";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCashflowStore } from "@/stores/cashflow-store";
import { createSessionGuard } from "@/stores/session-store-registry";
import { useToastStore } from "@/stores/toast-store";
import { CashflowAccessDenied, CashflowSelectField, CashflowWorkspace } from "./cashflow-workspace";

export interface CashflowBranchControls {
  branchUuid: string;
  branchLabel: string;
  branchOptions: Array<{ value: string; label: string }>;
  canSelectBranch: boolean;
  branchLoading: boolean;
  branchError: string | null;
  onBranchChange: (value: string) => void;
}

const categoryTypes = [
  { value: "income", icon: ArrowDownLeft, tone: "border-success/25 bg-success/10 text-success" },
  { value: "expense", icon: ArrowUpRight, tone: "border-destructive/25 bg-destructive/10 text-destructive" },
  { value: "both", icon: ArrowLeftRight, tone: "border-info/25 bg-info/10 text-info" },
] as const;

function CategoryDirectionBadge({ direction }: { direction: CashflowCategoryDirection }) {
  const { t } = useTranslation();
  const type = categoryTypes.find((item) => item.value === direction) ?? categoryTypes[2];
  const Icon = type.icon;
  return <Badge variant="outline" className={cn("h-auto max-w-full gap-1.5 whitespace-normal px-2.5 py-1 text-sm", type.tone)}>
    <Icon aria-hidden />{t(`cashflow.directions.${direction}`)}
  </Badge>;
}

export function CashflowCategoriesPage() {
  const user = useAuthStore((state) => state.user);
  if (!canManageCashflow(user?.status)) return <CashflowAccessDenied />;
  return <CashflowCategoriesBranchPage key={`${authStoreUuid(user)}:${user?.branch_uuid}:${user?.status}`} />;
}

function CashflowCategoriesBranchPage() {
  const scope = useReportBranchSelection();
  const [selection, setSelection] = useState(scope.defaultBranchUuid);
  const branchUuid = scope.normalizeBranchFilters({ branchUuid: selection }).branchUuid;
  return <CategoryList key={branchUuid} branchUuid={branchUuid} branchLabel={scope.branchLabelFor(branchUuid)}
    branchOptions={scope.branchOptions} branchLoading={scope.branchLoading} branchError={scope.branchError}
    canSelectBranch={scope.canSelectBranch} onBranchChange={setSelection} />;
}

function CategoryList({ branchUuid, branchLabel, branchOptions, branchLoading, branchError, canSelectBranch, onBranchChange }: CashflowBranchControls) {
  const { t } = useTranslation();
  const categories = useCashflowStore((state) => state.categories);
  const categoriesBranchUuid = useCashflowStore((state) => state.categoriesBranchUuid);
  const loading = useCashflowStore((state) => state.categoriesLoading);
  const saving = useCashflowStore((state) => state.saving);
  const error = useCashflowStore((state) => state.error);
  const load = useCashflowStore((state) => state.loadCategories);
  const save = useCashflowStore((state) => state.saveCategory);
  const archive = useCashflowStore((state) => state.removeCategory);
  const showToast = useToastStore((state) => state.show);
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState<CashflowCategoryDirection | "all">("all");
  const [status, setStatus] = useState("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CashflowCategory | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CashflowCategory | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (branchUuid) void load({ branch_uuid_fk: branchUuid, include_inactive: true }).catch(() => undefined);
  }, [branchUuid, load]);

  const scopedCategories = useMemo(() => categoriesBranchUuid === branchUuid
    ? categories.filter((row) => status === "all" || row.is_active === (status === "active")) : [],
  [categories, categoriesBranchUuid, branchUuid, status]);
  const rows = useMemo(() => scopedCategories.filter((row) =>
    row.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) &&
    (direction === "all" || row.direction === direction)), [scopedCategories, search, direction]);
  const pending = loading || categoriesBranchUuid !== branchUuid;

  async function handleSave(input: SaveCashflowCategoryInput) {
    const isSession = createSessionGuard();
    try {
      const saved = await save(input);
      if (!mounted.current || !isSession()) return false;
      showToast({ title: t("cashflow.categorySaved"), tone: "success" });
      setDialogOpen(false);
      setDirection("all");
      setSearch("");
      setStatus(saved.is_active ? "active" : "inactive");
      await load({ branch_uuid_fk: branchUuid, include_inactive: true }).catch(() => undefined);
      return true;
    } catch (failure: unknown) {
      if (mounted.current && isSession()) showToast({ title: t("settings.saveFailed"),
        description: failure instanceof Error ? failure.message : t("toasts.pleaseTryAgain"), tone: "error" });
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
      showToast({ title: t("cashflow.categoryArchived"), tone: "success" });
      await load({ branch_uuid_fk: branchUuid, include_inactive: true }).catch(() => undefined);
    } catch (failure: unknown) {
      if (mounted.current && isSession()) showToast({ title: t("settings.saveFailed"),
        description: failure instanceof Error ? failure.message : t("toasts.pleaseTryAgain"), tone: "error" });
    }
  }

  const rowActions = (row: CashflowCategory) => <div className="flex shrink-0 gap-1">
    <Button type="button" size="icon" variant="ghost" className="min-h-11 min-w-11" disabled={saving}
      aria-label={`${t("actions.edit")} ${row.name}`} onClick={() => { setEditing(row); setDialogOpen(true); }}><Pencil aria-hidden /></Button>
    {row.is_active ? <Button type="button" size="icon" variant="ghost" className="min-h-11 min-w-11 text-destructive" disabled={saving}
      aria-label={`${t("cashflow.archiveCategory")} ${row.name}`} onClick={() => setArchiveTarget(row)}><Archive aria-hidden /></Button> : null}
  </div>;

  return <CashflowWorkspace compact active="categories" title={t("cashflow.categoriesTitle")}
    description={t("cashflow.categoriesHint")} branchLabel={branchLabel} branchUuid={branchUuid}
    actions={<Button className="min-h-11" disabled={!branchUuid || saving || pending} onClick={() => { setEditing(null); setDialogOpen(true); }}>
      <Plus aria-hidden />{t("cashflow.addCategory")}</Button>}>
    {branchError || error ? <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-2">
      <span>{branchError || error}</span><Button variant="outline" size="sm" disabled={loading || !branchUuid}
        onClick={() => void load({ branch_uuid_fk: branchUuid, include_inactive: true }).catch(() => undefined)}><RefreshCw aria-hidden />{t("actions.tryAgain")}</Button>
    </AlertDescription></Alert> : null}

    <div className="grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-label={t("cashflow.directionLabel")}>
      {categoryTypes.map(({ value, icon: Icon, tone }) => <Button key={value} type="button" variant="outline"
        className={cn("h-auto min-h-24 min-w-0 flex-col items-start justify-between gap-2 whitespace-normal rounded-xl p-3 text-left sm:p-4", direction === value && "border-primary ring-1 ring-primary")}
        aria-pressed={direction === value} onClick={() => setDirection((current) => current === value ? "all" : value)} disabled={pending}
        data-category-direction={value}>
        <span className="flex w-full flex-wrap items-center gap-2"><span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", tone)}><Icon className="size-4" aria-hidden /></span>
          <span className="min-w-0 break-words text-sm font-medium">{t(`cashflow.directions.${value}`)}</span></span>
        <span className="text-2xl font-bold tabular-nums">{pending ? "—" : scopedCategories.filter((row) => row.direction === value).length}</span>
      </Button>)}
    </div>

    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Shapes className="size-4 text-primary" aria-hidden /><h2 className="font-semibold">{t("cashflow.compact.listCategories")}</h2>
            <Badge variant="secondary" className="h-auto px-2 py-0.5 text-sm tabular-nums">{pending ? "—" : rows.length}</Badge></div>
          <Button variant={direction === "all" ? "secondary" : "ghost"} type="button" className="min-h-11" aria-pressed={direction === "all"} onClick={() => setDirection("all")}>{t("common.all")}</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:items-end">
          <Field className="min-w-0 gap-2 lg:flex-1"><FieldLabel className="sr-only" htmlFor="cashflow-category-search">{t("cashflow.searchCategories")}</FieldLabel>
            <div className="relative"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id="cashflow-category-search" type="search" className="min-h-11 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("cashflow.searchCategories")} /></div>
          </Field>
          <div className="min-w-0 lg:w-44"><CashflowSelectField id="cashflow-category-status" label={t("common.status")} value={status} onValueChange={setStatus}
            options={[{ value: "active", label: t("common.active") }, { value: "inactive", label: t("common.inactive") }, { value: "all", label: t("common.all") }]} /></div>
          {canSelectBranch && branchOptions.length > 1 ? <div className="min-w-0 sm:col-span-2 lg:w-64"><CashflowSelectField id="cashflow-category-branch" label={t("nav.branch")} value={branchUuid}
            options={branchOptions} disabled={branchLoading || saving} onValueChange={onBranchChange} /></div> : null}
        </div>
      </div>
      {pending ? <div className="flex flex-col gap-3 p-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-14 rounded-lg" />)}</div>
        : rows.length ? <>
          <div className="divide-y divide-border md:hidden">{rows.map((row) => <article key={row.category_uuid} data-category-uuid={row.category_uuid} className="flex items-start justify-between gap-2 p-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2"><h3 className="break-words font-semibold">{row.name}</h3><CategoryDirectionBadge direction={row.direction} />
              <span className="text-sm text-muted-foreground">{t(row.is_active ? "common.active" : "common.inactive")}</span></div>{rowActions(row)}</article>)}</div>
          <div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow>
            <TableHead>{t("cashflow.categoryName")}</TableHead><TableHead>{t("cashflow.categorySupports")}</TableHead><TableHead>{t("common.status")}</TableHead><TableHead className="text-right">{t("common.actions")}</TableHead>
          </TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.category_uuid} data-category-uuid={row.category_uuid}>
            <TableCell className="max-w-sm whitespace-normal break-words font-semibold">{row.name}</TableCell><TableCell><CategoryDirectionBadge direction={row.direction} /></TableCell>
            <TableCell><Badge variant="outline" className={cn("h-auto px-2 py-1 text-sm", row.is_active ? "border-success/20 bg-success/10 text-success" : "text-muted-foreground")}>{t(row.is_active ? "common.active" : "common.inactive")}</Badge></TableCell>
            <TableCell><div className="flex justify-end">{rowActions(row)}</div></TableCell></TableRow>)}</TableBody></Table></div>
        </> : <EmptyState title={t("cashflow.noCategories")} description={t("cashflow.noCategoriesHint")} />}
    </section>
    <CashflowCategoryDialog key={`${editing?.category_uuid ?? "new"}:${dialogOpen}`} branchUuid={branchUuid} branchLabel={branchLabel} editing={editing}
      open={dialogOpen} saving={saving} error={error} onOpenChange={(open) => { if (!saving) setDialogOpen(open); }} onSave={handleSave} />
    <ConfirmDialog open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open && !saving) setArchiveTarget(null); }}
      title={t("cashflow.archiveCategory")} description={t("cashflow.archiveCategoryHint")} cancelLabel={t("actions.cancel")}
      confirmLabel={t("cashflow.archive")} confirmPending={saving} onConfirm={() => void handleArchive()} />
  </CashflowWorkspace>;
}

interface CashflowCategoryDialogProps {
  branchUuid: string;
  branchLabel: string;
  editing: CashflowCategory | null;
  open: boolean;
  saving: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSave: (input: SaveCashflowCategoryInput) => Promise<boolean>;
}

function CashflowCategoryDialog({ branchUuid, branchLabel, editing, open, saving, error, onOpenChange, onSave }: CashflowCategoryDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(editing?.name ?? "");
  const [direction, setDirection] = useState<CashflowCategoryDirection>(editing?.direction ?? "both");
  const [active, setActive] = useState(editing?.is_active ?? true);
  return <Dialog open={open} onOpenChange={onOpenChange}><SettingsDialogContent className="sm:max-w-lg" showCloseButton={!saving}>
    <SettingsDialogForm onSubmit={(event) => {
      event.preventDefault();
      if (!saving && name.trim() && branchUuid) void onSave({ branch_uuid_fk: branchUuid, category_uuid: editing?.category_uuid, name: name.trim(), direction, is_active: active });
    }}>
      <SettingsDialogHeader className="px-4 py-4 sm:px-5"><DialogTitle>{t(editing ? "cashflow.editCategory" : "cashflow.addCategory")}</DialogTitle><DialogDescription>{branchLabel}</DialogDescription></SettingsDialogHeader>
      <SettingsDialogBody className="flex flex-col gap-5 p-4 sm:p-5">
        {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
        <Field className="gap-2"><FieldLabel htmlFor="cashflow-category-name">{t("cashflow.categoryName")}</FieldLabel>
          <Input id="cashflow-category-name" className="min-h-11" maxLength={120} required autoFocus disabled={saving} value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field className="gap-2"><FieldLabel id="cashflow-category-supports">{t("cashflow.categorySupports")}</FieldLabel>
          <RadioGroup aria-labelledby="cashflow-category-supports" value={direction} disabled={saving} className="gap-2" onValueChange={(value) => {
            if (value === "income" || value === "expense" || value === "both") setDirection(value);
          }}>
            {categoryTypes.map(({ value, icon: Icon, tone }) => <label key={value} htmlFor={`cashflow-category-support-${value}`}
              className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border p-3", direction === value && "border-primary bg-primary/5", saving && "cursor-not-allowed opacity-50")}>
              <span className={cn("flex size-8 items-center justify-center rounded-md", tone)}><Icon className="size-4" aria-hidden /></span>
              <span className="min-w-0 flex-1 text-sm font-medium">{t(`cashflow.directions.${value}`)}</span><RadioGroupItem id={`cashflow-category-support-${value}`} value={value} />
            </label>)}
          </RadioGroup>
        </Field>
        {editing ? <Field orientation="horizontal" className="min-h-11"><div className="flex-1"><FieldLabel htmlFor="cashflow-category-active" className="min-h-11 items-center">{t("common.active")}</FieldLabel>
          <FieldDescription className="text-sm">{t("cashflow.activeCategoryHint")}</FieldDescription></div>
          <Switch id="cashflow-category-active" checked={active} disabled={saving} onCheckedChange={setActive} /></Field> : null}
      </SettingsDialogBody>
      <SettingsDialogFooter className="grid grid-cols-2 gap-2 px-4 py-3 sm:flex sm:px-5"><Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>{t("actions.cancel")}</Button>
        <Button type="submit" disabled={saving || !name.trim() || !branchUuid}>{saving ? <Spinner aria-hidden /> : null}{t("actions.save")}</Button></SettingsDialogFooter>
    </SettingsDialogForm>
  </SettingsDialogContent></Dialog>;
}
