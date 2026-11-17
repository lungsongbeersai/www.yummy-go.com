"use client";

import Image from "next/image";
import { useId } from "react";
import { ArrowUpRight, Globe, MessageCircle, Play, Smartphone, Utensils } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { SheetFooter } from "@/components/ui/sheet";
import { YUMMY_GO_COMPANY } from "@/config/yummy-go-company";

export function PublicOwnerIdentity() {
  const { t } = useTranslation();
  const company = YUMMY_GO_COMPANY;

  return (
    <section data-testid="public-owner-identity" aria-label={t("publicCompany.ownerLabel")} className="shrink-0 overflow-hidden rounded-2xl border border-yg-accent-line bg-yg-bg2 shadow-sm">
      <div className="flex min-w-0 items-center gap-3 bg-linear-to-br from-yg-accent-strong to-yg-accent px-4 py-4 text-yg-on-accent">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-yg-bg2 p-2.5 shadow-sm">
          <Image src={company.logo} width={36} height={36} alt="" className="rounded-lg object-contain" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="font-yg-sans text-[1.75rem] font-bold leading-9 tracking-tight">{company.name}</h3>
          <p className="lao-tone-text w-fit rounded-full border border-yg-on-accent/25 px-2 py-0.5 text-xs font-semibold leading-5">{t("publicCompany.ownerLabel")}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-4 py-3.5">
        <p className="lao-tone-text text-sm font-medium leading-6 text-yg-ink">{t("publicCompany.introduction", { name: company.name })}</p>
        <p className="lao-tone-text text-sm leading-6 text-yg-ink">{t("publicCompany.contactFor")}</p>
      </div>
    </section>
  );
}

export function PublicRestaurantContactNote() {
  const { t } = useTranslation();

  return (
    <div className="flex items-start gap-2 px-1 py-1">
      <Utensils aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-yg-muted" />
      <p className="lao-tone-text text-xs leading-5 text-yg-muted">{t("publicCompany.restaurantNote")}</p>
    </div>
  );
}

export function PublicOwnerLinks() {
  const { t } = useTranslation();
  const titleId = useId();
  const company = YUMMY_GO_COMPANY;
  const stores = [
    { id: "app-store", name: "App Store", device: "iPhone / iPad", href: company.appStoreUrl, label: "downloadAppStore", icon: Smartphone },
    { id: "google-play", name: "Google Play", device: "Android", href: company.googlePlayUrl, label: "downloadGooglePlay", icon: Play },
  ] as const;

  return (
    <section aria-labelledby={titleId} data-testid="public-owner-links" className="flex shrink-0 flex-col gap-3">
      <Button asChild variant="outline" className="h-auto min-h-11 w-full justify-start gap-2.5 whitespace-normal rounded-xl border-yg-line bg-yg-panel px-3 py-2 text-sm font-semibold text-yg-accent-strong hover:bg-yg-panel-hover hover:text-yg-accent-strong focus-visible:ring-yg-accent/30">
        <a data-testid="public-owner-website" href={company.website} target="_blank" rel="noopener noreferrer">
          <Globe aria-hidden="true" className="size-4 shrink-0" />
          <span className="lao-tone-text min-w-0 flex-1">{t("publicCompany.websiteLabel")}</span>
          <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
        </a>
      </Button>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 id={titleId} className="lao-tone-text text-sm font-semibold leading-5 text-yg-ink">{t("publicCompany.downloadApp")}</h3>
          <p className="lao-tone-text text-xs leading-5 text-yg-muted">{t("publicCompany.downloadDescription")}</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {stores.map(({ id, name, device, href, label, icon: Icon }) => (
            <Button key={id} asChild variant="outline" className="h-auto min-h-14 min-w-0 justify-start gap-2 whitespace-normal rounded-xl border-yg-line bg-yg-panel px-3 py-2 text-left text-yg-ink hover:border-yg-accent-line hover:bg-yg-panel-hover hover:text-yg-ink focus-visible:ring-yg-accent/30">
              <a data-testid={`public-owner-${id}`} href={href} target="_blank" rel="noopener noreferrer" aria-label={t(`publicCompany.${label}`)}>
                <Icon aria-hidden="true" className="size-5 shrink-0 text-yg-accent-strong" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm font-semibold leading-5">{name}</span>
                  <span className="text-xs font-normal leading-4 text-yg-muted">{device}</span>
                </span>
              </a>
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PublicOwnerContactFooter() {
  const { t } = useTranslation();
  const company = YUMMY_GO_COMPANY;

  return (
    <SheetFooter data-testid="public-owner-contact-footer" className="shrink-0 gap-2 border-t border-yg-divider bg-yg-bg2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Button asChild className="h-auto min-h-14 w-full gap-2.5 whitespace-normal rounded-2xl bg-yg-accent px-4 py-3 text-sm font-bold leading-6 text-yg-on-accent shadow-md shadow-yg-accent/15 hover:bg-yg-accent-strong hover:text-yg-on-accent focus-visible:border-yg-accent focus-visible:ring-yg-accent/30">
        <a data-testid="public-owner-whatsapp" href={company.whatsappUrl} target="_blank" rel="noopener noreferrer" aria-label={t("publicCompany.contactAria", { name: company.name, phone: company.phone })}>
          <MessageCircle aria-hidden="true" className="size-5 shrink-0" />
          <span className="lao-tone-text min-w-0 text-center">{t("publicCompany.contactAction")}</span>
        </a>
      </Button>
      <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center text-xs leading-5 text-yg-muted">WhatsApp <span aria-hidden="true">·</span> <span className="font-yg-number text-sm font-semibold tabular-nums text-yg-ink">{company.phone}</span></p>
    </SheetFooter>
  );
}
