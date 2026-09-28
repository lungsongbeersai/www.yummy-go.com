"use client";

import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SETTINGS_ACCENT } from "@/features/settings/shared/settings-tones";
import { cn } from "@/lib/utils";
import { userActiveLabel, userInitials } from "./user-utils";

// Initials fall back to the settings accent, like the icon tiles on the other settings lists.
export function UserAvatar({ email, src }: { email: string; src: string }) {
  return (
    <Avatar>
      {src ? <AvatarImage alt={email} src={src} /> : null}
      <AvatarFallback className={SETTINGS_ACCENT.soft}>{userInitials(email)}</AvatarFallback>
    </Avatar>
  );
}

export function UserBadges({ currentRow, protectedRow }: { currentRow: boolean; protectedRow: boolean }) {
  const { t } = useTranslation();

  return (
    <>
      {currentRow ? <Badge variant="secondary">{t("settings.currentUser")}</Badge> : null}
      {protectedRow ? <Badge variant="outline">{t("settings.protectedUser")}</Badge> : null}
    </>
  );
}

// Active / inactive is a status: a dot in the status colour plus its label (same as the store list).
export function UserActiveBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const active = Number(status || 1) === 1;

  return (
    <Badge variant="outline">
      <span aria-hidden className={cn("size-1.5 rounded-full", active ? "bg-success" : "bg-muted-foreground")} />
      {userActiveLabel(status, t("common.active"), t("common.inactive"))}
    </Badge>
  );
}
