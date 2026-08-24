"use client";

import type { ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Share2, ShoppingBag, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function BottomNav({
  cartQty,
  cartTargetRef,
  onMenu,
  onCart,
  onShare,
}: {
  cartQty: number;
  cartTargetRef: RefObject<HTMLButtonElement | null>;
  onMenu: () => void;
  onCart: () => void;
  onShare: () => void;
}) {
  const { t } = useTranslation();
  const staffComingSoon = t("pos.comingSoon");

  return (
    <nav className="fixed bottom-[max(clamp(14px,3vw,22px),env(safe-area-inset-bottom))] left-1/2 z-50 grid w-[min(92vw,420px)] -translate-x-1/2 grid-cols-4 gap-1 rounded-[26px] border border-yg-line bg-yg-bg2/85 p-2 shadow-[0_20px_50px_-18px_rgb(0_0_0/0.45)] backdrop-blur-xl backdrop-saturate-150 dark:shadow-[0_20px_50px_-18px_rgb(0_0_0/0.85)]">
      <NavButton
        icon={<Utensils />}
        label={t("pos.navMenu")}
        ariaLabel={t("pos.menu")}
        onClick={onMenu}
        active
      />
      <NavButton
        icon={<ShoppingBag />}
        label={t("pos.navCart")}
        ariaLabel={t("pos.basket")}
        onClick={onCart}
        badge={cartQty}
        buttonRef={cartTargetRef}
      />
      <NavButton
        icon={<Share2 />}
        label={t("pos.navQr")}
        ariaLabel={t("pos.qrCode")}
        onClick={onShare}
      />
      <NavButton
        icon={<Bell />}
        label={t("pos.navStaff")}
        ariaLabel={t("pos.callWaiter")}
        description={staffComingSoon}
        disabled
      />
    </nav>
  );
}

function NavButton({
  icon,
  label,
  ariaLabel,
  active,
  badge,
  buttonRef,
  description,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  active?: boolean;
  badge?: number;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  description?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const accessibleLabel = description ? `${ariaLabel} - ${description}` : ariaLabel;
  const badgeLabel = typeof badge === "number" && badge > 99 ? "99+" : String(badge ?? "");

  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      ref={buttonRef}
      className={cn(
        "relative h-13 w-full flex-col gap-1 rounded-2xl px-1 text-[10.5px] font-bold leading-none motion-reduce:transition-none",
        active ? "text-yg-accent" : "text-yg-muted",
        // ดีไซน์ใช้ opacity .5 ของ Button เริ่มต้น ซึ่งรวมกับสี muted แล้วอ่านไม่ออก ยกเป็น .55
        disabled
          ? "opacity-55 hover:bg-transparent hover:text-yg-muted"
          : "hover:bg-yg-panel-hover hover:text-yg-ink",
      )}
      aria-label={accessibleLabel}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="relative [&_svg]:size-4.5 [&_svg]:stroke-2" aria-hidden="true">
        {icon}
        {badge && badge > 0 ? (
          <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full border-2 border-yg-bg2 bg-yg-accent px-1 text-[9px] font-extrabold leading-none text-yg-on-accent">
            {badgeLabel}
          </span>
        ) : null}
      </span>
      <span className="lao-tone-text block max-w-full truncate text-center">
        {label}
      </span>
    </Button>
  );

  if (!description) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {description}
      </TooltipContent>
    </Tooltip>
  );
}
