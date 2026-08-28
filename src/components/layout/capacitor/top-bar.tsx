"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ChevronLeft, LogOut, RefreshCcw, Settings, ShieldCheck, UserPen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppearanceControls } from "@/components/layout/appearance-controls";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { NotificationMenu } from "@/components/layout/notification-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  menuItemLabel,
  userInitials,
} from "@/components/layout/shell-menu-helpers";
import {
  backFallbackPath,
  shouldShowBackButton,
  type NativeNavigationModel,
} from "@/components/layout/native-navigation-model";
import type { BreadcrumbTrailItem } from "@/components/layout/shell-breadcrumbs";
import { getUserProfileUrl } from "@/lib/image";
import { internalRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";
import { useNativeHeaderStore } from "@/stores/native-header-store";

export function NativeTopBar({
  breadcrumbs,
  model,
  pathname,
}: {
  breadcrumbs: BreadcrumbTrailItem[];
  model: NativeNavigationModel;
  pathname: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const refreshAction = useNativeHeaderStore((state) => state.refreshAction);
  const titleOverride = useNativeHeaderStore((state) => state.title);
  // useAppShellData ใส่ home ไว้เสมอ อาเรย์จึงไม่มีทางว่าง — ไม่ต้องมี fallback
  const current = breadcrumbs[breadcrumbs.length - 1];
  // หน้าลึก ๆ อย่างอ๋อเดอร์โต๊ะ ลงทะเบียน title ที่จำเพาะกว่า (เช่นชื่อโต๊ะ) ผ่าน
  // useNativeHeaderStore แทนหัวข้อ static ของ route ได้ (ดูเหตุผลของ store ที่ native-header-store.ts)
  const title = titleOverride || menuItemLabel(current, t);
  const showBack = shouldShowBackButton(model, pathname);

  function goBack() {
    const fallback = backFallbackPath(pathname);
    if (fallback) {
      router.push(internalRoute(fallback));
      return;
    }
    router.back();
  }

  return (
    <header className="native-top-bar sticky top-0 z-40 flex min-h-(--app-shell-header-height) w-full shrink-0 items-center gap-1 px-2 sm:px-3">
      {showBack ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("actions.back")}
          className="size-12 shrink-0 text-primary"
          onClick={goBack}
        >
          <ChevronLeft />
        </Button>
      ) : null}

      <h1 className="min-w-0 flex-1 truncate px-1 text-lg font-bold">
        {title}
      </h1>

      <div className="flex shrink-0 items-center">
        {refreshAction ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("actions.refresh")}
            className="size-12"
            onClick={refreshAction.onClick}
          >
            <RefreshCcw className={cn(refreshAction.loading && "animate-spin")} />
          </Button>
        ) : null}
        <NotificationMenu triggerClassName="size-12" />
        <NativeProfileMenu logout={logout} user={user} />
      </div>
    </header>
  );
}

function NativeProfileMenu({
  logout,
  user,
}: {
  logout: () => void;
  user: AuthUser | null;
}) {
  const { t } = useTranslation();
  const profileSrc = user?.profile ? getUserProfileUrl(user.profile) : "";
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={user?.email ?? t("profile.sections.account")}
            className="size-12"
          >
            <Avatar className="size-9">
              {profileSrc ? (
                <AvatarImage src={profileSrc} alt={user?.email ?? "Profile"} />
              ) : null}
              <AvatarFallback>{userInitials(user)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="truncate">
            {user?.email ?? t("profile.sections.account")}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* theme/language ย้ายมาไว้ในนี้แทนไอคอนแยกบน top bar — จอมือถือไม่มีที่พอ
              (ThemeToggle = สลับสว่าง/มืดเร็ว ๆ ตรงนี้ คนละอย่างกับ AppearanceControls
              สี/ขนาดฟอนต์ที่เปิดเป็น dialog จากเมนู "ตั้งค่า" ด้านล่างแทน)
              py-1 (ไม่ใช่ py-1.5 แบบ DropdownMenuItem ปกติ) — สองแถวนี้สูงกว่ารายการอื่น
              อยู่แล้วเพราะมีปุ่มไอคอน size-9 ข้างใน padding เท่ากันเลยดูห่างกันเกินไปตามที่รายงานมา */}
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <span className="text-sm text-muted-foreground">
              {t("app.changeLanguage")}
            </span>
            <LanguageSwitch compact size="icon" className="size-9" />
          </div>
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <span className="text-sm text-muted-foreground">{t("app.theme")}</span>
            <ThemeToggle variant="ghost" className="size-9" />
          </div>
          <DropdownMenuSeparator />
          {/* onSelect เซ็ต state ตรง ๆ ไม่ต้อง preventDefault — DropdownMenu ปิดตัวเองแล้ว
              Dialog (sibling นอก DropdownMenu ด้านล่าง) เปิดตามได้โดยไม่ชนกัน ตามแพทเทิร์นเดียวกับ
              product-order-dialog.tsx ในระบบนี้ */}
          <DropdownMenuItem onSelect={() => setAppearanceOpen(true)}>
            <Settings />
            {t("nav.settings")}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <UserPen />
              {t("actions.editProfile")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/policy">
              <ShieldCheck />
              {t("policy.title")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={logout}>
            <LogOut />
            {t("actions.signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={appearanceOpen} onOpenChange={setAppearanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("app.appearance.title")}</DialogTitle>
          </DialogHeader>
          <AppearanceControls idPrefix="topbar-appearance-theme-color" size="touch" />
        </DialogContent>
      </Dialog>
    </>
  );
}
