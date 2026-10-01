"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  LogOut,
  ReceiptText,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Table2,
  UserPen,
} from "lucide-react";
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
import { ProductSortStatus } from "@/config/pos-constants";
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
import { useNavigationGuardStore } from "@/stores/navigation-guard-store";
import { useNativeHeaderStore } from "@/stores/native-header-store";
import { usePosStore } from "@/stores/pos-store";

const ORDER_SORT_TABS = [
  { labelKey: "pos.menuNormal", status: ProductSortStatus.NORMAL },
  { labelKey: "pos.menuSet", status: ProductSortStatus.SET },
  { labelKey: "pos.menuPromotion", status: ProductSortStatus.PROMOTION },
] as const;

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
  const runGuardedNavigation = useNavigationGuardStore((state) => state.run);
  const user = useAuthStore((state) => state.user);
  const refreshAction = useNativeHeaderStore((state) => state.refreshAction);
  const titleOverride = useNativeHeaderStore((state) => state.title);
  const backAction = useNativeHeaderStore((state) => state.backAction);
  // useAppShellData ใส่ home ไว้เสมอ อาเรย์จึงไม่มีทางว่าง — ไม่ต้องมี fallback
  const current = breadcrumbs[breadcrumbs.length - 1];
  // หน้าลึก ๆ อย่างอ๋อเดอร์โต๊ะ ลงทะเบียน title ที่จำเพาะกว่า (เช่นชื่อโต๊ะ) ผ่าน
  // useNativeHeaderStore แทนหัวข้อ static ของ route ได้ (ดูเหตุผลของ store ที่ native-header-store.ts)
  const title = titleOverride || menuItemLabel(current, t);
  const showBack = shouldShowBackButton(model, pathname);
  const isOrderTopBar = pathname === "/posAll/order";
  const isCounterOrder = user?.store_table_status === 2;
  const orderContextLabel = isCounterOrder ? t("nav.order") : t("pos.table");

  function goBack() {
    // หน้าที่ต้องทำอะไรก่อนออกจากหน้าเสมอ (เช่น cleanup draft ที่ยังไม่ยืนยันของ
    // อ๋อเดอร์โต๊ะ — ดู use-draft-cleanup.ts) ลงทะเบียน override ไว้ผ่าน store นี้
    if (backAction) {
      backAction();
      return;
    }

    const fallback = backFallbackPath(pathname);
    if (fallback) {
      router.push(internalRoute(fallback));
      return;
    }
    router.back();
  }

  return (
    <header
      data-pos-order-top-bar={isOrderTopBar ? "true" : undefined}
      className={cn(
        "native-top-bar sticky top-0 z-40 flex min-h-(--app-shell-header-height) w-full shrink-0 items-center px-2 sm:px-3",
        isOrderTopBar ? "gap-2" : "gap-1"
      )}
    >
      {showBack ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("actions.back")}
          className={cn(
            "size-12 shrink-0",
            isOrderTopBar
              ? "rounded-full border-primary-foreground/35 bg-primary-foreground/15 text-primary-foreground shadow-sm hover:bg-primary-foreground/25 hover:text-primary-foreground focus-visible:border-primary-foreground/70 focus-visible:ring-primary-foreground/40"
              : "text-primary"
          )}
          onClick={goBack}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
      ) : null}

      {isOrderTopBar ? (
        <div
          data-pos-order-table-context="true"
          className="flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-primary-foreground/20 bg-primary-foreground/10 px-2 text-primary-foreground shadow-inner"
        >
          <span
            aria-hidden="true"
            className="hidden size-9 shrink-0 place-items-center rounded-full border border-primary-foreground/20 bg-primary-foreground/10 sm:grid"
          >
            {isCounterOrder ? (
              <ReceiptText className="size-4.5" />
            ) : (
              <Table2 className="size-4.5" />
            )}
          </span>
          <h1
            aria-label={`${orderContextLabel}: ${title}`}
            className="flex min-w-0 flex-col items-center leading-none sm:items-start"
          >
            <span className="truncate text-[11px] font-bold tracking-[0.08em] text-primary-foreground/80 uppercase">
              {orderContextLabel}
            </span>
            <span className="mt-1 truncate text-lg font-black text-primary-foreground">
              {title}
            </span>
          </h1>
        </div>
      ) : (
        <h1 className="min-w-0 flex-1 truncate px-1 text-lg font-bold">
          {title}
        </h1>
      )}

      {isOrderTopBar ? (
        <NativeOrderSortTabs />
      ) : (
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
              <RefreshCcw
                className={cn(refreshAction.loading && "animate-spin")}
              />
            </Button>
          ) : null}
          <NotificationMenu triggerClassName="size-12" />
          <NativeProfileMenu
            logout={() => runGuardedNavigation(logout)}
            user={user}
          />
        </div>
      )}
    </header>
  );
}

function NativeOrderSortTabs() {
  const { t } = useTranslation();
  const activeSort = usePosStore((state) => state.activeSort);
  const setActiveSort = usePosStore((state) => state.setActiveSort);

  return (
    <div
      data-pos-order-sort-tabs="true"
      role="group"
      aria-label={t("pos.menu")}
      className="grid w-[clamp(11.75rem,52vw,25rem)] shrink-0 grid-cols-3 gap-1 overflow-hidden rounded-xl border border-primary-foreground/25 bg-black/10 p-0.5 shadow-inner"
    >
      {ORDER_SORT_TABS.map((tab) => {
        const active = tab.status === activeSort;
        return (
          <Button
            key={tab.status}
            type="button"
            aria-pressed={active}
            variant="ghost"
            className={cn(
              "h-11 min-w-11 justify-center rounded-lg border-transparent bg-transparent px-2 text-xs font-bold text-primary-foreground/85 shadow-none hover:bg-primary-foreground/15 hover:text-primary-foreground focus-visible:border-primary-foreground focus-visible:ring-primary-foreground",
              active &&
                "border-primary-foreground/70 bg-primary-foreground text-primary shadow-sm hover:bg-primary-foreground/90 hover:text-primary"
            )}
            onClick={() => setActiveSort(tab.status)}
          >
            <span className="min-w-0 truncate">{t(tab.labelKey)}</span>
          </Button>
        );
      })}
    </div>
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
            <span className="text-sm text-muted-foreground">
              {t("app.theme")}
            </span>
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
          <AppearanceControls
            idPrefix="topbar-appearance-theme-color"
            size="touch"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
