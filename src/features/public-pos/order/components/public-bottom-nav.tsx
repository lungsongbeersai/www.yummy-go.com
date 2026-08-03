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
    <nav className="fixed bottom-[max(clamp(14px,3vw,22px),env(safe-area-inset-bottom))] left-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 rounded-[26px] border border-yg-line bg-yg-bg2/85 p-2 shadow-[0_20px_50px_-18px_rgb(0_0_0/0.45)] backdrop-blur-xl backdrop-saturate-150 dark:shadow-[0_20px_50px_-18px_rgb(0_0_0/0.85)]">
      <div className="grid h-13.5 grid-cols-4">
        <BottomNavButton
          icon={<Utensils />}
          label={t("pos.navMenu")}
          ariaLabel={t("pos.menu")}
          onClick={onMenu}
          active
        />
        <BottomNavButton
          icon={<ShoppingBag />}
          label={t("pos.navCart")}
          ariaLabel={t("pos.basket")}
          onClick={onCart}
          badge={cartQty}
          buttonRef={cartTargetRef}
        />
        <BottomNavButton
          icon={<Share2 />}
          label={t("pos.navQr")}
          ariaLabel={t("pos.qrCode")}
          onClick={onShare}
        />
        <BottomNavButton
          icon={<Bell />}
          label={t("pos.navStaff")}
          ariaLabel={t("pos.callWaiter")}
          description={staffComingSoon}
          disabled
        />
      </div>
    </nav>
  );
}

function BottomNavButton({
  icon,
  label,
  ariaLabel,
  badge,
  active,
  buttonRef,
  description,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  badge?: number;
  active?: boolean;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  description?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const badgeLabel =
    typeof badge === "number" && badge > 99 ? "99+" : String(badge ?? "");
  const accessibleLabel = description
    ? `${ariaLabel} - ${description}`
    : ariaLabel;
  const buttonTitle = description ? `${label} - ${description}` : ariaLabel;

  const button = (
    <Button
      type="button"
      variant="ghost"
      size="md"
      className={cn(
        "relative h-full w-full min-w-0 flex-col gap-1 rounded-[18px] px-1 py-0 text-[10.5px] font-bold leading-none transition-[background-color,color] hover:bg-yg-panel-hover motion-reduce:transition-none",
        active ? "text-yg-accent-strong" : "text-yg-muted",
        // ดีไซน์ใช้ opacity .4 ซึ่งรวมกับสี muted แล้วอ่านไม่ออก ยกเป็น .55
        disabled
          ? "opacity-55 hover:bg-transparent hover:text-yg-muted"
          : "hover:text-yg-ink",
      )}
      aria-label={accessibleLabel}
      disabled={disabled}
      ref={buttonRef}
      title={buttonTitle}
      onClick={onClick}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute top-0 h-0.75 w-6.5 rounded-full bg-yg-accent shadow-[0_0_10px_var(--yg-accent)]"
        />
      ) : null}

      <span
        className={cn(
          "relative grid size-8 place-items-center rounded-xl transition-colors motion-reduce:transition-none",
          active ? "bg-yg-accent-soft text-yg-accent-strong" : "text-current",
        )}
      >
        <span
          className="[&_svg]:size-4.5 [&_svg]:stroke-2"
          aria-hidden="true"
        >
          {icon}
        </span>
        {badge && badge > 0 ? (
          <span className="absolute -right-2.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full border-2 border-yg-bg2 bg-yg-accent px-1 text-[9px] font-extrabold leading-none text-yg-on-accent">
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
      <TooltipTrigger asChild>
        <span className="block min-w-0" title={buttonTitle}>
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        {description}
      </TooltipContent>
    </Tooltip>
  );
}
