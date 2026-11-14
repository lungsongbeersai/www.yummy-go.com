"use client";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CommercialTab } from "@/features/commercial/commercial-routes";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import { cn } from "@/lib/utils";

const sections = ["catalog", "quotations", "receipts"] as const;

export function CommercialWorkflowTabs({ value }: { value: CommercialTab }) {
  const l = useCommercialLabels();

  return <TabsList aria-label={l("title")} className="grid w-full grid-cols-3 gap-3 rounded-none bg-transparent p-0 group-data-horizontal/tabs:h-auto sm:max-w-2xl">
    {sections.map((section, index) => <TabsTrigger key={section} value={section} aria-current={section === value ? "step" : undefined} className="relative min-h-12 min-w-0 gap-2 rounded-md border border-transparent bg-transparent px-2 py-2 whitespace-normal after:hidden hover:bg-muted/60 data-active:border-primary-text/25 data-active:bg-primary/10 data-active:text-primary-text dark:data-active:border-primary-text/25 dark:data-active:bg-primary/10 dark:data-active:text-primary-text">
      <span aria-hidden="true" className={cn("grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums", section === value ? "border-primary-text bg-background text-primary-text" : "border-border bg-background text-muted-foreground")}>{index + 1}</span>
      <span className="min-w-0 text-left text-xs leading-snug font-medium break-words sm:text-sm">{l(section)}</span>
      {index < sections.length - 1 ? <span aria-hidden="true" className="pointer-events-none absolute top-1/2 -right-3 h-px w-3 bg-border" /> : null}
    </TabsTrigger>)}
  </TabsList>;
}
