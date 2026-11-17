"use client";

import Image from "next/image";
import { MessageCircle, Utensils } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import { YUMMY_GO_COMPANY } from "@/config/yummy-go-company";

export function PublicOwnerIdentity() {
  const { t } = useTranslation();
  const company = YUMMY_GO_COMPANY;

  return (
    <section data-testid="public-owner-identity" aria-label={t("publicCompany.ownerLabel")} className="flex flex-col gap-3 rounded-2xl border border-yg-accent-line bg-yg-accent-soft/30 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-yg-line bg-yg-bg2 p-2.5">
          <Image src={company.logo} width={36} height={36} alt="" className="rounded-lg object-contain" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-yg-sans text-2xl font-bold leading-8 text-yg-ink">{company.name}</h3>
          <p className="lao-tone-text text-xs font-semibold leading-5 text-yg-accent-strong">{t("publicCompany.ownerLabel")}</p>
        </div>
      </div>
      <p className="lao-tone-text text-sm leading-6 text-yg-ink">{t("publicCompany.introduction", { name: company.name })}</p>
      <p className="lao-tone-text text-sm leading-6 text-yg-muted">{t("publicCompany.contactFor")}</p>
    </section>
  );
}

export function PublicRestaurantContactNote() {
  const { t } = useTranslation();

  return (
    <div className="flex items-start gap-2 rounded-xl bg-yg-panel2 px-3 py-2.5">
      <Utensils aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-yg-muted" />
      <p className="lao-tone-text text-xs leading-5 text-yg-muted">{t("publicCompany.restaurantNote")}</p>
    </div>
  );
}

export function PublicOwnerContactFooter() {
  const { t } = useTranslation();
  const company = YUMMY_GO_COMPANY;

  return (
    <SheetFooter data-testid="public-owner-contact-footer" className="shrink-0 gap-2 border-t border-yg-divider bg-yg-bg2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Button asChild className="h-auto min-h-14 w-full gap-2.5 whitespace-normal rounded-xl bg-yg-accent px-4 py-3 text-sm font-semibold leading-6 text-yg-on-accent hover:bg-yg-accent-strong hover:text-yg-on-accent focus-visible:border-yg-accent focus-visible:ring-yg-accent/30">
        <a data-testid="public-owner-whatsapp" href={company.whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label={t("publicCompany.contactAria", { name: company.name, phone: company.phone })}>
          <MessageCircle aria-hidden="true" className="size-5 shrink-0" />
          <span className="lao-tone-text min-w-0 text-center">{t("publicCompany.contactAction")}</span>
        </a>
      </Button>
      <p className="text-center text-xs leading-5 text-yg-muted">WhatsApp <span aria-hidden="true">·</span> <span className="font-yg-number tabular-nums">{company.phone}</span></p>
    </SheetFooter>
  );
}
