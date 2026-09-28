"use client";

import { cn } from "@/lib/utils";
import { SETTINGS_ACCENT } from "@/features/settings/shared/settings-tones";
import type { Category } from "@/services/category";
import { CategoryIcon } from "./category-icon";
import { categoryValue } from "./category-utils";

/** The category's own icon in the settings accent tile (the icon replaces the generic module icon). */
export function CategoryIconTile({ row }: { row: Category }) {
  return (
    <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", SETTINGS_ACCENT.soft)}>
      <CategoryIcon allowRemoteFallback={false} className="size-4" value={categoryValue(row, "cate_icon")} />
    </span>
  );
}

// Lao name leads, English underneath (the old row repeated both again as "LA / EN").
export function categoryNames(row: Category) {
  const la = categoryValue(row, "cate_name_la", categoryValue(row, "cate_name", "-"));
  const en = categoryValue(row, "cate_name_eng");
  return { en: en && en !== la ? en : "", la };
}
