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
import { cn } from "@/lib/utils";
import { useAppStore, type FontScale, type ThemeColor } from "@/stores/app-store";

const THEME_COLORS: readonly ThemeColor[] = ["green", "blue", "amber", "rose", "violet"];

const THEME_COLOR_SWATCH_CLASS: Record<ThemeColor, string> = {
  green: "bg-[oklch(0.508_0.118_165.612)]",
  blue: "bg-[oklch(0.508_0.118_250)]",
  amber: "bg-[oklch(0.508_0.118_70)]",
  rose: "bg-[oklch(0.508_0.118_25)]",
  violet: "bg-[oklch(0.508_0.118_305)]",
};

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
                className={cn(
                  "relative flex size-8 cursor-pointer items-center justify-center rounded-full ring-1 ring-foreground/10 ring-offset-2 ring-offset-popover transition-shadow has-data-[state=checked]:ring-2 has-data-[state=checked]:ring-foreground/60",
                  THEME_COLOR_SWATCH_CLASS[color],
                )}
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
