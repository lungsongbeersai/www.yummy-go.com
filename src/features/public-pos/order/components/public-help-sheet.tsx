"use client";

import { useEffect, useRef } from "react";
import { Bell, ChevronRight, Info, Settings2, Utensils, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { YUMMY_GO_COMPANY } from "@/config/yummy-go-company";
import { PublicAboutYummyGoContent } from "./public-about-yummygo-content";
import { PublicOwnerContactFooter, PublicOwnerIdentity, PublicRestaurantContactNote } from "./public-owner-contact";

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
        data-testid="public-help-sheet"
        data-view={view}
        side="bottom"
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.querySelector<HTMLElement>('[data-slot="sheet-title"]')?.focus({ preventScroll: true });
        }}
        className="mx-auto max-h-[92dvh] w-full max-w-120 gap-0 overflow-hidden rounded-t-3xl border border-yg-divider bg-yg-bg2 p-0 font-yg-sans text-yg-ink ring-yg-divider sm:max-h-[min(90dvh,44rem)]"
      >
        {view === "about" ? <PublicAboutYummyGoContent onBack={() => onViewChange("help")} /> : (
          <>
            <SheetHeader className="shrink-0 border-b border-yg-divider bg-yg-bg2 px-4 pt-4 pb-3 pr-16 text-left">
              <SheetTitle tabIndex={-1} className="lao-tone-text font-yg-sans text-lg font-bold leading-7 text-yg-ink outline-none">{t("publicHelp.title")}</SheetTitle>
              <SheetDescription className="sr-only">{t("publicHelp.description")}</SheetDescription>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
              <PublicOwnerIdentity />
              <PublicRestaurantContactNote />
              <Button type="button" variant="outline" className="h-auto min-h-11 w-full justify-start gap-2 whitespace-normal rounded-xl border-yg-line bg-yg-panel px-3 py-2 text-sm text-yg-ink hover:bg-yg-panel-hover hover:text-yg-ink focus-visible:ring-yg-accent/30" onClick={() => onViewChange("about")}>
                <Info aria-hidden="true" className="size-4 shrink-0 text-yg-muted" />
                <span className="lao-tone-text min-w-0 flex-1 text-left">{t("publicHelp.aboutAction", { name: YUMMY_GO_COMPANY.name })}</span>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-yg-muted" />
              </Button>

              <section className="flex flex-col gap-2">
                <h3 className="lao-tone-text text-sm font-semibold text-yg-ink">{t("publicHelp.orderingTitle")}</h3>
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
              <SheetClose asChild><Button type="button" variant="ghost" className="min-h-11 w-full rounded-xl text-sm text-yg-muted hover:bg-yg-panel-hover hover:text-yg-ink">{t("publicCompany.returnToMenu")}</Button></SheetClose>
            </div>

            <PublicOwnerContactFooter />
          </>
        )}
        <SheetClose asChild>
          <Button type="button" size="icon" variant="ghost" aria-label={t("actions.close")} className="absolute top-3 right-3 size-11 rounded-full text-yg-muted hover:bg-yg-panel-hover hover:text-yg-ink focus-visible:ring-yg-accent/30"><X aria-hidden="true" className="size-5" /></Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
