"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ChevronsUpDown, LogOut, ShieldCheck, UserPen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { userInitials } from "@/components/layout/shell-menu-helpers";
import { getStoreLogoUrl, getUserProfileUrl } from "@/lib/image";
import type { AuthUser } from "@/stores/auth-store";

// sidebar-07 "team-switcher" slot: this app has one store per session, so it is a
// home link rather than a switcher.
export function SidebarStoreHeader({ user }: { user: AuthUser | null }) {
  const { t } = useTranslation();
  const { setOpenMobile } = useSidebar();
  const logoSrc = user?.store_logo ? getStoreLogoUrl(user.store_logo) : "/brand/icon.png";
  const branchTitle = user?.branch_name || user?.store_name || "Yummy Go";
  const address = user?.branch_address || user?.store_name || t("app.posWorkspace");

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {/* The shop is the sidebar's headline: a larger logo and name, and the address may take two
            lines instead of being cut off. Collapsed to icons, the button keeps the rail's 32px. */}
        <SidebarMenuButton size="lg" asChild tooltip={`${branchTitle} - ${address}`} className="h-auto gap-3 py-2">
          <Link href="/" onClick={() => setOpenMobile(false)}>
            <Avatar className="size-11 rounded-xl shadow-sm group-data-[collapsible=icon]:size-8">
              <AvatarImage src={logoSrc} alt={branchTitle} />
              <AvatarFallback className="rounded-xl">{userInitials(user)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 gap-0.5 text-left">
              <span className="truncate text-base leading-tight font-bold">{branchTitle}</span>
              <span className="line-clamp-2 text-xs leading-snug text-muted-foreground">{address}</span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// sidebar-07 "nav-user" slot.
export function SidebarUserMenu({
  user,
  logout,
}: {
  user: AuthUser | null;
  logout: () => void;
}) {
  const { t } = useTranslation();
  const { isMobile, setOpenMobile } = useSidebar();
  const profileSrc = user?.profile ? getUserProfileUrl(user.profile) : "";
  const title = user?.email ?? t("profile.sections.account");
  const subtitle = user?.zone_name || t("profile.sections.account");
  const identity = (
    <>
      <Avatar className="size-8 rounded-lg">
        {profileSrc ? <AvatarImage src={profileSrc} alt={title} /> : null}
        <AvatarFallback className="rounded-lg">{userInitials(user)}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left leading-tight">
        <span className="truncate font-medium">{title}</span>
        <span className="truncate text-muted-foreground">{subtitle}</span>
      </div>
    </>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={title}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {identity}
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="flex items-center gap-2 font-normal">
              {identity}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/profile" onClick={() => setOpenMobile(false)}>
                  <UserPen />
                  {t("actions.editProfile")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/policy" onClick={() => setOpenMobile(false)}>
                  <ShieldCheck />
                  {t("policy.title")}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={logout}>
              <LogOut />
              {t("actions.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
