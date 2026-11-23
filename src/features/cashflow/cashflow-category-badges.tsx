"use client";

import { useEffect, useRef, useState } from "react";
import { Check, List, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { SettingsDialogBody, SettingsDialogContent, SettingsDialogFooter, SettingsDialogHeader } from "@/features/settings/shared/settings-shell";
import type { CashflowCategory, CashflowCategoryDirection, CashflowDirection } from "@/services/cashflow";
import { createSessionGuard } from "@/stores/session-store-registry";
import { useCashflowStore } from "@/stores/cashflow-store";

interface CashflowCategoryBadgesProps {
  branchUuid: string;
  categories: CashflowCategory[];
  direction: CashflowDirection | "all";
  selectedUuid: string;
  onSelect: (uuid: string) => void;
  disabled?: boolean;
  loading?: boolean;
  allowAll?: boolean;
  retainedCategoryUuid?: string;
  onCategoriesChanged?: () => Promise<void>;
}

export function CashflowCategoryBadges({ branchUuid, categories, direction, selectedUuid, onSelect, disabled = false, loading = false, allowAll = false, retainedCategoryUuid, onCategoriesChanged }: CashflowCategoryBadgesProps) {
  const { t } = useTranslation();
  const saveCategory = useCashflowStore((state) => state.saveCategory);
  const removeCategory = useCashflowStore((state) => state.removeCategory);
  const loadCategories = useCashflowStore((state) => state.loadCategories);
  const [managerOpen, setManagerOpen] = useState(false);
  const [name, setName] = useState("");
  const [categoryDirection, setCategoryDirection] = useState<CashflowCategoryDirection>("both");
  const [archiveTarget, setArchiveTarget] = useState<CashflowCategory | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const compatible = (category: CashflowCategory) => direction === "all" || category.direction === "both" || category.direction === direction;
  const visible = categories.filter((category) => compatible(category) && (category.is_active || category.category_uuid === selectedUuid || category.category_uuid === retainedCategoryUuid));
  const locked = disabled || busy || !branchUuid;

  function openManager() {
    setError(null);
    setManagerOpen(true);
  }

  async function refresh() {
    await loadCategories({ branch_uuid_fk: branchUuid, include_inactive: true });
    await onCategoriesChanged?.();
  }

  async function addCategory() {
    if (!name.trim() || busy || !branchUuid) return;
    const isSession = createSessionGuard();
    const isCurrent = () => mounted.current && isSession() && useCashflowStore.getState().branchUuid === branchUuid;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveCategory({ branch_uuid_fk: branchUuid, name: name.trim(), direction: categoryDirection, is_active: true });
      if (!isCurrent()) return;
      await refresh();
      if (!isCurrent()) return;
      setName("");
      if (compatible(saved)) onSelect(saved.category_uuid);
    } catch (failure: unknown) {
      if (isCurrent()) setError(failure instanceof Error ? failure.message : t("toasts.pleaseTryAgain"));
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }

  async function archiveCategory() {
    if (!archiveTarget || busy) return;
    const target = archiveTarget;
    const isSession = createSessionGuard();
    const isCurrent = () => mounted.current && isSession() && useCashflowStore.getState().branchUuid === branchUuid;
    setBusy(true);
    setError(null);
    try {
      await removeCategory(target.category_uuid, branchUuid);
      if (!isCurrent()) return;
      if (selectedUuid === target.category_uuid && retainedCategoryUuid !== target.category_uuid) onSelect(allowAll ? "all" : "");
      setArchiveTarget(null);
      await refresh();
    } catch (failure: unknown) {
      if (isCurrent()) setError(failure instanceof Error ? failure.message : t("toasts.pleaseTryAgain"));
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }

  return <>
    <div data-testid="cashflow-category-badges" className="flex items-start gap-2" role="group" aria-label={t("cashflow.fields.category")}>
      <div className="flex max-h-28 min-w-0 flex-1 flex-wrap items-center gap-2 overflow-y-auto">
      {allowAll ? <Badge asChild variant={selectedUuid === "all" ? "default" : "outline"} className="h-9 text-sm"><button type="button" disabled={locked} aria-pressed={selectedUuid === "all"} onClick={() => onSelect("all")}>{t("common.all")}</button></Badge> : null}
      {loading ? <Skeleton className="h-9 w-28 rounded-full" /> : visible.map((category) => <Badge key={category.category_uuid} asChild variant={selectedUuid === category.category_uuid ? "default" : "outline"} className="h-9 max-w-full text-sm"><button type="button" data-category-uuid={category.category_uuid} disabled={locked} aria-pressed={selectedUuid === category.category_uuid} onClick={() => onSelect(category.category_uuid)}>{selectedUuid === category.category_uuid ? <Check aria-hidden /> : null}<span className="truncate">{category.name}</span>{!category.is_active ? <span className="sr-only">{t("common.inactive")}</span> : null}</button></Badge>)}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button type="button" variant="outline" size="icon" className="size-9 rounded-full" data-testid="cashflow-category-add" aria-label={t("cashflow.addCategory")} disabled={locked} onClick={openManager}><Plus aria-hidden /></Button>
        <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full" data-testid="cashflow-category-list" aria-label={t("cashflow.compact.listCategories", { defaultValue: "Category list" })} disabled={locked} onClick={openManager}><List aria-hidden /></Button>
      </div>
    </div>

    <Dialog open={managerOpen} onOpenChange={(open) => { if (!busy) setManagerOpen(open); }}>
      <SettingsDialogContent className="sm:max-w-md" showCloseButton={!busy}>
        <SettingsDialogHeader className="px-4 py-3"><DialogTitle>{t("cashflow.compact.listCategories", { defaultValue: "Category list" })}</DialogTitle><DialogDescription className="sr-only">{t("cashflow.categorySupportsHint")}</DialogDescription></SettingsDialogHeader>
        <SettingsDialogBody className="flex flex-col gap-3 p-4">
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
          <div className="flex gap-2"><Input id="cashflow-category-badge-name" value={name} maxLength={120} placeholder={t("cashflow.categoryName")} aria-label={t("cashflow.categoryName")} disabled={busy} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addCategory(); } }} /><Button type="button" data-testid="cashflow-category-create" disabled={busy || !name.trim()} onClick={() => void addCategory()}>{busy ? <Spinner aria-hidden /> : <Plus aria-hidden />}{t("cashflow.addCategory")}</Button></div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("cashflow.categorySupports")}>{(["income", "expense", "both"] as const).map((value) => <Badge key={value} asChild variant={categoryDirection === value ? "default" : "outline"} className="h-8 text-sm"><button type="button" disabled={busy} aria-pressed={categoryDirection === value} onClick={() => setCategoryDirection(value)}>{t(`cashflow.directions.${value}`)}</button></Badge>)}</div>
          <div className="flex max-h-64 flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {categories.filter((category) => category.is_active).map((category) => <div key={category.category_uuid} className="flex min-h-11 items-center gap-2 px-3 py-1"><button type="button" className="min-h-9 min-w-0 flex-1 truncate text-left text-sm focus-visible:outline-ring disabled:opacity-50" disabled={busy || !compatible(category)} onClick={() => { onSelect(category.category_uuid); setManagerOpen(false); }}>{category.name}</button><Badge variant="outline">{t(`cashflow.directions.${category.direction}`)}</Badge><Button type="button" size="icon" variant="ghost" className="size-9 text-destructive" aria-label={`${t("actions.delete")} ${category.name}`} disabled={busy} onClick={() => setArchiveTarget(category)}><Trash2 aria-hidden /></Button></div>)}
            {!categories.some((category) => category.is_active) ? <p className="p-3 text-sm text-muted-foreground">{t("cashflow.noCategories")}</p> : null}
          </div>
        </SettingsDialogBody>
        <SettingsDialogFooter className="px-4 py-3"><Button type="button" variant="outline" disabled={busy} onClick={() => setManagerOpen(false)}>{t("actions.close")}</Button></SettingsDialogFooter>
      </SettingsDialogContent>
    </Dialog>
    <ConfirmDialog open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open && !busy) setArchiveTarget(null); }} title={t("actions.delete")} description={t("cashflow.archiveCategoryHint")} cancelLabel={t("actions.cancel")} confirmLabel={t("actions.delete")} confirmPending={busy} onConfirm={() => void archiveCategory()} />
  </>;
}
