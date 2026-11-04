"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { ArrowUpRight, Bell, ChevronRight, CircleHelp, MessageCircle, Settings2, Utensils } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { YUMMY_GO_COMPANY } from "@/config/yummy-go-company";
import { PublicAboutYummyGoContent } from "./public-about-yummygo-content";

export type PublicHelpView = "help" | "about";

interface PublicHelpSheetProps {
  open: boolean;
  view: PublicHelpView;
  viewOnly: boolean;
  onOpenChange: (open: boolean) => void;
  onViewChange: (view: PublicHelpView) => void;
  onCloseAutoFocus: (event: Event) => void;
}

export function PublicHelpSheet({ open, view, viewOnly, onOpenChange, onViewChange, onCloseAutoFocus }: PublicHelpSheetProps) {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) contentRef.current?.querySelector<HTMLElement>('[data-slot="sheet-title"]')?.focus({ preventScroll: true });
  }, [open, view]);

  const topics = [
    { id: "order", icon: Utensils, question: viewOnly ? "viewOnlyQuestion" : "orderQuestion", answer: viewOnly ? "viewOnlyAnswer" : "orderAnswer" },
    { id: "staff", icon: Bell, question: "staffQuestion", answer: viewOnly ? "staffViewOnlyAnswer" : "staffAnswer" },
    { id: "preferences", icon: Settings2, question: "preferencesQuestion", answer: "preferencesAnswer" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        ref={contentRef}
        side="bottom"
        onCloseAutoFocus={onCloseAutoFocus}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.querySelector<HTMLElement>('[data-slot="sheet-title"]')?.focus({ preventScroll: true });
        }}
        className="mx-auto max-h-[min(90dvh,48rem)] w-full max-w-140 gap-0 overflow-hidden rounded-t-3xl border border-yg-divider bg-yg-bg2 p-0 font-yg-sans text-yg-ink [&>.ui-overlay-close-button]:size-11"
      >
        {view === "about" ? <PublicAboutYummyGoContent onBack={() => onViewChange("help")} /> : (
          <>
            <SheetHeader className="shrink-0 border-b border-yg-divider px-5 pt-5 pb-4 text-left">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-yg-accent-soft text-yg-accent-strong"><CircleHelp className="size-6" aria-hidden="true" /></span>
                <div className="flex min-w-0 flex-col gap-1">
                  <SheetTitle tabIndex={-1} className="lao-tone-text font-yg-sans text-xl font-bold leading-7 text-yg-ink outline-none">{t("publicHelp.title")}</SheetTitle>
                  <SheetDescription className="lao-tone-text text-xs leading-5 text-yg-muted">{t("publicHelp.description")}</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-4">
              <section aria-label={t("publicHelp.aboutSection")} className="flex flex-col gap-3 rounded-2xl border border-yg-accent bg-yg-accent p-4 text-yg-on-accent shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-yg-bg2 p-2"><Image src={YUMMY_GO_COMPANY.logo} width={36} height={36} alt="" className="rounded-lg object-contain" /></span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="lao-tone-text text-xs font-medium">{t("publicHelp.aboutSection")}</span>
                    <span className="font-yg-sans text-xl font-bold leading-7">{YUMMY_GO_COMPANY.name}</span>
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="lao-tone-text text-base font-bold leading-6">{t("publicHelp.aboutHeadline", { name: YUMMY_GO_COMPANY.name })}</h3>
                  <p className="lao-tone-text text-xs leading-5">{t("publicHelp.aboutDescription")}</p>
                </div>
                <Button asChild variant="outline" className="h-auto min-h-12 w-full justify-start gap-3 rounded-xl border-yg-line bg-yg-bg2 px-3 py-2 text-yg-ink hover:border-yg-accent-line hover:bg-yg-bg2 hover:text-yg-ink dark:border-yg-line dark:bg-yg-bg2 dark:text-yg-ink dark:hover:border-yg-accent-line dark:hover:bg-yg-bg2 dark:hover:text-yg-ink">
                  <a href={YUMMY_GO_COMPANY.whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label={t("publicCompany.contactAria", { name: YUMMY_GO_COMPANY.name, phone: YUMMY_GO_COMPANY.phone })}>
                    <MessageCircle className="size-5 shrink-0 text-yg-accent-strong" aria-hidden="true" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="lao-tone-text whitespace-normal text-xs leading-5 text-yg-muted">{t("publicCompany.contactLabel")}</span>
                      <span className="font-yg-number text-base font-semibold text-yg-ink tabular-nums">{YUMMY_GO_COMPANY.phone}</span>
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 text-yg-muted" aria-hidden="true" />
                  </a>
                </Button>
                <Button type="button" variant="ghost" aria-label={t("publicCompany.title", { name: YUMMY_GO_COMPANY.name })} className="h-11 w-full justify-between gap-3 rounded-xl border-t border-yg-on-accent/25 px-2 text-yg-on-accent hover:bg-yg-on-accent/10 hover:text-yg-on-accent focus-visible:ring-yg-on-accent dark:text-yg-on-accent dark:hover:bg-yg-on-accent/10 dark:hover:text-yg-on-accent" onClick={() => onViewChange("about")}>
                  <span className="lao-tone-text text-sm font-semibold">{t("publicHelp.aboutAction")}</span>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-yg-on-accent/15"><ChevronRight className="size-4" aria-hidden="true" /></span>
                </Button>
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="lao-tone-text text-xs font-semibold text-yg-muted">{t("publicHelp.orderingTitle")}</h3>
                <Accordion type="single" collapsible className="rounded-2xl border-yg-divider">
                  {topics.map(({ id, icon: Icon, question, answer }) => (
                    <AccordionItem key={id} value={id} className="border-yg-divider data-open:bg-yg-panel">
                      <AccordionTrigger className="min-h-12 items-center gap-3 px-3 py-3 text-sm font-semibold leading-6 text-yg-ink hover:bg-yg-panel-hover hover:no-underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yg-accent">
                        <Icon className="size-5 shrink-0 text-yg-accent-strong" aria-hidden="true" />
                        <span className="lao-tone-text min-w-0 flex-1">{t(`publicHelp.${question}`)}</span>
                      </AccordionTrigger>
                      <AccordionContent className="lao-tone-text h-auto px-1 pb-4 text-sm leading-6 text-yg-muted">{t(`publicHelp.${answer}`)}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </section>

            </div>

            <SheetFooter className="shrink-0 border-t border-yg-divider bg-yg-bg px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <SheetClose asChild><Button type="button" variant="outline" className="h-12 w-full rounded-xl border-yg-line bg-yg-panel text-sm font-semibold text-yg-ink hover:bg-yg-panel-hover hover:text-yg-ink">{t("publicCompany.returnToMenu")}</Button></SheetClose>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
