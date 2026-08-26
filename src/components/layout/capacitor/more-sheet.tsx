"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { MenuIcon } from "@/components/common/menu-icon";
import { AppearanceControls } from "@/components/layout/appearance-controls";
import { NativeRouteProgress } from "@/components/layout/capacitor/route-progress";
import {
  menuItemLabel,
  routeIsActive,
} from "@/components/layout/shell-menu-helpers";
import type { NativeNavigationModel } from "@/components/layout/native-navigation-model";
import type { MenuItem } from "@/config/menu";
import { internalRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function NativeMoreSheet({
  model,
  onOpenChange,
  open,
  pathname,
}: {
  model: NativeNavigationModel;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pathname: string;
}) {
  const { t } = useTranslation();

  function close() {
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        // ต้องประกาศความสูงซ้ำด้วย data-[side=bottom]: ด้วย เพราะ SheetContent ฐานมี
        // data-[side=bottom]:h-auto ซึ่ง specificity เท่ากันแต่ประกาศทีหลัง ⇒ ชนะ h-[85dvh] เปล่า ๆ
        // (แพทเทิร์นเดียวกับ order-customer-product-options.tsx / order-customer-view.tsx)
        className="h-[85dvh] overscroll-contain px-0 pb-[env(safe-area-inset-bottom,0px)] data-[side=bottom]:h-[85dvh]"
      >
        <SheetHeader className="shrink-0 px-4">
          <SheetTitle>{t("app.moreNavigation")}</SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-6">
          <Accordion type="multiple" className="w-full">
            {model.more.map((item) =>
              item.children?.length ? (
                <MoreGroup
                  key={item.title}
                  item={item}
                  onNavigate={close}
                  pathname={pathname}
                />
              ) : (
                <MoreLink
                  key={item.path ?? item.title}
                  item={item}
                  onNavigate={close}
                  pathname={pathname}
                />
              ),
            )}
          </Accordion>

          <Separator className="my-4" />
          <AppearanceSection />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MoreGroup({
  item,
  onNavigate,
  pathname,
}: {
  item: MenuItem;
  onNavigate: () => void;
  pathname: string;
}) {
  const { t } = useTranslation();

  return (
    <AccordionItem value={item.title} className="border-b-0">
      <AccordionTrigger className="min-h-12 px-2 text-sm font-semibold hover:no-underline">
        <span className="flex min-w-0 items-center gap-3">
          {item.iconName ? (
            <MenuIcon value={item.iconName} className="size-5 shrink-0" />
          ) : null}
          <span className="truncate">{menuItemLabel(item, t)}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-1">
        {item.children?.map((child) => (
          <MoreLink
            key={child.path ?? child.title}
            indented
            item={child}
            onNavigate={onNavigate}
            pathname={pathname}
          />
        ))}
      </AccordionContent>
    </AccordionItem>
  );
}

function MoreLink({
  indented,
  item,
  onNavigate,
  pathname,
}: {
  indented?: boolean;
  item: MenuItem;
  onNavigate: () => void;
  pathname: string;
}) {
  const { t } = useTranslation();
  const label = menuItemLabel(item, t);
  const active = routeIsActive(pathname, item.path);

  if (item.disabled || !item.path) {
    return (
      <span
        aria-disabled="true"
        className={cn(
          "flex min-h-12 items-center gap-3 rounded-md px-2 text-sm opacity-50",
          indented && "pl-10",
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={internalRoute(item.path)}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "relative flex min-h-12 items-center gap-3 rounded-md px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        indented && "pl-10",
        active ? "font-semibold text-primary" : "hover:bg-accent",
      )}
    >
      {!indented && item.iconName ? (
        <MenuIcon value={item.iconName} className="size-5 shrink-0" />
      ) : null}
      <span className="truncate">{label}</span>
      <NativeRouteProgress />
    </Link>
  );
}

// FloatingSettingsButton เป็น affordance ของเว็บเดสก์ท็อป (ลากได้ ผูกกับ .app-header)
// บนแอปจริงการตั้งค่าหน้าตาอยู่ในรายการแบบ Settings — ย้ายมาไว้ที่นี่แทน
function AppearanceSection() {
  const { t } = useTranslation();

  return (
    <section className="flex flex-col gap-4 px-2">
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {t("app.appearance.title")}
      </h2>

      <AppearanceControls idPrefix="native-theme-color" size="touch" />
    </section>
  );
}
