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

// Design.md §3.2/§3.6 — แถบเลื่อนหน้าอ่านเป็น "เครื่องมือชิ้นเดียว": กรอบเดียว เส้นคั่นบาง ไม่มีเงา
// §6 control radius 10–11px, §5 ตัวเลขใช้ tabular numerals
const CONTROL_SHELL =
  "inline-flex items-stretch divide-x divide-border overflow-hidden rounded-[10px] border border-border bg-card";
// §6/§10 ต้องการเป้าแตะ 44px — คงไว้บนจอสัมผัส ส่วน sm+ ลดเป็น 36px ตาม §2
// ("preserve fast scanning...even when that requires tighter spacing") เพราะแผงบิลกว้างต่ำสุด 320px
const CONTROL_CELL =
  "relative size-11 shrink-0 rounded-none shadow-none focus-visible:z-10 focus-visible:ring-inset sm:size-9";

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
  // §3.7 progressive disclosure — ช่องกระโดดหน้าโผล่เฉพาะตอนที่มีหน้าถูกซ่อนหลัง "…"
  // (บนมือถือโผล่เสมอ เพราะที่นั่นไม่ได้แสดงปุ่มเลขหน้า)
  const hasHiddenPages = pageItems.some((item) => item === "ellipsis");

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

      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <div className={cn("items-center gap-2", hasHiddenPages ? "flex" : "flex sm:hidden")}>
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            {t("common.pageLabel")}
          </span>
          <Select
            value={String(currentPage)}
            disabled={disabled}
            onValueChange={(value) => onPageChange(Number(value))}
          >
            <SelectTrigger
              aria-label={t("common.pageLabel")}
              className="h-11 w-16 rounded-[10px] bg-card tabular-nums text-foreground sm:h-9 sm:w-20"
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
          <PaginationContent className={cn(CONTROL_SHELL, "min-w-max flex-nowrap gap-0")}>
            <PaginationItem className="flex">
              <PaginationAction
                disabled={!canGoBack}
                label={t("common.previousShort")}
                onClick={() => onPageChange(1)}
              >
                <ChevronsLeft aria-hidden="true" />
              </PaginationAction>
            </PaginationItem>
            <PaginationItem className="flex">
              <PaginationAction
                disabled={!canGoBack}
                label={t("common.previousPage")}
                onClick={() => onPageChange(currentPage - 1)}
              >
                <ChevronLeft aria-hidden="true" />
              </PaginationAction>
            </PaginationItem>

            {/* จอแคบซ่อนเลขหน้าไว้ ใช้ช่องกระโดดหน้าด้านซ้ายแทน เพื่อไม่ให้แถบล้นออกนอกจอ */}
            {pageItems.map((item, index) =>
              item === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${index}`} className="hidden sm:flex">
                  <PaginationEllipsis className="size-11 text-muted-foreground sm:size-9" />
                </PaginationItem>
              ) : (
                <PaginationItem key={item} className="hidden sm:flex">
                  <Button
                    type="button"
                    size="iconSm"
                    variant="ghost"
                    className={cn(
                      CONTROL_CELL,
                      "tabular-nums",
                      item === currentPage
                        // §4/§15 เขียวคือ "หมุด" บอกตำแหน่งปัจจุบัน — มีได้ช่องเดียวในแถบนี้
                        ? "bg-primary font-semibold text-primary-foreground hover:bg-primary"
                        : "font-medium text-foreground",
                    )}
                    aria-current={item === currentPage ? "page" : undefined}
                    disabled={disabled}
                    onClick={() => onPageChange(item)}
                  >
                    {item}
                  </Button>
                </PaginationItem>
              ),
            )}

            <PaginationItem className="flex">
              <PaginationAction
                disabled={!canGoNext}
                label={t("common.nextPage")}
                onClick={() => onPageChange(currentPage + 1)}
              >
                <ChevronRight aria-hidden="true" />
              </PaginationAction>
            </PaginationItem>
            <PaginationItem className="flex">
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
      </div>
    </div>
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
      className={cn(CONTROL_CELL, "text-muted-foreground")}
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
