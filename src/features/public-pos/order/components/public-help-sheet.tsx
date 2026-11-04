"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { Bell, ChevronRight, CircleHelp, Settings2, Utensils } from "lucide-react";
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
              <section aria-label={t("publicHelp.aboutSection")}>
                <Button
                  type="button"
                  variant="default"
                  aria-label={t("publicCompany.title", { name: YUMMY_GO_COMPANY.name })}
                  className="group h-auto w-full flex-col items-stretch gap-3 whitespace-normal rounded-2xl border border-yg-accent bg-yg-accent p-4 text-left text-yg-on-accent shadow-sm hover:bg-yg-accent-strong hover:text-yg-on-accent focus-visible:ring-yg-accent"
                  onClick={() => onViewChange("about")}
                >
                  <span className="flex items-center gap-3">
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-yg-bg2 p-2"><Image src={YUMMY_GO_COMPANY.logo} width={36} height={36} alt="" className="rounded-lg object-contain" /></span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="lao-tone-text text-xs font-medium">{t("publicHelp.aboutSection")}</span>
                      <span className="font-yg-sans text-xl font-bold leading-7">{YUMMY_GO_COMPANY.name}</span>
                    </span>
                  </span>
                  <span className="flex flex-col gap-1">
                    <span className="lao-tone-text text-base font-bold leading-6">{t("publicHelp.aboutHeadline")}</span>
                    <span className="lao-tone-text text-xs font-normal leading-5">{t("publicHelp.aboutDescription")}</span>
                  </span>
                  <span className="flex items-center justify-between gap-3 border-t border-yg-on-accent/25 pt-2">
                    <span className="lao-tone-text text-sm font-semibold">{t("publicHelp.aboutAction")}</span>
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-yg-on-accent/15"><ChevronRight className="size-4" aria-hidden="true" /></span>
                  </span>
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
