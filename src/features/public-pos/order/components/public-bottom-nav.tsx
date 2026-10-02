"use client";

import type { ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Bell, ScanLine, Share2, ShoppingBag, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function BottomNav({
  needsConfirmation = false,
  cartQty,
  cartTargetRef,
  hideCart = false,
  onMenu,
  onCart,
  onShare,
  onCallStaff,
  onScan,
  scanTargetRef,
}: {
  needsConfirmation?: boolean;
  cartQty: number;
  cartTargetRef: RefObject<HTMLButtonElement | null>;
  // true เฉพาะ QR เมนูอย่างเดียว (view_only) — ไม่มีตะกร้าให้เปิดจริง
  hideCart?: boolean;
  onMenu: () => void;
  onCart: () => void;
  onShare: () => void;
  onCallStaff?: () => void;
  onScan?: () => void;
  scanTargetRef?: RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useTranslation();
  const staffComingSoon = t("pos.comingSoon");

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 grid gap-1 border-t border-yg-divider bg-yg-panel px-3 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] shadow-none sm:inset-x-auto sm:bottom-2 sm:left-1/2 sm:w-105 sm:-translate-x-1/2 sm:rounded-lg sm:border sm:p-1",
        hideCart ? "grid-cols-3" : "grid-cols-4"
      )}
    >
      <NavButton
        icon={<Utensils />}
        label={t("pos.navMenu")}
        ariaLabel={t("pos.menu")}
        onClick={onMenu}
        active
      />
      {hideCart ? (
        <NavButton
          icon={<ScanLine />}
          label={t("pos.scanToOrderShort")}
          ariaLabel={t("pos.viewOnlyOrderBannerCta")}
          onClick={onScan}
          buttonRef={scanTargetRef}
        />
      ) : (
        <NavButton
          icon={<ShoppingBag />}
          label={
            needsConfirmation
              ? `${t("pos.cartNeedsConfirm")} (${cartQty})`
              : `${t("pos.navCart")} (${cartQty})`
          }
          ariaLabel={t("pos.basket")}
          onClick={onCart}
          attention={needsConfirmation}
          buttonRef={cartTargetRef}
        />
      )}
      <NavButton
        icon={<Share2 />}
        label={t("pos.navQr")}
        ariaLabel={t("pos.qrCode")}
        onClick={onShare}
      />
      {!hideCart ? (
        <NavButton
          icon={<Bell />}
          label={t("pos.navStaff")}
          ariaLabel={t("pos.callWaiter")}
          description={onCallStaff ? undefined : staffComingSoon}
          disabled={!onCallStaff}
          onClick={onCallStaff}
        />
      ) : null}
    </nav>
  );
}

function NavButton({
  icon,
  label,
  ariaLabel,
  active,
  attention = false,
  buttonRef,
  description,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  active?: boolean;
  attention?: boolean;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  description?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const accessibleLabel = description
    ? `${ariaLabel} - ${description}`
    : ariaLabel;

  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon-lg"
      ref={buttonRef}
      className={cn(
        "relative h-12 w-full flex-col gap-1 rounded-lg px-1 text-[10.5px] font-medium leading-none duration-150 ease-out active:scale-90 active:duration-75 motion-reduce:transition-none",
        attention
          ? "yg-cart-needs-confirm bg-yg-accent text-yg-on-accent"
          : active
          ? "bg-yg-accent-soft text-yg-accent-strong"
          : "text-yg-muted",
        // ดีไซน์ใช้ opacity .5 ของ Button เริ่มต้น ซึ่งรวมกับสี muted แล้วอ่านไม่ออก ยกเป็น .55
        // disabled ปิด pointer-events ไว้แล้วจาก Button พื้นฐาน :active จึงไม่มีวันติด
        disabled
          ? "opacity-55 hover:bg-transparent hover:text-yg-muted"
          : attention
          ? "hover:text-yg-on-accent"
          : "hover:bg-yg-panel-hover hover:text-yg-ink"
      )}
      aria-label={accessibleLabel}
      disabled={disabled}
      onClick={onClick}
    >
      <span
        className="relative [&_svg]:size-5 [&_svg]:stroke-2"
        aria-hidden="true"
      >
        {icon}
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
