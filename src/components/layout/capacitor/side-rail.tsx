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

export function NativeSideRail({
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
      // rail เลื่อนได้เอง ต่างจาก Flutter NavigationRail — เพิ่มจำนวนปลายทางภายหลังได้โดยไม่ต้องรื้อ
      className="hidden w-(--app-shell-side-rail-width) shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-card px-1 py-2 md:flex"
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
