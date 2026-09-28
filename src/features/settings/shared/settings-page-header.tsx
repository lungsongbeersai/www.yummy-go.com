"use client";

import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SETTINGS_ACCENT } from "./settings-tones";

// The header every settings page starts with, list page or not: a card in the theme colour with
// the module's icon tile, its title (plus a record count on list pages), a one-line description
// and the page's actions on the right. Back navigation already lives in the app header.
export function SettingsPageHeader({
  actions,
  count,
  description,
  icon: Icon,
  title
}: {
  actions?: ReactNode;
  /** Number of records; omitted (or null while loading) hides the badge. */
  count?: number | null;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  const { t } = useTranslation();

  return (
    // shrink-0: a Card clips its overflow, which lets a flex column squash it.
    <Card className={cn("shrink-0 ring-0", SETTINGS_ACCENT.wash)}>
      <CardContent className="flex flex-wrap items-center gap-3">
        <span aria-hidden className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl shadow-sm", SETTINGS_ACCENT.solid)}>
          <Icon className="size-5" />
        </span>
        {/* min-w-48: when the actions don't fit beside the title they wrap onto their own row,
            instead of squeezing the title into a narrow column. */}
        <div className="flex min-w-48 flex-1 flex-col gap-0.5">
          {/* Explicit sizes: unset, text inherits the 16px document size and outweighs the 12px
              controls and tables below. */}
          <h1 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            {title}
            {typeof count === "number" ? (
              <Badge variant="secondary" className="tabular-nums">
                {t("common.total")} {count.toLocaleString("en-US")}
              </Badge>
            ) : null}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </CardContent>
    </Card>
  );
}
