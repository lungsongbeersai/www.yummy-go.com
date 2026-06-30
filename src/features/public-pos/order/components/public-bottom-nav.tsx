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
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4">
      <div className="pointer-events-auto mx-auto max-w-5xl rounded-3xl border border-emerald-100 bg-background/95 p-1.5 shadow-[0_-8px_28px_rgba(15,23,42,0.10)] backdrop-blur-xl dark:border-border dark:bg-background/95">
        <div className="grid h-16 grid-cols-4 gap-1">
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
        "relative h-full w-full min-w-0 flex-col gap-1 rounded-2xl px-1 text-[11px] font-bold leading-none transition active:scale-[0.98]",
        active
          ? "bg-primary/10 text-primary shadow-sm shadow-emerald-950/5 hover:bg-primary/15"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        disabled ? "opacity-45 hover:bg-transparent hover:text-muted-foreground" : "",
      )}
      aria-label={accessibleLabel}
      disabled={disabled}
      ref={buttonRef}
      title={buttonTitle}
      onClick={onClick}
    >
      <span
        className={cn(
          "relative grid size-8 place-items-center rounded-full text-current transition",
          active
            ? "bg-primary text-primary-foreground shadow-sm shadow-emerald-950/15"
            : "bg-muted/70",
          disabled ? "bg-muted/50" : "",
        )}
      >
        <span className="[&_svg]:size-[18px] [&_svg]:stroke-[2.1]">
          {icon}
        </span>
        {badge && badge > 0 ? (
          <Badge className="absolute -right-2 -top-1 h-4 min-w-4 justify-center rounded-full border border-background bg-primary px-1 py-0 text-[9px] font-black leading-none text-primary-foreground shadow-sm">
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
