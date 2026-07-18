"use client";

import type { ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export interface ReportPaginationProps {
  canGoBack: boolean;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  onPageChange: (page: number) => void;
  page: number;
  rangeLabel: string;
  totalPages: number;
}

export function ReportPagination({
  canGoBack,
  canGoNext,
  onBack,
  onNext,
  onPageChange,
  page,
  rangeLabel,
  totalPages,
}: ReportPaginationProps) {
  const { t } = useTranslation();
  const pageCount = Math.max(1, totalPages);
  const currentPage = Math.min(Math.max(1, page), pageCount);

  return (
    <div className="border-t border-border bg-card/95 px-2 py-1.5">
      <div className="flex min-h-9 min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground max-sm:basis-full">
          {rangeLabel}
        </p>

        <div className="flex shrink-0 items-center gap-1 max-sm:w-full max-sm:justify-end">
          <PaginationIconButton
            disabled={!canGoBack}
            label={t("common.previousShort")}
            onClick={() => onPageChange(1)}
          >
            <ChevronsLeft aria-hidden="true" />
          </PaginationIconButton>
          <PaginationIconButton
            disabled={!canGoBack}
            label={t("common.previousPage")}
            onClick={onBack}
          >
            <ChevronLeft aria-hidden="true" />
          </PaginationIconButton>

          <span className="mx-1 inline-flex h-8 min-w-[4.5rem] items-center justify-center rounded-md border border-border bg-muted/35 px-2 text-xs font-black tabular-nums text-foreground">
            {currentPage} / {pageCount}
          </span>

          <PaginationIconButton
            disabled={!canGoNext}
            label={t("common.nextPage")}
            onClick={onNext}
          >
            <ChevronRight aria-hidden="true" />
          </PaginationIconButton>
          <PaginationIconButton
            disabled={!canGoNext}
            label={t("common.nextShort")}
            onClick={() => onPageChange(pageCount)}
          >
            <ChevronsRight aria-hidden="true" />
          </PaginationIconButton>
        </div>
      </div>
    </div>
  );
}

function PaginationIconButton({
  children,
  disabled,
  label,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="iconSm"
      variant="ghost"
      aria-label={label}
      disabled={disabled}
      className="size-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
