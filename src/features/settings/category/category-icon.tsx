"use client";

import type { ComponentProps } from "react";
import { MdiIcon } from "@/components/common/mdi-icon";
import { CATEGORY_MDI_ICONS } from "@/features/settings/category/category-mdi-icons.generated";
import {
  DEFAULT_CATEGORY_ICON,
  categoryIconName
} from "@/features/settings/category/category-icons";

type CategoryIconProps = Omit<ComponentProps<typeof MdiIcon>, "fallbackValue" | "icons" | "value"> & {
  value: string;
};

export function CategoryIcon({ value, ...props }: CategoryIconProps) {
  return (
    <MdiIcon
      aria-hidden
      fallbackValue={DEFAULT_CATEGORY_ICON}
      icons={CATEGORY_MDI_ICONS}
      value={categoryIconName(value)}
      {...props}
    />
  );
}
