"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type Language } from "@/lib/language";
import { cn } from "@/lib/utils";
import { type ButtonProps } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAppStore } from "@/stores/app-store";

const LANGUAGE_META: Record<Language, { flag: string; short: string }> = {
  la: { flag: "https://flagcdn.com/w80/la.png", short: "LA" },
  en: { flag: "https://flagcdn.com/w80/us.png", short: "EN" }
};

interface LanguageSwitchProps {
  className?: string;
  contentAlign?: "start" | "center" | "end";
  showShort?: boolean;
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
}

function LanguageFlagImage({ src }: { src: string }) {
  return (
    <span aria-hidden="true" className="relative block h-4 w-6 shrink-0 overflow-hidden rounded-[2px]">
      <Image src={src} alt="" fill sizes="24px" className="object-cover" />
    </span>
  );
}

export function LanguageSwitch({
  className,
  contentAlign: _contentAlign = "end",
  showShort = true,
  size = "sm",
  variant = "ghost"
}: LanguageSwitchProps = {}) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  return (
    <ToggleGroup
      type="single"
      value={language}
      variant={variant === "outline" ? "outline" : "default"}
      size={size === "sm" ? "sm" : "default"}
      spacing={0}
      aria-label={t("app.changeLanguage")}
      className={cn("h-8 sm:h-7", className)}
      onValueChange={(value) => {
        if (value) setLanguage(value as Language);
      }}
    >
      {LANGUAGES.map((item) => {
        const meta = LANGUAGE_META[item.code];
        return (
          <ToggleGroupItem
            key={item.code}
            value={item.code}
            aria-label={meta.short}
            className="h-full gap-1 px-2 font-semibold text-[12px]"
          >
            <LanguageFlagImage src={meta.flag} />
            {showShort ? <span className="hidden sm:inline">{meta.short}</span> : null}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
