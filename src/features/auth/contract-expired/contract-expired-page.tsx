"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CalendarX2, ExternalLink, Phone } from "lucide-react";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { landingContact } from "@/features/landing/trial-link";
import { contractDateLabel } from "@/lib/branch-contract";
import { internalRoute } from "@/lib/routes";
import { useAuthStore } from "@/stores/auth-store";

export function ContractExpiredPage() {
  const { t, i18n } = useTranslation();
  const notice = useAuthStore((state) => state.contractExpiry);
  const clearContractExpiry = useAuthStore((state) => state.clearContractExpiry);
  const endDate = notice?.endOn ? contractDateLabel(notice.endOn, i18n.language) : "";
  const contactUrl = landingContact.facebook.trim();

  return <main className="flex min-h-svh flex-col items-center gap-5 bg-muted px-4 py-6 sm:px-6">
    <div className="flex w-full max-w-lg items-center justify-between gap-3">
      <Button asChild variant="ghost"><Link href="/home"><ArrowLeft />{t("auth.backToHome")}</Link></Button>
      <LanguageSwitch variant="outline" />
    </div>
    <Card className="my-auto w-full max-w-lg border-destructive/20 shadow-sm">
      <CardHeader className="items-center gap-3 text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-destructive/10 text-destructive"><CalendarX2 className="size-8" aria-hidden /></div>
        <p className="text-xs font-semibold tracking-widest text-muted-foreground">YUMMYGO</p>
        <CardTitle className="text-2xl"><h1>{t("auth.contractExpired.title")}</h1></CardTitle>
        <CardDescription className="max-w-sm text-balance leading-relaxed">{t("auth.contractExpired.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {endDate && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/50 p-3 text-sm"><span className="text-muted-foreground">{t("auth.contractExpired.endDate")}</span><time dateTime={notice?.endOn} className="font-medium tabular-nums">{endDate}</time></div>}
        <p className="text-sm leading-relaxed text-muted-foreground">{t("auth.contractExpired.paymentHelp")}</p>
        <div className="flex flex-col gap-3">
          <Button asChild className="min-h-11 whitespace-normal py-3 text-center">
            {contactUrl ? <a href={contactUrl} target="_blank" rel="noopener noreferrer"><ExternalLink />{t("auth.contractExpired.contact")}</a>
              : <Link href={internalRoute("/home#trial")}>{t("auth.contractExpired.contact")}</Link>}
          </Button>
          {landingContact.phone && <Button asChild variant="outline" className="min-h-11 whitespace-normal py-3"><a href={`tel:${landingContact.phone.replace(/\s/g, "")}`}><Phone />{t("auth.contractExpired.call")} · {landingContact.phone}</a></Button>}
          <Button asChild variant="secondary" className="min-h-11 whitespace-normal py-3"><Link href="/login" onClick={clearContractExpiry}>{t("auth.contractExpired.retry")}</Link></Button>
        </div>
      </CardContent>
    </Card>
  </main>;
}
