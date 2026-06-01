"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Bell, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type NotificationItem,
  type NotificationTone,
  useNotificationStore
} from "@/stores/notification-store";

const TONE_DOT: Record<NotificationTone, string> = {
  info: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500"
};

function relativeTime(t: (key: string, options?: Record<string, unknown>) => string, ms: number) {
  const diff = Date.now() - ms;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return t("notifications.relative.justNow");
  if (minutes < 60) return t("notifications.relative.minutesAgo", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("notifications.relative.hoursAgo", { count: hours });
  const days = Math.round(hours / 24);
  return t("notifications.relative.daysAgo", { count: days });
}

interface NotificationMenuProps {
  triggerClassName?: string;
  triggerSize?: ButtonProps["size"];
  triggerVariant?: ButtonProps["variant"];
}

export function NotificationMenu({
  triggerClassName,
  triggerSize = "icon",
  triggerVariant = "ghost"
}: NotificationMenuProps = {}) {
  const { t } = useTranslation();
  const items = useNotificationStore((state) => state.items);
  const markRead = useNotificationStore((state) => state.markRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);

  const unread = useMemo(() => items.filter((item) => !item.read).length, [items]);
  const hasUnread = unread > 0;
  const badgeText = unread > 9 ? "9+" : String(unread);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant={triggerVariant}
              size={triggerSize}
              aria-label={t("notifications.title")}
              className={cn("relative", triggerClassName)}
            >
              {hasUnread ? <BellRing data-icon="inline-start" /> : <Bell data-icon="inline-start" />}
              {hasUnread ? (
                <span className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
                  {badgeText}
                </span>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("notifications.title")}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <DropdownMenuLabel className="p-0 text-[13px] font-bold">
            {t("notifications.title")}
          </DropdownMenuLabel>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={!hasUnread}
            onClick={() => markAllRead()}
            className="h-auto px-1.5 text-[11px] font-semibold text-primary hover:bg-primary/10 disabled:text-muted-foreground"
          >
            {t("notifications.markAllRead")}
          </Button>
        </div>
        <DropdownMenuSeparator className="mt-0" />
        {items.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            {t("notifications.empty")}
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onSelect={() => markRead(item.id)}
                relative={relativeTime(t, item.createdAt)}
                titleText={t(item.titleKey)}
                descriptionText={item.descriptionKey ? t(item.descriptionKey) : undefined}
              />
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface NotificationRowProps {
  item: NotificationItem;
  onSelect: () => void;
  relative: string;
  titleText: string;
  descriptionText?: string;
}

function NotificationRow({ item, onSelect, relative, titleText, descriptionText }: NotificationRowProps) {
  return (
    <li>
      <Button
        type="button"
        variant="ghost"
        onClick={onSelect}
        className={cn(
          "h-auto w-full items-start justify-start gap-3 rounded-none px-3 py-2.5 text-left font-normal hover:bg-muted/60",
          !item.read && "bg-muted/30"
        )}
      >
        <span
          className={cn(
            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
            item.read ? "bg-muted-foreground/40" : TONE_DOT[item.tone]
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-[13px]", item.read ? "font-medium" : "font-semibold")}>
            {titleText}
          </p>
          {descriptionText ? (
            <p className="line-clamp-2 text-[12px] text-muted-foreground">{descriptionText}</p>
          ) : null}
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">{relative}</p>
        </div>
      </Button>
    </li>
  );
}
