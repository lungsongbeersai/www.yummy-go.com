"use client";

import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Check, Moon, Palette, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { DEFAULT_PUBLIC_POS_HERO_VISIBLE, PUBLIC_POS_ACCENTS } from "../constants";
import {
  readPublicPosHeroVisible,
  subscribePublicPosHeroVisible,
  writePublicPosHeroVisible,
} from "../public-pos-hero-visibility";
import type { PublicPosAccent } from "../types";

// ตัวอย่างสีในปุ่มเลือกต้องเป็นค่าคงที่ อ่านจาก --yg-accent ไม่ได้
// เพราะทุกปุ่มอยู่ในสโคปเดียวกันจึงได้สีเดียวกันหมด ค่าตรงกับ nightfall.css
const ACCENT_SWATCH: Record<PublicPosAccent, { light: string; dark: string }> = {
  emerald: { light: "#127c59", dark: "#54d08c" },
  gold: { light: "#8f6318", dark: "#e6b872" },
  rose: { light: "#b3455f", dark: "#e890a6" },
};

export function PublicTweaksPopover({
  accent,
  theme,
  onAccentChange,
  onToggleTheme,
  triggerClassName,
}: {
  accent: PublicPosAccent;
  theme: string;
  onAccentChange: (accent: PublicPosAccent) => void;
  onToggleTheme: () => void;
  triggerClassName?: string;
}) {
  const { t } = useTranslation();
  const isDark = theme === "dark";
  // server render/hydration ใช้ค่าปิดเสมอ ฝั่ง client sync จาก localStorage โดยไม่มี effect
  // แพตเทิร์นเดียวกับ productLayoutMode / accent
  const heroVisible = useSyncExternalStore(
    subscribePublicPosHeroVisible,
    readPublicPosHeroVisible,
    (): boolean => DEFAULT_PUBLIC_POS_HERO_VISIBLE,
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("pos.tweaksTitle")}
          className={triggerClassName}
        >
          <Palette className="size-4.5" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-64 rounded-[20px] border-yg-line bg-yg-bg2 p-3.5 font-yg-sans text-yg-ink shadow-[0_24px_60px_-20px_rgb(0_0_0/0.35)] dark:shadow-[0_24px_60px_-20px_rgb(0_0_0/0.8)]"
      >
        <p className="text-2xs font-extrabold uppercase tracking-[0.2em] text-yg-accent">
          {t("pos.tweaksTitle")}
        </p>

        <div className="mt-3 flex flex-col gap-1.5">
          <span className="text-xs font-bold text-yg-faint">
            {t("app.theme")}
          </span>
          <div
            className="grid grid-cols-2 gap-1 rounded-2xl border border-yg-line bg-yg-panel2 p-1"
            role="group"
            aria-label={t("app.theme")}
          >
            <ThemeOption
              active={!isDark}
              icon={<Sun className="size-4" />}
              label={t("pos.themeLight")}
              onSelect={() => {
                if (isDark) onToggleTheme();
              }}
            />
            <ThemeOption
              active={isDark}
              icon={<Moon className="size-4" />}
              label={t("pos.themeDark")}
              onSelect={() => {
                if (!isDark) onToggleTheme();
              }}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-1.5">
          <span className="text-xs font-bold text-yg-faint">
            {t("pos.tweaksAccent")}
          </span>
          <div
            className="grid grid-cols-3 gap-1.5"
            role="group"
            aria-label={t("pos.tweaksAccent")}
          >
            {PUBLIC_POS_ACCENTS.map((option) => (
              <AccentOption
                key={option}
                option={option}
                active={option === accent}
                isDark={isDark}
                label={t(`pos.accent_${option}`)}
                onSelect={() => onAccentChange(option)}
              />
            ))}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-yg-line bg-yg-panel2 px-3 py-2.5">
          <span className="min-w-0 flex-1 text-xs font-bold text-yg-ink">
            {t("pos.tweaksHeroVisible")}
          </span>
          <Switch
            checked={heroVisible}
            onCheckedChange={writePublicPosHeroVisible}
            className="border-yg-line data-checked:bg-yg-accent data-unchecked:bg-yg-panel focus-visible:border-yg-accent focus-visible:ring-yg-accent/30"
            thumbClassName="bg-white dark:data-checked:bg-yg-bg2 dark:data-unchecked:bg-yg-ink"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ThemeOption({
  active,
  icon,
  label,
  onSelect,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "flex h-11 items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-yg-accent focus-visible:ring-offset-2 focus-visible:ring-offset-yg-bg2 motion-reduce:transition-none",
        active
          ? "bg-yg-accent text-yg-on-accent"
          : "text-yg-muted hover:bg-yg-panel-hover hover:text-yg-ink",
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function AccentOption({
  option,
  active,
  isDark,
  label,
  onSelect,
}: {
  option: PublicPosAccent;
  active: boolean;
  isDark: boolean;
  label: string;
  onSelect: () => void;
}) {
  const swatch = ACCENT_SWATCH[option][isDark ? "dark" : "light"];

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      onClick={onSelect}
      className={cn(
        "flex h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-yg-accent focus-visible:ring-offset-2 focus-visible:ring-offset-yg-bg2 motion-reduce:transition-none",
        active
          ? "border-yg-accent bg-yg-accent-soft"
          : "border-yg-line bg-yg-panel2 hover:bg-yg-panel-hover",
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-6 place-items-center rounded-full"
        style={{ backgroundColor: swatch }}
      >
        {/* โหมดมืด swatch ทั้งสามเป็นสีอ่อน โหมดสว่างเป็นสีเข้ม
            เครื่องหมายถูกจึงสลับขั้วตามโหมดเพื่อให้เห็นชัดทั้งคู่ */}
        {active ? (
          <Check
            className="size-3.5"
            style={{ color: isDark ? "#141110" : "#ffffff" }}
          />
        ) : null}
      </span>
      <span
        className={cn(
          "max-w-full truncate px-1 text-2xs font-bold",
          active ? "text-yg-accent-strong" : "text-yg-muted",
        )}
      >
        {label}
      </span>
    </button>
  );
}
