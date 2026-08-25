"use client";

import { useTranslation } from "react-i18next";
import { MoreHorizontal } from "lucide-react";
import {
  isDestinationActive,
  type NativeNavigationModel,
} from "@/components/layout/native-navigation-model";
import {
  NavDestinationButton,
  NavMoreButton,
} from "@/components/layout/capacitor/nav-destination-button";

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
  const anyDirectActive = model.direct.some((destination) =>
    isDestinationActive(destination, pathname),
  );

  return (
    <nav
      aria-label={t("app.navigation")}
      className="fixed inset-x-0 bottom-0 z-40 flex h-(--app-shell-bottom-nav-height) items-start gap-0.5 border-t border-border bg-card px-1 pt-1 pb-[env(safe-area-inset-bottom,0px)] md:hidden"
    >
      {model.direct.map((destination) => (
        <NavDestinationButton
          key={destination.path}
          active={isDestinationActive(destination, pathname)}
          destination={destination}
        />
      ))}
      {model.more.length ? (
        <NavMoreButton
          active={moreOpen || !anyDirectActive}
          icon={<MoreHorizontal className="size-5 shrink-0" />}
          label={t("app.more")}
          onClick={onMoreClick}
        />
      ) : null}
    </nav>
  );
}
