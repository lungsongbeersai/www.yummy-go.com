"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MenuIcon } from "@/components/common/menu-icon";
import {
  menuItemLabel,
  routeIsActive,
} from "@/components/layout/shell-menu-helpers";
import type { NativeNavigationModel } from "@/components/layout/native-navigation-model";
import type { MenuItem } from "@/config/menu";
import { internalRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  useAppStore,
  type FontScale,
  type ThemeColor,
} from "@/stores/app-store";

const THEME_COLORS: readonly ThemeColor[] = [
  "emerald",
  "blue",
  "amber",
  "rose",
  "violet",
];
const FONT_SCALES: readonly FontScale[] = ["sm", "md", "lg"];

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
        className="h-[85dvh] overscroll-contain px-0 pb-[env(safe-area-inset-bottom,0px)]"
      >
        <SheetHeader className="px-4">
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
                <MoreLeaf
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

function MoreLeaf({
  item,
  onNavigate,
  pathname,
}: {
  item: MenuItem;
  onNavigate: () => void;
  pathname: string;
}) {
  return (
    <MoreLink item={item} onNavigate={onNavigate} pathname={pathname} />
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
        "flex min-h-12 items-center gap-3 rounded-md px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        indented && "pl-10",
        active ? "font-semibold text-primary" : "hover:bg-accent",
      )}
    >
      {!indented && item.iconName ? (
        <MenuIcon value={item.iconName} className="size-5 shrink-0" />
      ) : null}
      <span className="truncate">{label}</span>
    </Link>
  );
}

// FloatingSettingsButton เป็น affordance ของเว็บเดสก์ท็อป (ลากได้ ผูกกับ .app-header)
// บนแอปจริงการตั้งค่าหน้าตาอยู่ในรายการแบบ Settings — ย้ายมาไว้ที่นี่แทน
function AppearanceSection() {
  const { t } = useTranslation();
  const themeColor = useAppStore((state) => state.themeColor);
  const setThemeColor = useAppStore((state) => state.setThemeColor);
  const fontScale = useAppStore((state) => state.fontScale);
  const setFontScale = useAppStore((state) => state.setFontScale);

  return (
    <section className="flex flex-col gap-4 px-2">
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {t("app.appearance.title")}
      </h2>

      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold text-muted-foreground">
          {t("app.appearance.colorLabel")}
        </Label>
        <RadioGroup
          value={themeColor}
          onValueChange={(value) => setThemeColor(value as ThemeColor)}
          className="flex flex-row flex-wrap gap-3"
        >
          {THEME_COLORS.map((color) => (
            <Label
              key={color}
              htmlFor={`native-theme-color-${color}`}
              data-theme-color={color}
              className="relative flex size-11 cursor-pointer items-center justify-center rounded-full bg-primary ring-1 ring-foreground/10 ring-offset-2 ring-offset-background transition-shadow has-data-[state=checked]:ring-2 has-data-[state=checked]:ring-foreground/60"
            >
              <RadioGroupItem
                id={`native-theme-color-${color}`}
                value={color}
                className="sr-only"
              />
              <span className="sr-only">
                {t(`app.appearance.colors.${color}`)}
              </span>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold text-muted-foreground">
          {t("app.appearance.fontSizeLabel")}
        </Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={fontScale}
          onValueChange={(value) => {
            if (value) setFontScale(value as FontScale);
          }}
          className="w-full"
        >
          {FONT_SCALES.map((scale) => (
            <ToggleGroupItem
              key={scale}
              value={scale}
              className="h-11 flex-1 text-xs font-bold"
            >
              {t(`app.appearance.fontSizes.${scale}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </section>
  );
}
