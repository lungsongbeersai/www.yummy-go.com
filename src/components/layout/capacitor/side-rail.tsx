"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/shell-sidebar-menu";
import { SidebarStoreHeader, SidebarUserMenu } from "@/components/layout/web/sidebar-identity";
import type { MenuItem } from "@/config/menu";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useNavigationGuardStore } from "@/stores/navigation-guard-store";

// เดิม rail นี้เป็นแค่ไอคอนคอลัมน์แคบ ๆ (ปลายทางจำกัดจำนวน + ปุ่ม "เพิ่มเติม") ตอนนี้เปลี่ยนมา
// ใช้ AppSidebar ตัวเดียวกับเว็บเดสก์ท็อปตรง ๆ (เมนูเต็มรูปแบบ กลุ่มหด/กางได้ ไม่จำกัดจำนวน)
// ตามที่ขอให้ Capacitor แท็บเล็ต/แนวนอนหน้าตาเหมือนเดสก์ท็อปจริง ๆ
//
// AppSidebar ห่อด้วย SidebarProvider ของตัวเอง (แยกจาก AppShell ของเว็บ) เพราะ NativeAppShell
// ไม่มี SidebarProvider ครอบทั้งต้นไม้อยู่แล้ว — ใช้ collapsed state ก้อนเดียวกับเว็บผ่าน
// useAppStore เพื่อให้พับ/กางเมนูแล้วจำค่าข้ามแพลตฟอร์มเดียวกัน (ไม่ใช่ state แยกอีกชุด)
//
// wrapper ของ SidebarProvider เองเป็น flex w-full min-h-svh ตามปกติ (ออกแบบมาให้ครอบทั้งแอป)
// ในนี้ต้องตัดทิ้งเหลือแค่ shrink-0 ตามความกว้างจริงของ Sidebar ไม่งั้นมันพยายามยืดเต็มแถว
// app-shell-body แย่งที่ <main> ไปหมด (Sidebar ข้างในเป็น fixed อยู่แล้ว ไม่ได้พึ่ง wrapper
// นี้จัดตำแหน่งจริง — wrapper แค่เป็นที่เก็บ CSS variable ของ context เท่านั้น)
export function NativeSideRail({
  error,
  loading,
  menuItems,
  onRetry,
  openMenus,
  pathname,
  desktopHomeLayout,
  toggleMenu,
}: {
  error: string | null;
  loading: boolean;
  menuItems: MenuItem[];
  onRetry: () => void;
  openMenus: Set<string>;
  pathname: string;
  desktopHomeLayout?: boolean;
  toggleMenu: (title: string) => void;
}) {
  const collapsed = useAppStore((state) => state.collapsed);
  const setCollapsed = useAppStore((state) => state.setCollapsed);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const runGuardedNavigation = useNavigationGuardStore((state) => state.run);

  return (
    <SidebarProvider
      open={!collapsed}
      onOpenChange={(open) => setCollapsed(!open)}
      className="hidden h-full min-h-0 w-auto shrink-0 md:flex"
    >
      {/* ลบ --pos-system-bottom-safe-area ออกจากความสูงทั้งก้อนด้วย ไม่ใช่แค่เผื่อ padding
          ข้างในเนื้อหา — ไม่งั้น footer ของ Sidebar (ปุ่มย่อเมนูหรือบัญชีบน Swan 1)
          จะไปโผล่ทับโซน home indicator/gesture bar ของระบบพอดี กดไม่ได้ */}
      <AppSidebar
        className={cn(
          "app-sidebar-panel top-(--app-shell-header-height) h-[calc(100dvh-var(--app-shell-header-height)-var(--pos-system-bottom-safe-area,0px))] border-r border-sidebar-border",
          desktopHomeLayout && "swan1-home-sidebar",
        )}
        header={desktopHomeLayout ? <SidebarStoreHeader user={user} /> : undefined}
        footer={desktopHomeLayout ? (
          <SidebarUserMenu user={user} logout={() => runGuardedNavigation(logout)} />
        ) : undefined}
        error={error}
        loading={loading}
        menuItems={menuItems}
        openMenus={openMenus}
        pathname={pathname}
        retry={onRetry}
        toggleMenu={toggleMenu}
      />
    </SidebarProvider>
  );
}
