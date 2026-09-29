"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buildNativeNavigationModel } from "@/components/layout/native-navigation-model";
import { userInitials } from "@/components/layout/shell-menu-helpers";
import { useAppShellData } from "@/components/layout/use-app-shell-data";
import {
  MoreGroupRow,
  MoreListRow,
  needsMoreGroupDropdown,
} from "@/components/layout/capacitor/more-list-row";
import { getUserProfileUrl } from "@/lib/image";
import { useAuthStore } from "@/stores/auth-store";

// หน้าเต็มจอแทน bottom sheet เดิม — ตรงกับ Flutter reference ที่แตะ "More" แล้วเด้งไปหน้าใหม่
// ไม่ใช่ sheet ลอยทับ (จึงมี header กระดิ่ง/โปรไฟล์ของตัวเองจาก NativeTopBar เหมือนหน้าอื่น ๆ)
//
// Laid out like a native app's "More" tab: the account on top (who is signed in, which store and
// branch), then a plain full-width list. See more-list-row.tsx for the row anatomy.
export function NativeMorePage() {
  const { menuItems, pathname } = useAppShellData();
  const model = useMemo(() => buildNativeNavigationModel(menuItems), [menuItems]);

  return (
    <div className="flex flex-col gap-2 pb-4">
      <AccountHeader />
      <nav className="flex flex-col">
        {model.more.map((item) =>
          needsMoreGroupDropdown(item) ? (
            <MoreGroupRow key={item.title} item={item} pathname={pathname} />
          ) : (
            <MoreListRow key={item.path ?? item.title} item={item} pathname={pathname} />
          ),
        )}
      </nav>
    </div>
  );
}

function AccountHeader() {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  if (!user) return null;
  const profileSrc = user.profile ? getUserProfileUrl(user.profile) : "";
  const place = [user.store_name, user.branch_name].filter(Boolean).join(" · ");

  return (
    // A tinted surface, not a bordered card: the one block on the page that is about "you".
    <Link
      href="/profile"
      className="flex items-center gap-4 rounded-3xl bg-muted/70 p-4 transition-colors duration-150 select-none active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
    >
      <Avatar className="size-14">
        {profileSrc ? <AvatarImage src={profileSrc} alt="" /> : null}
        <AvatarFallback className="text-base">{userInitials(user)}</AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-lg font-semibold text-foreground">{place || t("profile.sections.account")}</span>
        <span className="truncate text-[13px] text-muted-foreground">{user.email}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground/60" />
    </Link>
  );
}
