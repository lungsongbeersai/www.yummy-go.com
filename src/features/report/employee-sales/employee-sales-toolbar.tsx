"use client";

import { ArrowDownIcon, ArrowUpIcon, RefreshCwIcon, SlidersHorizontalIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function EmployeeSalesToolbar({
  filterCount,
  onOpenFilters,
  onRefresh,
  onToggleOrderBy,
  orderBy,
  refreshDisabled,
}: {
  filterCount: number;
  onOpenFilters: () => void;
  onRefresh: () => void;
  onToggleOrderBy: () => void;
  orderBy: "asc" | "desc";
  refreshDisabled: boolean;
}) {
  const { t } = useTranslation();
  const OrderByIcon = orderBy === "asc" ? ArrowUpIcon : ArrowDownIcon;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" className="min-h-10 gap-2" onClick={onOpenFilters}>
        <SlidersHorizontalIcon className="size-4" />
        {t("report.filters.openFilters")}
        {filterCount > 0 && <Badge variant="secondary">{filterCount}</Badge>}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="min-h-10 gap-2"
        aria-label={t("report.filters.orderBy")}
        onClick={onToggleOrderBy}
      >
        <OrderByIcon className="size-4" />
        {t("report.filters.orderBy")}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="min-h-10 min-w-10"
        disabled={refreshDisabled}
        aria-label={t("actions.refresh")}
        onClick={onRefresh}
      >
        <RefreshCwIcon className="size-4" />
      </Button>
    </div>
  );
}
