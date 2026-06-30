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
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-emerald-950/10">
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
        <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-0.5 shadow-sm shadow-emerald-950/5 dark:border-border dark:bg-muted/40">
          <LanguageSwitch
            size="icon"
            variant="ghost"
            showShort={false}
            className="h-11 min-w-11 rounded-xl border border-transparent bg-background/85 px-2 shadow-sm shadow-emerald-950/5 hover:border-primary/20 hover:bg-primary/10 dark:bg-background/70"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("app.theme")}
            onClick={onToggleTheme}
            className="h-11 w-11 rounded-xl border border-transparent bg-background/85 text-muted-foreground shadow-sm shadow-emerald-950/5 hover:border-primary/20 hover:bg-primary/10 hover:text-primary dark:bg-background/70"
          >
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("pos.basket")}
            onClick={onOpenCart}
            disabled={!canOpenCart}
            className="relative h-11 w-11 rounded-xl border border-transparent bg-background/85 text-muted-foreground shadow-sm shadow-emerald-950/5 hover:border-primary/20 hover:bg-primary/10 hover:text-primary disabled:bg-background/60 dark:bg-background/70"
          >
            <ShoppingBag className="size-4" />
            {cartQty > 0 ? (
              <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full border border-background bg-primary px-1 text-[10px] font-black leading-4 text-primary-foreground shadow-sm">
                {cartQty}
              </span>
            ) : null}
          </Button>
        </div>
      </div>
    </header>
  );
}
