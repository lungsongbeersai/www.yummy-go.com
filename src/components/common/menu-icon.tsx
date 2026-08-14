"use client";

import type { ComponentProps } from "react";
import { FileText } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { normalizeMenuIconValue } from "@/lib/menu-icons";

type MenuIconProps = Omit<ComponentProps<typeof DynamicIcon>, "fallback" | "name"> & {
  value?: unknown;
};

export function MenuIcon({ value, ...props }: MenuIconProps) {
  return (
    <DynamicIcon
      aria-hidden
      fallback={() => <FileText aria-hidden />}
      name={normalizeMenuIconValue(value) as IconName}
      {...props}
    />
  );
}
