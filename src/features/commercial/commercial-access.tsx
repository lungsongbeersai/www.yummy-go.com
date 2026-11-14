"use client";

import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { menuGrantsPath } from "@/components/layout/shell-menu-helpers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCommercialLabels } from "@/features/commercial/commercial.locale";
import { useSidebarPermissionAccess } from "@/hooks/use-sidebar-permission-access";
import { canViewBranchSettings } from "@/lib/permissions";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { usePermissionsSidebarStore } from "@/stores/permissions-sidebar-store";

export function CommercialLoading() {
  return <div className="grid gap-4 p-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-48 w-full" /></div>;
}

export function CommercialAccessGate({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const l = useCommercialLabels();
  const { i18n } = useTranslation();
  const { keyMatches, loading, menuItems } = useSidebarPermissionAccess();
  const error = usePermissionsSidebarStore((state) => state.error);
  const load = usePermissionsSidebarStore((state) => state.load);
  if (!canViewBranchSettings(user?.status)) return <Alert className="m-4 font-lao" variant="destructive"><AlertDescription>{l("noPermission")}</AlertDescription></Alert>;
  if (loading) return <CommercialLoading />;
  if (keyMatches && error) return <Alert className="m-4 font-lao" variant="destructive"><AlertTitle>{l("error")}</AlertTitle><AlertDescription><p>{error}</p><Button variant="outline" className="min-h-11" onClick={() => { if (user) void load(authStoreUuid(user), user.status, i18n.language); }}>{l("retry")}</Button></AlertDescription></Alert>;
  if (!keyMatches || !menuGrantsPath(menuItems, "/commercial")) return <Alert className="m-4 font-lao" variant="destructive"><AlertDescription>{l("noPermission")}</AlertDescription></Alert>;
  return <Fragment key={`${token}:${user?.uuid}:${user?.status}:${authStoreUuid(user)}:${user?.branch_uuid}`}>{children}</Fragment>;
}
