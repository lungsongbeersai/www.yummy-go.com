"use client";

import { useTranslation } from "react-i18next";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, Store, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { QRScanResponse } from "@/services/public-pos";
import { PublicHeaderPreferences } from "./public-header-preferences";

const HEADER_BUTTON_CLASS =
  "size-11 rounded-xl border border-yg-on-accent/25 bg-yg-on-accent text-yg-accent-strong shadow-sm transition-[background-color,color] outline-none hover:bg-yg-on-accent/90 hover:text-yg-accent-strong focus-visible:ring-2 focus-visible:ring-yg-on-accent focus-visible:ring-offset-2 focus-visible:ring-offset-yg-accent motion-reduce:transition-none sm:size-12";

export function PublicHeader({
  table,
  canSearch,
  onSearch,
  onAbout,
}: {
  table: QRScanResponse | null;
  canSearch: boolean;
  onSearch: () => void;
  onAbout: () => void;
}) {
  const { t } = useTranslation();

  return (
    <header className="yg-header-banner sticky top-0 z-30 -mx-(--yg-gutter) flex h-(--yg-header-height) shrink-0 items-center justify-between gap-3 border-b border-yg-on-accent/15 px-(--yg-gutter) py-2 shadow-sm sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
        <Avatar
          key={table?.store_logo}
          className="size-11 shrink-0 rounded-xl border border-yg-on-accent/30 bg-yg-on-accent after:rounded-xl sm:size-12"
        >
          <AvatarImage
            src={table?.store_logo || undefined}
            alt={table?.branch_name || t("pos.publicMenu")}
            className="rounded-xl object-contain p-1"
          />
          <AvatarFallback className="rounded-xl bg-yg-on-accent text-yg-accent-strong">
            <Store className="size-6" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p
            title={table?.branch_name || undefined}
            className="lao-tone-text truncate font-yg-sans text-base font-semibold leading-6 text-yg-on-accent sm:text-lg sm:leading-7"
          >
            {table?.branch_name || t("pos.publicMenu")}
          </p>
          <div className="flex min-w-0 items-center">
            {/* ชื่อโต๊ะมาจาก API และอาจเป็นลาว จึงต้องใช้ stack ที่มี Lao glyph โดยตรง
                ไม่ปล่อยให้ Latin-only display stack ตกไป DokChampa บน Windows */}
            <span className="lao-tone-text inline-flex max-w-full items-center gap-1.5 rounded-lg bg-yg-on-accent px-2 py-0.5 font-yg-sans text-xs font-semibold leading-5 text-yg-accent-strong">
              <UtensilsCrossed aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">
              {table?.view_only
                ? t("pos.foodMenu")
                : table?.table_name ?? t("pos.publicMenu")}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("pos.searchMenu")}
          onClick={onSearch}
          disabled={!canSearch}
          className={`${HEADER_BUTTON_CLASS} relative disabled:opacity-55`}
        >
          <Search className="size-5" aria-hidden="true" />
        </Button>

        <PublicHeaderPreferences className={HEADER_BUTTON_CLASS} onAbout={onAbout} />
      </div>
    </header>
  );
}
