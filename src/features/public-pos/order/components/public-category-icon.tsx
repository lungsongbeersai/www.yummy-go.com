"use client";

import { CategoryIcon } from "@/features/settings/category/category-icon";
import { UtensilsCrossed } from "lucide-react";
import { publicCategoryIconName } from "@/features/public-pos/order/utils";
import { cn } from "@/lib/utils";

export function PublicCategoryIcon({ className, icon }: { className?: string; icon?: string | null }) {
  const iconName = publicCategoryIconName(icon);
  if (!iconName) return <UtensilsCrossed aria-hidden="true" className={cn("size-4 shrink-0", className)} />;

  return (
    <CategoryIcon
      allowRemoteFallback={false}
      value={iconName}
      className={cn("size-4 shrink-0 text-current", className)}
    />
  );
}
