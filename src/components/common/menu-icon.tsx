"use client";

import type { ComponentProps } from "react";
import { Icon, addCollection } from "@iconify/react";
import { icons as mdiIcons } from "@iconify-json/mdi";
import { normalizeMenuIconName } from "@/lib/menu-icons";

addCollection(mdiIcons);

type MenuIconProps = Omit<ComponentProps<typeof Icon>, "icon"> & {
  value?: unknown;
};

export function MenuIcon({ value, ...props }: MenuIconProps) {
  return <Icon aria-hidden icon={normalizeMenuIconName(value)} {...props} />;
}
