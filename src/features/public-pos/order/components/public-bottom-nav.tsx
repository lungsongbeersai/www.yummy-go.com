"use client";

import type { ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Share2, ShoppingBag, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/95 shadow-[0_-1px_10px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:bg-background/95">
      <div className="mx-auto grid h-[calc(3.5rem+env(safe-area-inset-bottom))] max-w-5xl grid-cols-4 items-start px-2 pb-[env(safe-area-inset-bottom)] pt-1">
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
        "relative h-12 w-full min-w-0 flex-col gap-1 rounded-xl px-1 text-[11px] font-semibold leading-none transition hover:bg-muted/50 active:scale-[0.98]",
        active
          ? "bg-transparent text-primary hover:bg-primary/5"
          : "text-muted-foreground hover:text-foreground",
      )}
      aria-label={accessibleLabel}
      disabled={disabled}
      ref={buttonRef}
      title={buttonTitle}
      onClick={onClick}
    >
      {active ? (
        <span
          className="absolute top-0 h-0.5 w-7 rounded-full bg-primary"
          aria-hidden="true"
        />
      ) : null}
      <span className="relative grid h-5 place-items-center text-current">
        <span className="[&_svg]:size-4.5 [&_svg]:stroke-[2.05]">
          {icon}
        </span>
        {badge && badge > 0 ? (
          <Badge className="absolute -right-3 -top-1 h-3.5 min-w-3.5 justify-center rounded-full border border-background bg-primary px-1 py-0 text-[8px] font-black leading-none text-primary-foreground">
            {badgeLabel}
          </Badge>
        ) : null}
      </span>
      <span className="block max-w-full truncate text-center">{label}</span>
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
