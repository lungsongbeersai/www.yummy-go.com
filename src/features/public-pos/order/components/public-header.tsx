"use client";

import { useTranslation } from "react-i18next";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Search, Store } from "lucide-react";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { Button } from "@/components/ui/button";
import type { QRScanResponse } from "@/services/public-pos";

const HEADER_BUTTON_CLASS =
  "size-10 rounded-lg border border-yg-on-accent/25 bg-yg-on-accent text-yg-accent-strong transition-[background-color,color] outline-none hover:bg-yg-on-accent/90 hover:text-yg-accent-strong focus-visible:ring-2 focus-visible:ring-yg-on-accent focus-visible:ring-offset-2 focus-visible:ring-offset-yg-accent motion-reduce:transition-none";

export function PublicHeader({
  table,
  canSearch,
  onSearch,
}: {
  table: QRScanResponse | null;
  canSearch: boolean;
  onSearch: () => void;
}) {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 -mx-(--yg-gutter) flex h-16 shrink-0 items-center justify-between gap-3 border-b border-yg-on-accent/15 bg-yg-accent-strong px-(--yg-gutter) py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar
          key={table?.store_logo}
          className="size-10 rounded-lg border border-yg-on-accent/30 bg-yg-on-accent after:rounded-lg"
        >
          <AvatarImage
            src={table?.store_logo || undefined}
            alt={table?.branch_name || t("pos.publicMenu")}
            className="rounded-lg object-contain p-1"
          />
          <AvatarFallback className="rounded-lg bg-yg-on-accent text-yg-accent-strong">
            <Store className="size-5" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0">
          <p
            title={table?.branch_name || undefined}
            className="lao-tone-text truncate font-yg-sans text-sm font-semibold leading-snug text-yg-on-accent"
          >
            {table?.branch_name || t("pos.publicMenu")}
          </p>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            {/* ชื่อโต๊ะมาจาก API และอาจเป็นลาว จึงต้องใช้ stack ที่มี Lao glyph โดยตรง
                ไม่ปล่อยให้ Latin-only display stack ตกไป DokChampa บน Windows */}
            <span className="lao-tone-text max-w-40 truncate font-yg-sans text-sm font-normal leading-snug text-yg-on-accent">
              {table?.view_only
                ? t("pos.foodMenu")
                : table?.table_name ?? t("pos.publicMenu")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("pos.searchMenu")}
          onClick={onSearch}
          disabled={!canSearch}
          className={`${HEADER_BUTTON_CLASS} relative disabled:opacity-55`}
        >
          <Search className="size-[18px]" />
        </Button>

        <LanguageSwitch
          compact
          size="icon"
          variant="ghost"
          className={HEADER_BUTTON_CLASS}
        />
      </div>
    </header>
  );
}
