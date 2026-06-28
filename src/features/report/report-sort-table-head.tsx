"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { LocalSortState } from "./report-sort-utils";

export function SortableReportTableHead<TKey extends string,>({
  align,
  children,
  className,
  sort,
  sortKey,
  onSort,
}: {
  align?: "left" | "right";
  children: ReactNode;
  className?: string;
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
    <TableHead
      aria-sort={
        active ? (sort.direction === "ASC" ? "ascending" : "descending") : "none"
      }
      className={className}
    >
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className={cn(
          "h-8 max-w-full px-1.5 text-xs font-black",
          active && "text-primary",
          align === "right" ? "ml-auto justify-end" : "-ml-1.5 justify-start",
        )}
        onClick={() => onSort(sortKey)}
      >
        <span className="truncate">{children}</span>
        <Icon data-icon="inline-end" />
      </Button>
    </TableHead>
  );
}
