"use client";

import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { LANGUAGES, type Language } from "@/lib/language";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
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
  contentAlign = "end",
  showShort = true,
  size,
  variant = "ghost"
}: LanguageSwitchProps = {}) {
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const current = LANGUAGE_META[language];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn("h-10 min-w-10 gap-1.5 px-2 font-black", className)}
        >
          <LanguageFlagImage src={current.flag} />
          {showShort ? <span className="hidden sm:inline">{current.short}</span> : null}
          {showShort ? <ChevronDown className="hidden sm:block" data-icon="inline-end" /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={contentAlign} className="w-32">
        {LANGUAGES.map((item) => {
          const meta = LANGUAGE_META[item.code];
          return (
            <DropdownMenuItem
              key={item.code}
              onSelect={() => setLanguage(item.code)}
              className="font-semibold"
            >
              <LanguageFlagImage src={meta.flag} />
              {meta.short}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
