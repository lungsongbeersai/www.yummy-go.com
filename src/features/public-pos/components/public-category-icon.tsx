"use client";

import { icons as mdiIcons } from "@iconify-json/mdi";
import { Icon, addCollection } from "@iconify/react";
import { cn } from "@/lib/utils";
import { publicCategoryIconName } from "@/features/public-pos/utils";

addCollection(mdiIcons);

export function PublicCategoryIcon({ className, icon }: { className?: string; icon?: string | null }) {
  const iconName = publicCategoryIconName(icon);
  if (!iconName) return null;

  return <Icon aria-hidden="true" icon={iconName} className={cn("size-4 shrink-0 text-current", className)} />;
}
