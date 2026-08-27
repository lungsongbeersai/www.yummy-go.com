"use client";

import Image from "next/image";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type Language } from "@/lib/language";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAppStore } from "@/stores/app-store";

const LANGUAGE_META: Record<Language, { flag: string; short: string }> = {
  la: { flag: "https://flagcdn.com/w80/la.png", short: "LA" },
  en: { flag: "https://flagcdn.com/w80/us.png", short: "EN" }
};

interface LanguageSwitchProps {
  className?: string;
  /** ปุ่มเดี่ยวสลับภาษาไป-กลับ (เหมือน ThemeToggle) — ใช้เมื่อพื้นที่มีแค่ช่องไอคอนเดียว
   *  ต่างจากโหมดปกติที่เป็น ToggleGroup 2 ช่อง ซึ่งต้องการพื้นที่กว้างพอให้ทั้งสองธงแสดงพร้อมกัน */
  compact?: boolean;
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
  compact = false,
  contentAlign: _contentAlign = "end",
  showShort = true,
  size = "sm",
  variant = "ghost"
}: LanguageSwitchProps = {}) {
  const { t } = useTranslation();
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);

  if (compact) {
    const currentIndex = LANGUAGES.findIndex((item) => item.code === language);
    const next = LANGUAGES[(currentIndex + 1) % LANGUAGES.length] ?? LANGUAGES[0];
    const label = t("app.switchToLanguage", { language: next.label });
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label={label}
            className={className}
            size={size === "sm" ? "icon-sm" : size}
            type="button"
            variant={variant}
            onClick={() => setLanguage(next.code)}
          >
            <LanguageFlagImage src={LANGUAGE_META[language].flag} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    );
  }

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
            className="h-full gap-1 px-2 font-semibold text-xs"
          >
            <LanguageFlagImage src={meta.flag} />
            {showShort ? <span className="hidden sm:inline">{meta.short}</span> : null}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
