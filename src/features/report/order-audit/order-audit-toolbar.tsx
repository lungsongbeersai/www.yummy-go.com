"use client";

import { RefreshCwIcon, SlidersHorizontalIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function OrderAuditToolbar({
  search,
  onSearchChange,
  onSubmit,
  filterCount,
  onOpenFilters,
  onRefresh,
  refreshDisabled,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  onSubmit: () => void;
  filterCount: number;
  onOpenFilters: () => void;
  onRefresh: () => void;
  refreshDisabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={event => { event.preventDefault(); onSubmit(); }}
    >
      <Input
        value={search}
        maxLength={120}
        placeholder={t("orderAudit.search")}
        aria-label={t("orderAudit.search")}
        className="min-h-10 min-w-0 flex-1 basis-52"
        onChange={event => onSearchChange(event.target.value)}
      />
      <Button type="button" variant="outline" className="min-h-10 gap-2" onClick={onOpenFilters}>
        <SlidersHorizontalIcon className="size-4" />
        {t("orderAudit.filters")}
        {filterCount > 0 && <Badge variant="secondary">{filterCount}</Badge>}
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
    </form>
  );
}
