"use client";

import {
  Building2,
  CircleCheckBig,
  CircleOff,
  FlaskConical,
  ShieldCheck,
  type LucideIcon
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StoreReportSummary } from "@/services/store";
import type { StoreBranchLabels } from "./store-branch-types";

const cardTone = {
  general: "bg-muted/60 text-foreground",
  plc: "bg-primary/10 text-primary",
  test: "bg-info/15 text-info",
  active: "bg-success/15 text-success",
  inactive: "bg-destructive/10 text-destructive"
} as const;

interface SummaryCard {
  icon: LucideIcon;
  key: keyof typeof cardTone;
  label: string;
  value: number;
}

export function StoreReportSummaryCards({
  labels,
  summary
}: {
  labels: StoreBranchLabels;
  summary: StoreReportSummary;
}) {
  const cards: SummaryCard[] = [
    { icon: Building2, key: "general", label: labels.generalStores, value: summary.general },
    { icon: ShieldCheck, key: "plc", label: labels.plcStores, value: summary.plc },
    { icon: FlaskConical, key: "test", label: labels.testStores, value: summary.test },
    { icon: CircleCheckBig, key: "active", label: labels.activeStores, value: summary.active },
    { icon: CircleOff, key: "inactive", label: labels.inactiveStores, value: summary.inactive }
  ];

  return (
    <section aria-label={labels.storeSummary}>
      <h2 className="sr-only">{labels.storeSummary}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.key} size="sm" className="shadow-none">
              <CardContent className="flex items-center gap-3 p-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-md",
                    cardTone[card.key]
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs text-muted-foreground">{card.label}</span>
                  <span className="block text-xl font-black tabular-nums">
                    {card.value.toLocaleString("en-US")}
                  </span>
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
