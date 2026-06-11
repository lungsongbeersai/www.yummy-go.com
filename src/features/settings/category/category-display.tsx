"use client";

import { Badge } from "@/components/ui/badge";
import type { Category } from "@/services/category";
import { CategoryIcon } from "./category-icon-picker";
import {
  categoryName,
  categoryValue
} from "./category-utils";

export function CategoryCodeBadge({ iconValue }: { iconValue: string }) {
  return (
    <Badge className="max-w-full border-primary/20 bg-primary/10 text-primary" translate="no">
      {iconValue || "-"}
    </Badge>
  );
}

export function CategoryIdentity({ row }: { row: Category }) {
  const iconValue = categoryValue(row, "cate_icon");

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <CategoryIcon value={iconValue} />
      </span>
      <div className="min-w-0">
        <p className="truncate font-black">{categoryName(row)}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {categoryValue(row, "cate_name_la", "-")} / {categoryValue(row, "cate_name_eng", "-")}
        </p>
      </div>
    </div>
  );
}
