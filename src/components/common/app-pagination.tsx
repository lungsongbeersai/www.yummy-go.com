"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type AppPaginationProps = {
  className?: string;
  compact?: boolean;
  disabled?: boolean;
  onPageChange: (page: number) => void;
  page: number;
  totalPages: number;
};

export function AppPagination({
  className,
  compact = false,
  disabled = false,
  onPageChange,
  page,
  totalPages,
}: AppPaginationProps) {
  const { t } = useTranslation();
  const pageCount = Math.max(1, totalPages);
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const pageItems = paginationItems(currentPage, pageCount);
  const canGoBack = currentPage > 1 && !disabled;
  const canGoNext = currentPage < pageCount && !disabled;

  return (
    <nav
      aria-label={t("common.pagination")}
      className={cn(
        "flex gap-2 text-sm text-muted-foreground",
        compact
          ? "flex-row items-center justify-between"
          : "flex-row items-center justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
        <span className="font-semibold text-foreground">
          {t("common.pageLabel")}
        </span>
        <Select
          value={String(currentPage)}
          disabled={disabled}
          onValueChange={(value) => onPageChange(Number(value))}
        >
          <SelectTrigger
            aria-label={t("common.pageLabel")}
            className="h-8 w-16 bg-background text-foreground sm:w-20"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" className="max-h-72">
            <SelectGroup>
              {Array.from({ length: pageCount }, (_, index) => index + 1).map(
                (item) => (
                  <SelectItem key={item} value={String(item)}>
                    {item}
                  </SelectItem>
                ),
              )}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">
          {t("common.of")} {pageCount}
        </span>
      </div>

      <Pagination
        aria-label={t("common.pagination")}
        className="mx-0 w-auto justify-end sm:hidden"
      >
        <PaginationContent className="min-w-max flex-nowrap gap-0.5">
          <PaginationItem>
            <PaginationAction
              disabled={!canGoBack}
              label={t("common.previousShort")}
              onClick={() => onPageChange(1)}
            >
              <ChevronsLeft aria-hidden="true" />
            </PaginationAction>
          </PaginationItem>
          <PaginationItem>
            <PaginationAction
              disabled={!canGoBack}
              label={t("common.previousPage")}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </PaginationAction>
          </PaginationItem>
          <PaginationItem>
            <PaginationAction
              disabled={!canGoNext}
              label={t("common.nextPage")}
              onClick={() => onPageChange(currentPage + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </PaginationAction>
          </PaginationItem>
          <PaginationItem>
            <PaginationAction
              disabled={!canGoNext}
              label={t("common.nextShort")}
              onClick={() => onPageChange(pageCount)}
            >
              <ChevronsRight aria-hidden="true" />
            </PaginationAction>
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      <Pagination
        aria-label={t("common.pagination")}
        className={cn(
          "mx-0 hidden overflow-x-auto overscroll-x-contain sm:flex",
          compact
            ? "w-auto justify-end"
            : "w-full justify-start sm:w-auto sm:justify-end",
        )}
      >
        <PaginationContent className="min-w-max flex-nowrap gap-1">
          <PaginationItem>
            <PaginationAction
              disabled={!canGoBack}
              label={t("common.previousShort")}
              onClick={() => onPageChange(1)}
            >
              <ChevronsLeft aria-hidden="true" />
            </PaginationAction>
          </PaginationItem>
          <PaginationItem>
            <PaginationAction
              disabled={!canGoBack}
              label={t("common.previousPage")}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </PaginationAction>
          </PaginationItem>

          {pageItems.map((item, index) =>
            item === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <Button
                  type="button"
                  size="iconSm"
                  variant={item === currentPage ? "outline" : "ghost"}
                  aria-current={item === currentPage ? "page" : undefined}
                  disabled={disabled}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </Button>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <PaginationAction
              disabled={!canGoNext}
              label={t("common.nextPage")}
              onClick={() => onPageChange(currentPage + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </PaginationAction>
          </PaginationItem>
          <PaginationItem>
            <PaginationAction
              disabled={!canGoNext}
              label={t("common.nextShort")}
              onClick={() => onPageChange(pageCount)}
            >
              <ChevronsRight aria-hidden="true" />
            </PaginationAction>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </nav>
  );
}

function PaginationAction({
  children,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      size="iconSm"
      aria-label={label}
      disabled={disabled}
      variant="ghost"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function paginationItems(currentPage: number, totalPages: number) {
  const pages = new Set([1, totalPages]);

  for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
    if (page > 1 && page < totalPages) pages.add(page);
  }

  const sortedPages = Array.from(pages).sort((left, right) => left - right);
  const items: Array<number | "ellipsis"> = [];

  sortedPages.forEach((page, index) => {
    const previous = sortedPages[index - 1];
    if (previous && page - previous > 1) items.push("ellipsis");
    items.push(page);
  });

  return items;
}
