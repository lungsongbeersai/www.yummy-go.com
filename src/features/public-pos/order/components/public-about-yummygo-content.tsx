"use client";

import { ArrowLeft, ArrowUpRight, Globe, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { YUMMY_GO_COMPANY } from "@/config/yummy-go-company";
import { PublicOwnerContactFooter, PublicOwnerIdentity, PublicRestaurantContactNote } from "./public-owner-contact";

interface PublicAboutYummyGoContentProps {
  onBack: () => void;
}

export function PublicAboutYummyGoContent({ onBack }: PublicAboutYummyGoContentProps) {
  const { t } = useTranslation();
  const company = YUMMY_GO_COMPANY;

  return (
    <>
      <SheetHeader className="shrink-0 border-b border-yg-divider bg-yg-bg2 px-4 pt-3 pb-3 pr-16 text-left">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button type="button" size="icon" variant="ghost" className="size-11 shrink-0 rounded-xl text-yg-muted hover:bg-yg-panel-hover hover:text-yg-ink" aria-label={t("publicHelp.backToHelp")} title={t("publicHelp.backToHelp")} onClick={onBack}><ArrowLeft className="size-5" aria-hidden="true" /></Button>
          <div className="flex min-w-0 flex-col gap-0.5">
            <SheetTitle tabIndex={-1} className="lao-tone-text font-yg-sans text-lg font-bold leading-7 text-yg-ink outline-none">{t("publicHelp.aboutAction", { name: company.name })}</SheetTitle>
            <SheetDescription className="sr-only">{t("publicHelp.description")}</SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4">
        <PublicOwnerIdentity />
        <p className="lao-tone-text text-sm leading-6 text-yg-ink">{t("publicCompany.description")}</p>
        <div className="flex flex-wrap gap-2">
          {(["qr", "pos", "tables"] as const).map((feature) => <span key={feature} className="lao-tone-text inline-flex min-h-7 items-center rounded-full border border-yg-line bg-yg-panel px-2.5 text-xs font-medium text-yg-muted">{t(`publicCompany.features.${feature}`)}</span>)}
        </div>

        {company.address ? <div className="flex items-start gap-3 rounded-2xl border border-yg-line p-3"><MapPin className="mt-0.5 size-5 shrink-0 text-yg-accent-strong" aria-hidden="true" /><div className="flex min-w-0 flex-col gap-1"><p className="lao-tone-text text-xs font-medium text-yg-muted">{t("publicCompany.address")}</p><p className="lao-tone-text text-sm leading-6 text-yg-ink">{company.address}</p></div></div> : null}

        <Button asChild variant="ghost" className="h-auto min-h-11 justify-start gap-2 whitespace-normal rounded-xl px-2 text-sm font-medium text-yg-accent-strong hover:bg-yg-panel-hover hover:text-yg-ink focus-visible:ring-yg-accent/30">
          <a href={company.website} target="_blank" rel="noopener noreferrer"><Globe className="size-4" aria-hidden="true" /><span className="lao-tone-text min-w-0 flex-1">{t("publicCompany.websiteLabel")}</span><ArrowUpRight className="size-4" aria-hidden="true" /></a>
        </Button>
        <PublicRestaurantContactNote />
      </div>

      <PublicOwnerContactFooter />
    </>
  );
}
