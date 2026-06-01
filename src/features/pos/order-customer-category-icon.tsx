"use client";

import { Icon, addCollection } from "@iconify/react";
import { icons as mdiIcons } from "@iconify-json/mdi";
import { optionalString } from "./table-selection/utils";

let collectionReady = false;

function ensureMdiCollection() {
  if (collectionReady) return;
  addCollection(mdiIcons);
  collectionReady = true;
}

export function CategoryIconView({
  className,
  icon,
}: {
  className?: string;
  icon?: string | null;
}) {
  const iconName = optionalString(icon);
  if (!iconName) return null;

  ensureMdiCollection();
  return <Icon aria-hidden="true" icon={iconName} className={className} />;
}
