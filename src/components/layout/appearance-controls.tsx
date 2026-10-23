"use client";

import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import {
  FONT_SCALES,
  LAO_FONTS,
  THEME_COLORS,
  useAppStore,
  type FontScale,
  type LaoFont,
  type ThemeColor,
} from "@/stores/app-store";

// Each option previews itself in its own face; literal class names so Tailwind emits them
// (--font-lao-* in globals.css @theme).
const laoFontPreviewClassNames: Record<LaoFont, string> = {
  "noto-sans": "font-lao-noto-sans",
  "noto-serif": "font-lao-noto-serif",
  phetsarath: "font-lao-phetsarath",
  saysettha: "font-lao-saysettha",
};

// เว็บใช้ใน Popover แคบ ๆ (swatch เล็กพอ), Capacitor ต้องได้ touch target 48px ตาม Global Constraints
export type AppearanceControlsSize = "compact" | "touch";

// ตัวควบคุมสีธีม/ขนาดฟอนต์ชุดเดียวใช้ทั้ง DisplaySettingsMenu ใน header (เว็บ) และ More sheet (Capacitor)
// ต่างกันแค่ขนาดปุ่ม — chrome รอบนอก (ปุ่มลากได้/หัวข้อ section) ยังเป็นของแต่ละฝั่ง
export function AppearanceControls({
  idPrefix = "theme-color",
  size = "compact",
}: {
  idPrefix?: string;
  size?: AppearanceControlsSize;
}) {
  const { t } = useTranslation();
  const themeColor = useAppStore((state) => state.themeColor);
  const setThemeColor = useAppStore((state) => state.setThemeColor);
  const fontScale = useAppStore((state) => state.fontScale);
  const setFontScale = useAppStore((state) => state.setFontScale);
  const decorBackground = useAppStore((state) => state.decorBackground);
  const laoFont = useAppStore((state) => state.laoFont);
  const setLaoFont = useAppStore((state) => state.setLaoFont);
  const setDecorBackground = useAppStore((state) => state.setDecorBackground);
  const touch = size === "touch";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold text-muted-foreground">
          {t("app.appearance.colorLabel")}
        </Label>
        <RadioGroup
          value={themeColor}
          onValueChange={(value) => setThemeColor(value as ThemeColor)}
          className={cn(
            "flex flex-row flex-wrap",
            touch ? "gap-3" : "gap-2.5",
          )}
        >
          {THEME_COLORS.map((color) => (
            <Label
              key={color}
              htmlFor={`${idPrefix}-${color}`}
              title={t(`app.appearance.colors.${color}`)}
              // scope-preview this option's own --primary via the same [data-theme-color]
              // selector the app uses globally, so the swatch can never drift from the
              // real preset (no separate hex map to keep in sync) - explicit even for
              // emerald so the swatch doesn't just inherit whatever theme is active
              data-theme-color={color}
              className={cn(
                "relative flex cursor-pointer items-center justify-center rounded-full bg-primary ring-1 ring-foreground/10 ring-offset-2 ring-offset-popover transition-shadow has-data-[state=checked]:ring-2 has-data-[state=checked]:ring-foreground/60",
                touch ? "size-12" : "size-8",
              )}
            >
              <RadioGroupItem
                id={`${idPrefix}-${color}`}
                value={color}
                className="sr-only"
              />
              <span className="sr-only">
                {t(`app.appearance.colors.${color}`)}
              </span>
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
            // whitespace-normal + text-2xs ให้คำเต็ม (Smallest/Largest) ตัดขึ้นบรรทัดสองได้
            // แทนที่จะโดน whitespace-nowrap ของ Toggle ฐานตัดล้นออกนอกปุ่ม — 5 ปุ่มคำเต็มในแถว
            // เดียวบนจอมือถือแคบ ต้องยอมให้ 2 บรรทัดแทนบีบเป็นตัวย่อ/ตัวเลข
            <ToggleGroupItem
              key={scale}
              value={scale}
              className={cn(
                "h-auto min-h-8 flex-1 whitespace-normal px-1 py-1 text-center text-2xs leading-tight font-bold",
                touch && "min-h-12",
              )}
            >
              {t(`app.appearance.fontSizes.${scale}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold text-muted-foreground">
          {t("app.appearance.laoFontLabel")}
        </Label>
        <RadioGroup
          value={laoFont}
          onValueChange={(value) => setLaoFont(value as LaoFont)}
          className="grid grid-cols-2 gap-2"
        >
          {LAO_FONTS.map((font) => (
            <Label
              key={font}
              htmlFor={`${idPrefix}-lao-font-${font}`}
              className={cn(
                "flex cursor-pointer flex-col items-start gap-1 rounded-lg border border-border p-2 transition-colors hover:bg-muted has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/10",
                touch && "min-h-16 p-3",
              )}
            >
              <RadioGroupItem id={`${idPrefix}-lao-font-${font}`} value={font} className="sr-only" />
              <span className={cn("text-base leading-snug text-foreground", laoFontPreviewClassNames[font])}>ສະບາຍດີ</span>
              <span className="text-2xs font-medium text-muted-foreground">{t(`app.appearance.laoFonts.${font}`)}</span>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <Separator />

      {/* The floral artwork behind the top bar and the sidebar (globals.css, data-decor-background). */}
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`${idPrefix}-decor-background`} className="flex flex-col items-start gap-0.5">
          <span className="text-xs font-semibold text-muted-foreground">{t("app.appearance.backgroundLabel")}</span>
          <span className="text-2xs font-normal text-muted-foreground">{t("app.appearance.backgroundDescription")}</span>
        </Label>
        <Switch
          id={`${idPrefix}-decor-background`}
          checked={decorBackground}
          onCheckedChange={setDecorBackground}
        />
      </div>
    </div>
  );
}
