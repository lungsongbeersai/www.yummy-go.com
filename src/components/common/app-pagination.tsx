"use client";

import { useTranslation } from "react-i18next";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
  disabled?: boolean;
  onPageChange: (page: number) => void;
  page: number;
  rangeLabel?: string;
  totalPages: number;
};

export function AppPagination({
  className,
  disabled = false,
  onPageChange,
  page,
  rangeLabel,
  totalPages,
}: AppPaginationProps) {
  const { t } = useTranslation();
  const pageCount = Math.max(1, totalPages);
  const currentPage = Math.min(Math.max(1, page), pageCount);
  const pageItems = paginationItems(currentPage, pageCount);
  const canGoBack = currentPage > 1 && !disabled;
  const canGoNext = currentPage < pageCount && !disabled;
  // จอแคบ/หน้าเยอะเกินไม่โชว์ปุ่มเลขหน้า — ใช้ช่องกระโดดหน้าแทน กันแถบล้นจอ
  const hasHiddenPages = pageItems.some((item) => item === "ellipsis");

  function goToPage(target: number) {
    if (disabled) return;
    onPageChange(target);
  }

  return (
    <div
      className={cn(
        "flex flex-row flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground",
        className,
      )}
    >
      {rangeLabel ? (
        <p className="min-w-0 flex-1 truncate text-xs font-medium tabular-nums text-muted-foreground max-sm:basis-full">
          {rangeLabel}
        </p>
      ) : null}

      {/* มีหน้าเดียวก็ไม่ต้องมีปุ่มเลื่อนหน้า — เหลือไว้แค่ label บอกช่วงข้อมูล */}
      <div className={cn("flex min-w-0 shrink-0 items-center gap-2", pageCount <= 1 && "hidden")}>
        <div className={cn("items-center gap-2", hasHiddenPages ? "flex" : "flex sm:hidden")}>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {t("common.pageLabel")}
          </span>
          <Select
            value={String(currentPage)}
            disabled={disabled}
            onValueChange={(value) => goToPage(Number(value))}
          >
            <SelectTrigger
              aria-label={t("common.pageLabel")}
              className="h-8 w-16 tabular-nums text-foreground"
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
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {t("common.of")} {pageCount}
          </span>
        </div>

        <Pagination
          aria-label={t("common.pagination")}
          className="mx-0 w-auto max-w-full justify-end overflow-x-auto overscroll-x-contain"
        >
          <PaginationContent className="min-w-max flex-nowrap">
            <PaginationItem>
              <PaginationPrevious
                aria-disabled={!canGoBack}
                aria-label={t("common.previousPage")}
                className={cn(!canGoBack && "pointer-events-none opacity-50")}
                href="#"
                tabIndex={canGoBack ? undefined : -1}
                text={t("common.previousShort")}
                onClick={(event) => {
                  event.preventDefault();
                  goToPage(currentPage - 1);
                }}
              />
            </PaginationItem>

            {pageItems.map((item, index) =>
              item === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${index}`} className="hidden sm:flex">
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item} className="hidden sm:flex">
                  <PaginationLink
                    aria-current={item === currentPage ? "page" : undefined}
                    aria-disabled={disabled}
                    className={cn("tabular-nums", disabled && "pointer-events-none opacity-50")}
                    href="#"
                    isActive={item === currentPage}
                    onClick={(event) => {
                      event.preventDefault();
                      goToPage(item);
                    }}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}

            <PaginationItem>
              <PaginationNext
                aria-disabled={!canGoNext}
                aria-label={t("common.nextPage")}
                className={cn(!canGoNext && "pointer-events-none opacity-50")}
                href="#"
                tabIndex={canGoNext ? undefined : -1}
                text={t("common.nextShort")}
                onClick={(event) => {
                  event.preventDefault();
                  goToPage(currentPage + 1);
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
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
