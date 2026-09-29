"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CardTitle } from "@/components/ui/card";
import { SettingsIconTile } from "@/features/settings/shared/settings-tones";

// A form section's title with the module icon in the theme colour, so the long form reads as
// distinct sections at a glance (same tile as the settings pages).
export function ProductSectionTitle({ children, icon }: { children: ReactNode; icon: LucideIcon }) {
  return (
    <CardTitle className="flex items-center gap-2.5">
      <SettingsIconTile icon={icon} />
      {children}
    </CardTitle>
  );
}
