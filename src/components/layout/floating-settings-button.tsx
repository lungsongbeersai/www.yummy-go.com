"use client";

import { Palette } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAppStore, type FontScale, type ThemeColor } from "@/stores/app-store";

const THEME_COLORS: readonly ThemeColor[] = ["emerald", "blue", "amber", "rose", "violet"];

const FONT_SCALES: readonly FontScale[] = ["sm", "md", "lg"];

export function FloatingSettingsButton() {
  const { t } = useTranslation();
  const themeColor = useAppStore((state) => state.themeColor);
  const setThemeColor = useAppStore((state) => state.setThemeColor);
  const fontScale = useAppStore((state) => state.fontScale);
  const setFontScale = useAppStore((state) => state.setFontScale);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="default"
          size="icon"
          aria-label={t("app.appearance.openSettings")}
          className="fixed right-3 top-1/2 z-40 size-11 -translate-y-1/2 rounded-full shadow-lg"
        >
          <Palette />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="left" align="center" className="w-64">
        <PopoverTitle>{t("app.appearance.title")}</PopoverTitle>

        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-muted-foreground">
            {t("app.appearance.colorLabel")}
          </Label>
          <RadioGroup
            value={themeColor}
            onValueChange={(value) => setThemeColor(value as ThemeColor)}
            className="flex flex-row flex-wrap gap-2.5"
          >
            {THEME_COLORS.map((color) => (
              <Label
                key={color}
                htmlFor={`theme-color-${color}`}
                title={t(`app.appearance.colors.${color}`)}
                // scope-preview this option's own --primary via the same [data-theme-color]
                // selector the app uses globally, so the swatch can never drift from the
                // real preset (no separate hex map to keep in sync) - explicit even for
                // emerald so the swatch doesn't just inherit whatever theme is active
                data-theme-color={color}
                className="relative flex size-8 cursor-pointer items-center justify-center rounded-full bg-primary ring-1 ring-foreground/10 ring-offset-2 ring-offset-popover transition-shadow has-data-[state=checked]:ring-2 has-data-[state=checked]:ring-foreground/60"
              >
                <RadioGroupItem
                  id={`theme-color-${color}`}
                  value={color}
                  className="sr-only"
                />
                <span className="sr-only">{t(`app.appearance.colors.${color}`)}</span>
              </Label>
            ))}
          </RadioGroup>
        </div>

        <Separator />

        <div className="flex flex-col gap-2">
          <Label className="text-xs font-semibold text-muted-foreground">
            {t("app.appearance.fontSizeLabel")}
          </Label>
          <ToggleGroup
            type="single"
            variant="outline"
            value={fontScale}
            onValueChange={(value) => {
              if (value) setFontScale(value as FontScale);
            }}
            className="w-full"
          >
            {FONT_SCALES.map((scale) => (
              <ToggleGroupItem key={scale} value={scale} className="flex-1 text-xs font-bold">
                {t(`app.appearance.fontSizes.${scale}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </PopoverContent>
    </Popover>
  );
}
