"use client";

import {
  Building2,
  CircleCheckBig,
  CircleOff,
  FlaskConical,
  ShieldCheck,
  Store,
  type LucideIcon
} from "lucide-react";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StoreReportSummary } from "@/services/store";
import type { StoreBranchLabels } from "./store-branch-types";
import type { StoreCardFilter } from "./store-branch-utils";

// Same treatment as the dashboard KPI cards: a soft wash of the tone behind the card (fading to
// the card colour, so the number stays in the text colour) and a stronger icon tile.
// Class names are listed in full so Tailwind can see them.
const tones = {
  destructive: {
    card: "bg-linear-to-br from-destructive/15 via-destructive/5 to-card",
    icon: "bg-destructive/15 text-destructive"
  },
  muted: { card: "bg-linear-to-br from-muted via-muted/40 to-card", icon: "bg-muted text-muted-foreground" },
  primary: { card: "bg-linear-to-br from-primary/15 via-primary/5 to-card", icon: "bg-primary/15 text-primary-text" },
  success: { card: "bg-linear-to-br from-success/15 via-success/5 to-card", icon: "bg-success/15 text-success" },
} as const;

interface SummaryCard {
  className?: string;
  icon: LucideIcon;
  key: StoreCardFilter;
  label: string;
  tone: keyof typeof tones;
  value: number | null | undefined;
}

// Each card is also a filter toggle: press it to show only that kind of store, press it again
// (or clear the chip in the toolbar) to show everything.
export function StoreReportSummaryCards({
  filter,
  labels,
  summary,
  onFilterChange
}: {
  filter: StoreCardFilter | null;
  labels: StoreBranchLabels;
  summary: StoreReportSummary;
  onFilterChange: (filter: StoreCardFilter | null) => void;
}) {
  const cards: SummaryCard[] = [
    // Store types are categories, not states: they take the theme colour. Only open/closed below
    // are statuses, so only they use the status colours (docs/Design.md reserves those for status).
    { icon: Building2, key: "general", label: labels.generalStores, tone: "primary", value: summary.general },
    { icon: ShieldCheck, key: "plc", label: labels.plcStores, tone: "primary", value: summary.plc },
    { icon: FlaskConical, key: "test", label: labels.testStores, tone: "primary", value: summary.test },
    { icon: CircleCheckBig, key: "active", label: labels.activeStores, tone: "success", value: summary.active },
    { icon: Store, key: "active_non_demo", label: labels.activeNonDemoStores, tone: "success", value: summary.active_non_demo },
    // Inactive stores only turn red when there are some.
    {
      icon: CircleOff,
      key: "inactive",
      label: labels.inactiveStores,
      tone: summary.inactive > 0 ? "destructive" : "muted",
      value: summary.inactive
    }
  ];

  return (
    <section aria-label={labels.storeSummary} className="grid shrink-0 grid-cols-2 gap-4 @xl:grid-cols-3 @5xl:grid-cols-6">
      {cards.map((card) => {
        const selected = filter === card.key;

        return (
          <button
            key={card.key}
            type="button"
            aria-pressed={selected}
            disabled={card.value == null}
            className={cn("rounded-lg text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-70", card.className)}
            onClick={() => onFilterChange(selected ? null : card.key)}
          >
            <Card
              size="sm"
              className={cn(
                "h-full transition-shadow hover:ring-foreground/25",
                tones[card.tone].card,
                selected && "ring-2 ring-primary hover:ring-primary"
              )}
            >
              <CardHeader className="flex-1">
                <CardDescription>{card.label}</CardDescription>
                <CardAction>
                  <span aria-hidden className={cn("flex size-8 items-center justify-center rounded-lg", tones[card.tone].icon)}>
                    <card.icon className="size-4" />
                  </span>
                </CardAction>
                <CardTitle className="self-end text-2xl font-semibold tabular-nums">{card.value == null ? <span aria-label={labels.summaryUnavailable}>—</span> : card.value.toLocaleString("en-US")}</CardTitle>
              </CardHeader>
            </Card>
          </button>
        );
      })}
    </section>
  );
}
