"use client";

import { CategoryIcon } from "@/features/settings/category/category-icon";
import { publicCategoryIconName } from "@/features/public-pos/order/menu-render";
import { cn } from "@/lib/utils";

export function PublicCategoryIcon({ className, icon }: { className?: string; icon?: string | null }) {
  const iconName = publicCategoryIconName(icon);
  if (!iconName) return null;

  return <CategoryIcon value={iconName} className={cn("size-4 shrink-0 text-current", className)} />;
}
