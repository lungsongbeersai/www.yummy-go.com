"use client";

import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CommercialTab } from "@/features/commercial/commercial-routes";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import { cn } from "@/lib/utils";

const sections = ["catalog", "quotations", "receipts"] as const;

export function CommercialWorkflowTabs({ value }: { value: CommercialTab }) {
  const l = useCommercialLabels();
  const current = sections.indexOf(value);

  return <TabsList aria-label={l("title")} className="grid w-full grid-cols-3 gap-0 rounded-xl border bg-card p-3 group-data-horizontal/tabs:h-auto sm:p-4">
    {sections.map((section, index) => <TabsTrigger key={section} value={section} aria-current={section === value ? "step" : undefined} className="relative h-auto min-w-0 flex-col gap-3 rounded-lg border-0 bg-transparent px-1 py-2 text-center whitespace-normal after:hidden hover:bg-transparent data-active:bg-transparent data-active:text-primary-text dark:data-active:border-transparent dark:data-active:bg-transparent dark:data-active:text-primary-text">
      {index < sections.length - 1 ? <span aria-hidden="true" className="pointer-events-none absolute top-8 left-1/2 h-0.5 w-full bg-border"><span className={cn("block h-full origin-left bg-primary-text transition-transform motion-reduce:transition-none", index < current ? "scale-x-100" : "scale-x-0")} /></span> : null}
      <span aria-hidden="true" className={cn("relative z-10 grid size-12 shrink-0 place-items-center rounded-full border-2 bg-card text-xl font-semibold transition-[border-color,box-shadow,color] motion-reduce:transition-none", index <= current ? "border-primary-text text-primary-text" : "border-border text-muted-foreground", section === value && "ring-4 ring-primary-text/15")}>{index + 1}</span>
      <span className={cn("relative min-w-0 text-xs leading-snug font-semibold break-words sm:text-sm", index <= current ? "text-primary-text" : "text-muted-foreground")}>{l(section)}</span>
    </TabsTrigger>)}
  </TabsList>;
}
