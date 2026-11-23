"use client";

import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { CashflowCategory, CashflowDirection } from "@/services/cashflow";

interface CashflowCategoryBadgesProps {
  categories: CashflowCategory[];
  direction: CashflowDirection | "all";
  selectedUuid: string;
  onSelect: (uuid: string) => void;
  disabled?: boolean;
  loading?: boolean;
  allowAll?: boolean;
  retainedCategoryUuid?: string;
}

export function CashflowCategoryBadges({ categories, direction, selectedUuid, onSelect, disabled = false, loading = false, allowAll = false, retainedCategoryUuid }: CashflowCategoryBadgesProps) {
  const { t } = useTranslation();
  const visible = categories.filter((category) =>
    (direction === "all" || category.direction === "both" || category.direction === direction) &&
    (category.is_active || category.category_uuid === selectedUuid || category.category_uuid === retainedCategoryUuid));

  return <div data-testid="cashflow-category-badges" className="flex max-h-36 min-w-0 flex-wrap items-center gap-2 overflow-y-auto" role="group" aria-label={t("cashflow.fields.category")}>
    {allowAll ? <Badge asChild variant={selectedUuid === "all" ? "default" : "outline"} className="min-h-11 px-3 text-sm">
      <button type="button" disabled={disabled} aria-pressed={selectedUuid === "all"} onClick={() => onSelect("all")}>{t("common.all")}</button>
    </Badge> : null}
    {loading ? <Skeleton className="h-11 w-28 rounded-full" /> : visible.map((category) => <Badge key={category.category_uuid} asChild
      variant={selectedUuid === category.category_uuid ? "default" : "outline"} className="min-h-11 max-w-full px-3 text-sm">
      <button type="button" data-category-uuid={category.category_uuid} disabled={disabled} aria-pressed={selectedUuid === category.category_uuid} onClick={() => onSelect(category.category_uuid)}>
        {selectedUuid === category.category_uuid ? <Check aria-hidden /> : null}<span className="truncate">{category.name}</span>
        {!category.is_active ? <span className="sr-only">{t("common.inactive")}</span> : null}
      </button>
    </Badge>)}
    {!loading && !visible.length && !allowAll ? <p className="text-sm text-muted-foreground">{t("cashflow.categoryRequiredHint")}</p> : null}
  </div>;
}
