"use client";

import { useRef, useSyncExternalStore } from "react";
import { ChevronDown, Grid2X2, Info, List, Moon, Settings2, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES, type Language } from "@/lib/language";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { usePublicPosTheme, writePublicPosTheme } from "../public-pos-theme";
import {
  readPublicProductLayoutMode,
  subscribePublicProductLayoutMode,
  writePublicProductLayoutMode,
} from "../product-layout-mode";
import type { PublicProductLayoutMode } from "../types";
import { YUMMY_GO_COMPANY } from "@/config/yummy-go-company";

const MENU_CLASS =
  "w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-yg-divider bg-yg-bg2 p-2 font-yg-sans text-yg-ink shadow-xl";
const ITEM_CLASS =
  "min-h-11 gap-3 rounded-xl py-2 pr-9 pl-3 text-sm font-medium text-yg-ink focus:bg-yg-panel-hover focus:text-yg-ink focus:**:text-yg-ink data-[state=checked]:bg-yg-accent-soft data-[state=checked]:text-yg-accent-strong";
const LANGUAGE_NAMES: Record<Language, string> = { la: "ລາວ", en: "English" };

interface PublicHeaderPreferencesProps {
  className: string;
  onAbout: () => void;
}

export function PublicHeaderPreferences({ className, onAbout }: PublicHeaderPreferencesProps) {
  const { t } = useTranslation();
  const theme = usePublicPosTheme();
  const language = useAppStore((state) => state.language);
  const setLanguage = useAppStore((state) => state.setLanguage);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const pendingAboutRef = useRef(false);
  const layout = useSyncExternalStore(
    subscribePublicProductLayoutMode,
    readPublicProductLayoutMode,
    (): PublicProductLayoutMode => "list",
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          ref={triggerRef}
          className={cn(className, "gap-0.5")}
          aria-label={t("app.appearance.openSettings")}
          title={t("app.appearance.openSettings")}
        >
          <Settings2 className="size-5" aria-hidden="true" />
          <ChevronDown className="size-2.5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className={MENU_CLASS} aria-label={t("app.appearance.openSettings")}
        onCloseAutoFocus={(event) => {
          if (!pendingAboutRef.current) return;
          event.preventDefault();
          pendingAboutRef.current = false;
          triggerRef.current?.focus({ preventScroll: true });
          // Let the menu release its modal focus scope before the sheet opens.
          window.requestAnimationFrame(onAbout);
        }}
      >
        <DropdownMenuLabel className="lao-tone-text px-3 text-xs font-semibold text-yg-muted">{t("app.theme")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          aria-label={t("app.theme")}
          value={theme}
          onValueChange={(value) => {
            if (value === "light" || value === "dark") writePublicPosTheme(value);
          }}
        >
          <DropdownMenuRadioItem value="light" className={ITEM_CLASS}>
            <Sun className="size-5" aria-hidden="true" />
            <span className="lao-tone-text">{t("pos.themeLight")}</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className={ITEM_CLASS}>
            <Moon className="size-5" aria-hidden="true" />
            <span className="lao-tone-text">{t("pos.themeDark")}</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className="bg-yg-divider" />
        <DropdownMenuLabel className="lao-tone-text px-3 text-xs font-semibold text-yg-muted">{t("app.appearance.languageLabel")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          aria-label={t("app.appearance.languageLabel")}
          value={language}
          onValueChange={(value) => {
            const selected = LANGUAGES.find((item) => item.code === value);
            if (selected) setLanguage(selected.code);
          }}
        >
          {LANGUAGES.map(({ code }) => (
            <DropdownMenuRadioItem key={code} value={code} className={ITEM_CLASS}>
              <span aria-hidden="true" className="grid h-7 w-8 shrink-0 place-items-center rounded-lg bg-yg-accent-soft font-yg-number text-2xs font-bold text-yg-accent-strong">{code.toUpperCase()}</span>
              <span className="lao-tone-text" lang={code === "la" ? "lo" : "en"}>{LANGUAGE_NAMES[code]}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className="bg-yg-divider" />
        <DropdownMenuLabel className="lao-tone-text px-3 text-xs font-semibold text-yg-muted">{t("pos.publicLayout")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          aria-label={t("pos.publicLayout")}
          value={layout}
          onValueChange={(value) => {
            if (value === "list" || value === "grid") writePublicProductLayoutMode(value);
          }}
        >
          <DropdownMenuRadioItem value="list" className={ITEM_CLASS}>
            <List className="size-5" aria-hidden="true" />
            <span className="lao-tone-text">{t("pos.publicListView")}</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="grid" className={ITEM_CLASS}>
            <Grid2X2 className="size-5" aria-hidden="true" />
            <span className="lao-tone-text">{t("pos.publicGridView")}</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className="bg-yg-divider" />
        <DropdownMenuItem
          className="min-h-11 gap-3 rounded-xl px-3 py-2 text-sm font-medium text-yg-ink focus:bg-yg-panel-hover focus:text-yg-ink focus:**:text-yg-ink"
          onSelect={() => { pendingAboutRef.current = true; }}
        >
          <Info className="size-5 text-yg-accent-strong" aria-hidden="true" />
          <span className="lao-tone-text">{t("publicCompany.title", { name: YUMMY_GO_COMPANY.name })}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
