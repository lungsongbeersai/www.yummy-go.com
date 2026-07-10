"use client";

import type { ComponentProps } from "react";
import { MdiIcon } from "@/components/common/mdi-icon";
import { MENU_MDI_ICONS } from "@/lib/menu-mdi-icons.generated";
import { DEFAULT_MENU_ICON, normalizeMenuIconValue } from "@/lib/menu-icons";

type MenuIconProps = Omit<ComponentProps<typeof MdiIcon>, "fallbackValue" | "icons" | "value"> & {
  value?: unknown;
};

export function MenuIcon({ value, ...props }: MenuIconProps) {
  return (
    <MdiIcon
      aria-hidden
      fallbackValue={DEFAULT_MENU_ICON}
      icons={MENU_MDI_ICONS}
      value={normalizeMenuIconValue(value)}
      {...props}
    />
  );
}
