"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ReportColumnHeadContent, ReportColumnPinToggle } from "./shared/report-column-head";
import type { LocalSortState } from "./shared/report-sort-utils";

/** ค่า aria-sort ของหัวคอลัมน์ — ใช้เองได้เมื่อหัวคอลัมน์มีอย่างอื่นนอกจากปุ่มเรียง */
export function reportSortAria<TKey extends string>(sort: LocalSortState<TKey>, sortKey: TKey) {
  if (sort?.key !== sortKey) return "none" as const;
  return sort.direction === "ASC" ? ("ascending" as const) : ("descending" as const);
}

/** ปุ่มเรียงของหัวคอลัมน์ (ไม่มี th ครอบ) — สำหรับหัวคอลัมน์ที่มีปุ่มอื่นอยู่ด้วย เช่นพับ/ขยายทุกกลุ่ม */
export function SortableReportHeadButton<TKey extends string,>({
  align,
  children,
  sort,
  sortKey,
  onSort,
}: {
  align?: "left" | "right";
  children: ReactNode;
  sort: LocalSortState<TKey>;
  sortKey: TKey;
  onSort: (key: TKey) => void;
}) {
  const active = sort?.key === sortKey;
  const Icon = active
    ? sort.direction === "ASC"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className={cn(
        "group/sort h-8 max-w-full px-1.5 text-xs font-medium",
        active && "text-primary",
        align === "right" ? "ml-auto justify-end" : "-ml-1.5 justify-start",
      )}
      onClick={() => onSort(sortKey)}
    >
      <span className="truncate">{children}</span>
      {/* ลูกศร ↑↓ ทุกคอลัมน์ทำให้หัวตารางรก — โชว์เต็มเฉพาะคอลัมน์ที่กำลังเรียง, คอลัมน์อื่นโผล่ตอนชี้/โฟกัส
          (จองที่ไว้ ไม่ให้หัวตารางขยับ) ส่วนจอสัมผัสที่ชี้ไม่ได้แสดงจางๆ ไว้ให้รู้ว่ากดเรียงได้ */}
      <Icon
        data-icon="inline-end"
        className={cn(
          !active &&
            "opacity-0 transition-opacity group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60 pointer-coarse:opacity-40 motion-reduce:transition-none",
        )}
      />
    </Button>
  );
}

export function SortableReportTableHead<TKey extends string,>({
  align,
  children,
  className,
  columnId,
  sort,
  sortKey,
  onSort,
}: {
  align?: "left" | "right";
  children: ReactNode;
  className?: string;
  /** id ของคอลัมน์ในเมนู "คอลัมน์" (ซ่อน/ล็อก) — กลายเป็น data-col ให้ useStickyTable */
  columnId?: string;
  sort: LocalSortState<TKey>;
  sortKey: TKey;
  onSort: (key: TKey) => void;
}) {
  const button = (
    <SortableReportHeadButton align={align} sort={sort} sortKey={sortKey} onSort={onSort}>
      {children}
    </SortableReportHeadButton>
  );
  if (!columnId) {
    return (
      <TableHead aria-sort={reportSortAria(sort, sortKey)} className={className}>
        {button}
      </TableHead>
    );
  }

  return (
    <TableHead aria-sort={reportSortAria(sort, sortKey)} className={cn("group/col", className)} data-col={columnId}>
      <ReportColumnHeadContent align={align}>
        <ReportColumnPinToggle
          columnId={columnId}
          label={typeof children === "string" ? children : columnId}
        />
        {button}
      </ReportColumnHeadContent>
    </TableHead>
  );
}
