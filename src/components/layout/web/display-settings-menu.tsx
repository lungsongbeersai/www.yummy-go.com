"use client";

import { useTranslation } from "react-i18next";
import { Moon, Palette, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AppearanceControls } from "@/components/layout/appearance-controls";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { useAppStore, type ThemeMode } from "@/stores/app-store";

// One header entry point for every display preference. Replaces the draggable
// floating palette button (it sat on top of form fields) and the separate
// theme/language icon buttons that crowded the header.
export function DisplaySettingsMenu({ className }: { className?: string }) {
  const { t } = useTranslation();
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const label = t("app.appearance.openSettings");

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={label} className={className}>
              <Palette />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-72">
        <PopoverHeader>
          <PopoverTitle>{t("app.appearance.title")}</PopoverTitle>
        </PopoverHeader>
        <FieldSet>
          <FieldLegend variant="label">{t("app.appearance.modeLabel")}</FieldLegend>
          <ToggleGroup
            type="single"
            variant="outline"
            value={theme}
            onValueChange={(value) => {
              if (value) setTheme(value as ThemeMode);
            }}
            className="w-full"
          >
            <ToggleGroupItem value="light" className="flex-1">
              <Sun data-icon="inline-start" />
              {t("app.appearance.modes.light")}
            </ToggleGroupItem>
            <ToggleGroupItem value="dark" className="flex-1">
              <Moon data-icon="inline-start" />
              {t("app.appearance.modes.dark")}
            </ToggleGroupItem>
          </ToggleGroup>
        </FieldSet>
        <Separator />
        <AppearanceControls idPrefix="header-appearance-theme-color" />
        <Separator />
        <FieldSet>
          <FieldLegend variant="label">{t("app.appearance.languageLabel")}</FieldLegend>
          <LanguageSwitch variant="outline" className="w-full *:flex-1" />
        </FieldSet>
      </PopoverContent>
    </Popover>
  );
}
