"use client";

import { useTranslation } from "react-i18next";
import type { NativeNavigationModel } from "@/components/layout/native-navigation-model";
import { NativeNavItems } from "@/components/layout/capacitor/nav-destination-button";

export function NativeBottomNav({
  model,
  moreOpen,
  onMoreClick,
  pathname,
}: {
  model: NativeNavigationModel;
  moreOpen: boolean;
  onMoreClick: () => void;
  pathname: string;
}) {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t("app.navigation")}
      className="fixed inset-x-0 bottom-0 z-40 flex h-(--app-shell-bottom-nav-height) items-start gap-0.5 border-t border-border bg-card px-1 pt-1 pb-[env(safe-area-inset-bottom,0px)] md:hidden [&>*]:flex-1"
    >
      <NativeNavItems
        model={model}
        moreOpen={moreOpen}
        onMoreClick={onMoreClick}
        pathname={pathname}
      />
    </nav>
  );
}
