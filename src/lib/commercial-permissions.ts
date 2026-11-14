import type { MenuItem } from "@/config/menu";
import { canViewBranchSettings } from "@/lib/permissions";
import { canonicalRoute } from "@/lib/routes";
import type { AuthUser } from "@/stores/auth-store";

type CommercialActor = Pick<AuthUser, "status" | "store_status">;

export function canUseCommercial(actor: CommercialActor | null | undefined) {
  return actor?.store_status === 1 && canViewBranchSettings(actor.status);
}

export function isCommercialPath(path: string | undefined) {
  const pathname = canonicalRoute((path ?? "").split(/[?#]/, 1)[0]);
  return pathname === "/commercial" || pathname.startsWith("/commercial/");
}

export function commercialMenuItems(items: MenuItem[], actor: CommercialActor | null | undefined): MenuItem[] {
  if (canUseCommercial(actor)) return items;
  return items.flatMap(item => {
    if (isCommercialPath(item.path)) return [];
    if (!item.children?.length) return [item];
    const children = commercialMenuItems(item.children, actor);
    return children.length ? [{ ...item, children }] : [];
  });
}

// Exports remain private after their dialog closes, so their owner includes live permissions.
export function commercialSessionIdentity(user: AuthUser | null, token: string | null) {
  return JSON.stringify([user?.uuid, user?.store_uuid || user?.store_uuid_fk || "", token, user?.status, user?.store_status, user?.branch_uuid]);
}
