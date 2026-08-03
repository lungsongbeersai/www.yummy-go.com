"use client";

import { useTranslation } from "react-i18next";
import { ShoppingBag } from "lucide-react";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QRScanResponse } from "@/services/public-pos";
import type { PublicPosAccent } from "../types";
import { PublicTweaksPopover } from "./public-tweaks-popover";

// ปุ่มในดีไซน์เป็น 38px แต่ยกเป็น 44px (h-11) ตามขนาดพื้นที่แตะขั้นต่ำที่โปรเจกต์ใช้อยู่
const HEADER_BUTTON_CLASS =
  "size-11 rounded-xl border border-transparent bg-transparent text-yg-muted transition-[background-color,color] outline-none hover:bg-yg-panel-hover hover:text-yg-ink focus-visible:ring-2 focus-visible:ring-yg-accent focus-visible:ring-offset-2 focus-visible:ring-offset-yg-bg motion-reduce:transition-none";

export function PublicHeader({
  table,
  statusLabel,
  theme,
  accent,
  cartQty,
  canOpenCart,
  onAccentChange,
  onToggleTheme,
  onOpenCart,
}: {
  table: QRScanResponse | null;
  statusLabel: string;
  theme: string;
  accent: PublicPosAccent;
  cartQty: number;
  canOpenCart: boolean;
  onAccentChange: (accent: PublicPosAccent) => void;
  onToggleTheme: () => void;
  onOpenCart: () => void;
}) {
  const { t } = useTranslation();

  return (
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-11 flex-none place-items-center rounded-2xl border border-yg-accent-line bg-linear-150 from-yg-panel-hover to-yg-panel font-yg-display text-[19px] font-bold tracking-wide text-yg-accent-strong shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]"
        >
          YG
        </span>

        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-yg-accent">
            Yummy Go
          </p>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            {/* ชื่อโต๊ะมาจาก API และอาจเป็นลาว จึงต้องใช้ stack ที่มี Lao glyph โดยตรง
                ไม่ปล่อยให้ Latin-only display stack ตกไป DokChampa บน Windows */}
            <span className="lao-tone-text truncate font-yg-serif text-[19px] font-semibold leading-none text-yg-ink">
              {table?.table_name ?? t("pos.publicMenu")}
            </span>
            {table ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-[10.5px] font-bold text-yg-muted">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-yg-accent shadow-[0_0_8px_var(--yg-accent)]"
                />
                <span className="max-w-24 truncate">{statusLabel}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-[18px] border border-yg-line bg-yg-panel p-1 backdrop-blur-md">
        <LanguageSwitch
          size="icon"
          variant="ghost"
          showShort={false}
          className={HEADER_BUTTON_CLASS}
        />

        <PublicTweaksPopover
          accent={accent}
          theme={theme}
          onAccentChange={onAccentChange}
          onToggleTheme={onToggleTheme}
          triggerClassName={HEADER_BUTTON_CLASS}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("pos.basket")}
          onClick={onOpenCart}
          disabled={!canOpenCart}
          className={cn(
            HEADER_BUTTON_CLASS,
            "relative disabled:opacity-55",
            cartQty > 0
              ? "bg-yg-accent-soft text-yg-accent-strong hover:bg-yg-accent-soft"
              : "",
          )}
        >
          <ShoppingBag className="size-[18px]" />
          {cartQty > 0 ? (
            <span className="absolute -right-1 -top-1 grid min-w-[17px] place-items-center rounded-full border-2 border-yg-bg bg-yg-accent px-1 text-[10px] font-extrabold leading-[13px] text-yg-on-accent">
              {cartQty > 99 ? "99+" : cartQty}
            </span>
          ) : null}
        </Button>
      </div>
    </header>
  );
}
