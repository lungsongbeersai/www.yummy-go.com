"use client";

import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { LoadingState } from "@/components/common/loading-state";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { isFixedDataScreen, isImmersiveScreen } from "@/components/layout/shell-menu-helpers";
import { useAppStore } from "@/stores/app-store";

// Fixed label widths (not random) so server and client render the same markup.
const MENU_LABEL_WIDTHS = ["w-16", "w-10", "w-20", "w-24", "w-28", "w-24", "w-28", "w-32", "w-16", "w-20"];

// Store (SidebarHeader) and user (SidebarFooter) rows share the same size-lg shape.
function IdentityRowSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex h-12 items-center gap-2 p-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 group-data-[collapsible=icon]:hidden">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-36 max-w-full" />
          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// The loading picture of the web AppShell (src/components/layout/web/app-shell.tsx): the
// same sidebar-07 frame — real SidebarProvider/Sidebar/SidebarInset, so width, collapsed
// state and the mobile off-canvas behaviour match — with placeholders instead of data.
// Immersive POS screens get no chrome, exactly like the real shell.
export function AppShellSkeleton({ label }: { label?: string }) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const collapsed = useAppStore((state) => state.collapsed);
  const setCollapsed = useAppStore((state) => state.setCollapsed);
  const immersive = isImmersiveScreen(pathname);
  const fixed = isFixedDataScreen(pathname);
  // Touch-sized on phones/tablets like the real header controls.
  const controlClassName = "size-11 sm:size-9";

  return (
    <SidebarProvider
      open={!collapsed}
      onOpenChange={(open) => setCollapsed(!open)}
      className={cn("app-shell text-foreground", fixed ? "h-screen overflow-hidden" : "min-h-screen")}
    >
      {!immersive ? (
        <Sidebar collapsible="icon" aria-hidden="true">
          <SidebarHeader>
            <IdentityRowSkeleton />
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarMenu>
                {MENU_LABEL_WIDTHS.map((width, index) => (
                  <SidebarMenuItem key={index}>
                    <div className="flex h-8 items-center gap-2 px-2">
                      <Skeleton className="size-4 shrink-0" />
                      <Skeleton className={cn("h-3.5 group-data-[collapsible=icon]:hidden", width)} />
                    </div>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <IdentityRowSkeleton />
          </SidebarFooter>
        </Sidebar>
      ) : null}
      <SidebarInset className={cn("min-w-0", fixed && "h-full min-h-0 overflow-hidden")}>
        {!immersive ? (
          <header
            aria-hidden="true"
            className="app-header sticky top-0 z-40 flex h-(--app-shell-header-height) shrink-0 items-center gap-2 px-4"
          >
            <Skeleton className={cn("-ml-1", controlClassName)} />
            <Separator orientation="vertical" className="data-[orientation=vertical]:h-4" />
            <Skeleton className={controlClassName} />
            <Skeleton className="h-4 w-40" />
            <div className="ml-auto flex items-center gap-1">
              <Skeleton className={controlClassName} />
              <Skeleton className={controlClassName} />
            </div>
          </header>
        ) : null}
        <div className={fixed ? "min-h-0 w-full flex-1 overflow-hidden p-4" : "mx-auto w-full max-w-375 p-4 lg:p-6"}>
          <LoadingState label={label ?? t("common.loading")} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
