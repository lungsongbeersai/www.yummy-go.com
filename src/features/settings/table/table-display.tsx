"use client";

import { Table2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { SettingsIconTile } from "@/features/settings/shared/settings-tones";
import { cn } from "@/lib/utils";

export const TABLE_ICON = Table2;

// Free / busy is a real status, so it gets the reserved status colours (with its label), matching
// the dashboard's table-status card: free = success, occupied = info.
export function TableStatusBadge({ status }: { status: number }) {
  const { t } = useTranslation();
  if (!status) return <span className="text-muted-foreground">-</span>;
  const busy = status === 2;
  return (
    <Badge variant="outline">
      <span aria-hidden className={cn("size-1.5 rounded-full", busy ? "bg-info" : "bg-success")} />
      {busy ? t("common.busy") : t("common.free")}
    </Badge>
  );
}

// On = filled (it changes the bill), off = outline.
export function TableChargeBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <Badge variant={active ? "secondary" : "outline"} className="tabular-nums">
      {label}
    </Badge>
  );
}

export function TableIcon() {
  return <SettingsIconTile icon={TABLE_ICON} />;
}
