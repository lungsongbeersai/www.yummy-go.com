"use client";

import type { ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Bell, CircleHelp, ScanLine, Share2, ShoppingBag, Utensils } from "lucide-react";
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
  onHelp,
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
  onHelp: () => void;
  onScan?: () => void;
  scanTargetRef?: RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useTranslation();
  const staffComingSoon = t("pos.comingSoon");
  const cartLabel = `${t(needsConfirmation ? "pos.cartNeedsConfirm" : "pos.navCart")} (${cartQty})`;

  return (
    // พื้นทึบ bg-yg-bg — เดิม bg-yg-panel ซึ่งในโหมดมืด (Nightfall) โปร่ง 4.5% รูปเมนูที่เลื่อนผ่านใต้แถบโผล่ทะลุ
    // จนอ่านป้ายไม่ออก (โหมดสว่าง panel = ขาวทึบอยู่แล้ว จึงไม่เคยเห็นปัญหา)
    <nav
      aria-label={t("pos.publicMenu")}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 grid gap-0.5 border-t border-yg-divider bg-yg-bg px-2 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] shadow-lg sm:inset-x-auto sm:bottom-3 sm:left-1/2 sm:w-120 sm:-translate-x-1/2 sm:rounded-2xl sm:border sm:p-1.5",
        hideCart ? "grid-cols-4" : "grid-cols-5"
      )}
    >
      <NavButton
        icon={<Utensils className="size-5" />}
        label={t("pos.navMenu")}
        ariaLabel={t("pos.menu")}
        onClick={onMenu}
        active
      />
      {hideCart ? (
        <NavButton
          icon={<ScanLine className="size-5" />}
          label={t("pos.scanToOrderShort")}
          ariaLabel={t("pos.viewOnlyOrderBannerCta")}
          onClick={onScan}
          buttonRef={scanTargetRef}
        />
      ) : (
        <NavButton
          icon={<ShoppingBag className="size-5" />}
          label={t(needsConfirmation ? "pos.cartNeedsConfirm" : "pos.navCart")}
          ariaLabel={`${cartLabel} · ${t("pos.basket")}`}
          badge={cartQty}
          onClick={onCart}
          attention={needsConfirmation}
          buttonRef={cartTargetRef}
        />
      )}
      <NavButton
        icon={<Share2 className="size-5" />}
        label={t("pos.navQr")}
        ariaLabel={t("pos.qrCode")}
        onClick={onShare}
      />
      {!hideCart ? (
        <NavButton
          icon={<Bell className="size-5" />}
          label={t("publicHelp.staffShort")}
          ariaLabel={t("pos.callWaiter")}
          description={onCallStaff ? undefined : staffComingSoon}
          disabled={!onCallStaff}
          onClick={onCallStaff}
        />
      ) : null}
      <NavButton icon={<CircleHelp className="size-5" />} label={t("publicHelp.nav")} ariaLabel={t("publicHelp.title")} onClick={onHelp} />
    </nav>
  );
}

function NavButton({
  icon,
  label,
  ariaLabel,
  active,
  attention = false,
  badge = 0,
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
  badge?: number;
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
        "relative h-18 w-full flex-col gap-1 rounded-xl px-1 py-1 text-xs font-semibold leading-4 duration-150 ease-out motion-safe:active:scale-95 motion-safe:active:duration-75 motion-reduce:transition-none",
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
      onClick={(event) => {
        event.currentTarget.focus({ preventScroll: true });
        onClick?.();
      }}
    >
      <span
        className="relative shrink-0 [&_svg]:size-5 [&_svg]:stroke-2"
        aria-hidden="true"
      >
        {icon}
        {badge > 0 ? (
          <span className={cn("absolute -right-3 -top-1.5 min-w-4.5 rounded-full px-1 text-center text-2xs font-bold leading-4 tabular-nums", attention ? "bg-yg-on-accent text-yg-accent-strong" : "bg-yg-accent text-yg-on-accent")}>
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </span>
      <span className="lao-tone-text line-clamp-2 max-w-full whitespace-normal text-center leading-4">
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
