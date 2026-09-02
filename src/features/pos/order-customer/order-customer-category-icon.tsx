"use client";

import { CategoryIcon } from "@/features/settings/category/category-icon";
import { optionalString } from "@/lib/values";

export function CategoryIconView({
  className,
  icon,
}: {
  className?: string;
  icon?: string | null;
}) {
  const iconName = optionalString(icon);
  if (!iconName) return null;

  return <CategoryIcon allowRemoteFallback={false} value={iconName} className={className} />;
}
