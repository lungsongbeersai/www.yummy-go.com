"use client";

import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { YUMMY_GO_COMPANY } from "@/config/yummy-go-company";

interface PublicBrandCreditProps {
  onAbout: () => void;
}

export function PublicBrandCredit({ onAbout }: PublicBrandCreditProps) {
  const { t } = useTranslation();

  return (
    <footer className="flex justify-center border-t border-yg-divider pt-3">
      <Button
        type="button"
        variant="ghost"
        aria-label={t("publicCompany.title", { name: YUMMY_GO_COMPANY.name })}
        className="h-11 gap-2 rounded-xl px-3 text-xs font-normal text-yg-muted hover:bg-yg-panel-hover hover:text-yg-ink"
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true });
          onAbout();
        }}
      >
        <Image src={YUMMY_GO_COMPANY.logo} alt="" width={20} height={20} className="rounded-md" />
        <span>{t("publicCompany.poweredBy")}</span>
        <span className="font-semibold text-yg-accent-strong">{YUMMY_GO_COMPANY.name}</span>
        <ChevronRight className="size-3.5" aria-hidden="true" />
      </Button>
    </footer>
  );
}
