"use client";

import Image from "next/image";
import { ArrowLeft, ArrowUpRight, Bell, Globe, MapPin, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { YUMMY_GO_COMPANY } from "@/config/yummy-go-company";

interface PublicAboutYummyGoContentProps {
  onBack: () => void;
}

export function PublicAboutYummyGoContent({ onBack }: PublicAboutYummyGoContentProps) {
  const { t } = useTranslation();
  const company = YUMMY_GO_COMPANY;

  return (
    <>
      <SheetHeader className="shrink-0 border-b border-yg-divider px-4 pt-4 pb-4 text-left">
        <div className="flex min-w-0 items-center gap-2.5">
          <Button type="button" size="icon" variant="ghost" className="size-11 shrink-0 rounded-xl text-yg-muted hover:bg-yg-panel-hover hover:text-yg-ink" aria-label={t("publicHelp.backToHelp")} title={t("publicHelp.backToHelp")} onClick={onBack}><ArrowLeft className="size-5" aria-hidden="true" /></Button>
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-yg-accent-line bg-yg-accent-soft p-1.5"><Image src={company.logo} alt="" width={32} height={32} className="rounded-lg object-contain" /></span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <SheetTitle tabIndex={-1} className="font-yg-sans text-xl font-bold leading-7 text-yg-ink outline-none">{company.name}</SheetTitle>
            <SheetDescription className="lao-tone-text text-xs leading-5 text-yg-muted">{t("publicCompany.tagline")}</SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-4">
        <div className="flex flex-col items-start gap-2 rounded-2xl border border-yg-accent bg-yg-accent p-4 text-yg-on-accent">
          <h3 className="lao-tone-text text-lg font-bold leading-7">{t("publicCompany.headline", { name: company.name })}</h3>
          <p className="lao-tone-text text-sm leading-6">{t("publicCompany.description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["qr", "pos", "tables"] as const).map((feature) => <span key={feature} className="lao-tone-text inline-flex min-h-7 items-center rounded-full border border-yg-line bg-yg-panel px-2.5 text-xs font-medium text-yg-muted">{t(`publicCompany.features.${feature}`)}</span>)}
        </div>

        <Button asChild variant="outline" className="h-auto min-h-16 w-full justify-start gap-3 rounded-2xl border-yg-line bg-yg-panel p-3 text-left hover:border-yg-accent-line hover:bg-yg-panel-hover hover:text-yg-ink">
          <a href={company.whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label={t("publicCompany.contactAria", { name: company.name, phone: company.phone })}>
            <MessageCircle className="size-5 shrink-0 text-yg-accent-strong" aria-hidden="true" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="lao-tone-text whitespace-normal text-xs font-medium leading-5 text-yg-muted">{t("publicCompany.contactLabel")}</span>
              <span className="font-yg-number text-base font-semibold tabular-nums text-yg-ink">{company.phone}</span>
            </span>
            <ArrowUpRight className="size-4 shrink-0 text-yg-muted" aria-hidden="true" />
          </a>
        </Button>

        {company.address ? <div className="flex items-start gap-3 rounded-2xl border border-yg-line p-3"><MapPin className="mt-0.5 size-5 shrink-0 text-yg-accent-strong" aria-hidden="true" /><div className="flex min-w-0 flex-col gap-1"><p className="lao-tone-text text-xs font-medium text-yg-muted">{t("publicCompany.address")}</p><p className="lao-tone-text text-sm leading-6 text-yg-ink">{company.address}</p></div></div> : null}

        <Button asChild variant="ghost" className="h-11 justify-start gap-2 rounded-xl px-2 text-sm font-medium text-yg-accent-strong hover:bg-yg-panel-hover hover:text-yg-ink">
          <a href={company.website} target="_blank" rel="noopener noreferrer"><Globe className="size-4" aria-hidden="true" /><span className="lao-tone-text min-w-0 flex-1 truncate">{t("publicCompany.websiteLabel")}</span><ArrowUpRight className="size-4" aria-hidden="true" /></a>
        </Button>
        <div className="flex items-start gap-2 rounded-xl bg-yg-panel2 p-3"><Bell className="mt-0.5 size-4 shrink-0 text-yg-muted" aria-hidden="true" /><p className="lao-tone-text text-xs leading-5 text-yg-muted">{t("publicCompany.restaurantNote")}</p></div>
      </div>

      <SheetFooter className="shrink-0 gap-3 border-t border-yg-divider bg-yg-bg px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-1"><p className="lao-tone-text text-sm font-semibold leading-6 text-yg-ink">{t("publicCompany.interest")}</p><p className="lao-tone-text text-xs leading-5 text-yg-muted">{t("publicCompany.contactDescription")}</p></div>
        <Button asChild className="h-12 w-full gap-2 rounded-xl bg-yg-accent px-4 text-sm font-semibold text-yg-on-accent hover:bg-yg-accent-strong">
          <a href={company.whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label={t("publicCompany.contactAria", { name: company.name, phone: company.phone })}><MessageCircle className="size-5" aria-hidden="true" /><span className="lao-tone-text min-w-0 flex-1 truncate">{t("publicCompany.contactAction")}</span><ArrowUpRight className="size-4" aria-hidden="true" /></a>
        </Button>
      </SheetFooter>
    </>
  );
}
