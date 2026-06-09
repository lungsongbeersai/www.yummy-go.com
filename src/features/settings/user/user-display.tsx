"use client";

import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  userActiveBadgeClass,
  userActiveLabel,
  userInitials
} from "./user-utils";

export function UserAvatar({
  email,
  src
}: {
  email: string;
  src: string;
}) {
  return (
    <Avatar size="lg">
      {src ? <AvatarImage alt={email} src={src} /> : null}
      <AvatarFallback>{userInitials(email)}</AvatarFallback>
    </Avatar>
  );
}

export function UserBadges({
  currentRow,
  protectedRow
}: {
  currentRow: boolean;
  protectedRow: boolean;
}) {
  const { t } = useTranslation();

  return (
    <>
      {currentRow ? (
        <Badge className="shrink-0 border-primary/25 bg-primary/10 text-primary">
          {t("settings.currentUser")}
        </Badge>
      ) : null}
      {protectedRow ? <Badge className="shrink-0">{t("settings.protectedUser")}</Badge> : null}
    </>
  );
}

export function UserIdentity({
  currentRow,
  email,
  protectedRow,
  src
}: {
  currentRow: boolean;
  email: string;
  protectedRow: boolean;
  src: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <UserAvatar email={email} src={src} />
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="min-w-0 truncate font-black" translate="no">{email}</p>
          <UserBadges currentRow={currentRow} protectedRow={protectedRow} />
        </div>
      </div>
    </div>
  );
}

export function UserActiveBadge({ status }: { status: string }) {
  const { t } = useTranslation();

  return (
    <Badge className={userActiveBadgeClass(status)}>
      {userActiveLabel(status, t("common.active"), t("common.inactive"))}
    </Badge>
  );
}
