"use client";

import { useTranslation } from "react-i18next";
import { CheckCircle2, ChefHat, Moon, ShoppingBag, Sun } from "lucide-react";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { QRScanResponse } from "@/services/public-pos";

export function PublicHeader({
  table,
  statusLabel,
  theme,
  cartQty,
  canOpenCart,
  onToggleTheme,
  onOpenCart,
}: {
  table: QRScanResponse | null;
  statusLabel: string;
  theme: string;
  cartQty: number;
  canOpenCart: boolean;
  onToggleTheme: () => void;
  onOpenCart: () => void;
}) {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/95 shadow-sm shadow-emerald-950/5 backdrop-blur-xl dark:border-border dark:bg-background/95">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-2 px-2.5 sm:h-14 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm shadow-emerald-950/10">
            <ChefHat className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase tracking-normal text-primary">
              Yummy Go
            </p>
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-sm font-black leading-4">
                {table?.table_name ?? t("pos.publicMenu")}
              </p>
              {table ? (
                <Badge className="h-5 max-w-24 shrink-0 gap-1 border-emerald-100 bg-emerald-50 px-1.5 py-0 text-[10px] leading-none text-emerald-700 dark:border-border dark:bg-primary/10 dark:text-primary">
                  <CheckCircle2 className="size-3" />
                  <span className="truncate">{statusLabel}</span>
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <LanguageSwitch size="iconSm" variant="outline" showShort={false} />
          <Button
            type="button"
            variant="outline"
            size="iconSm"
            aria-label={t("app.theme")}
            onClick={onToggleTheme}
          >
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="iconSm"
            aria-label={t("pos.basket")}
            onClick={onOpenCart}
            disabled={!canOpenCart}
            className="relative"
          >
            <ShoppingBag className="size-4" />
            {cartQty > 0 ? (
              <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-black leading-4 text-primary-foreground">
                {cartQty}
              </span>
            ) : null}
          </Button>
        </div>
      </div>
    </header>
  );
}
