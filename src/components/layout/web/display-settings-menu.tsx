"use client";

import { useTranslation } from "react-i18next";
import { Moon, Sun, SwatchBook } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useAppStore, type ThemeMode } from "@/stores/app-store";

// One header entry point for theme and color preferences. Replaces the draggable
// floating palette button (it sat on top of form fields). Language has its own
// header button so cashiers can switch it in one click.
export function DisplaySettingsMenu({ className }: { className?: string }) {
  const { t } = useTranslation();
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const label = t("app.appearance.changeColor");

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              aria-label={label}
              className={cn(
                "size-11 px-0 font-lao text-sidebar-primary hover:text-sidebar-primary aria-expanded:text-sidebar-primary sm:h-9 sm:w-auto sm:px-3",
                className,
              )}
            >
              <SwatchBook />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="end"
        className="max-h-(--radix-popover-content-available-height) w-72 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain"
      >
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
      </PopoverContent>
    </Popover>
  );
}
