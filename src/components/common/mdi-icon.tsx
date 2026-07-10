"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { Icon } from "@iconify/react/offline";
import {
  getMdiIconData,
  loadMdiIconData,
  type MdiIconMap
} from "@/lib/mdi-icon-data";

type MdiIconProps = Omit<ComponentProps<typeof Icon>, "icon"> & {
  fallbackValue: string;
  icons: MdiIconMap;
  value?: unknown;
};

interface LoadedMdiIcon {
  data: NonNullable<Awaited<ReturnType<typeof loadMdiIconData>>>;
  value: unknown;
}

export function MdiIcon({ fallbackValue, icons, value, ...props }: MdiIconProps) {
  const [loaded, setLoaded] = useState<LoadedMdiIcon | null>(null);
  const immediate = getMdiIconData(value, icons);
  const fallback = getMdiIconData(fallbackValue, icons);

  useEffect(() => {
    if (immediate) return;
    let active = true;

    void loadMdiIconData(value, icons)
      .then((data) => {
        if (active && data) setLoaded({ data, value });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [icons, immediate, value]);

  const icon = immediate ?? (loaded && loaded.value === value ? loaded.data : fallback);
  return icon ? <Icon aria-hidden icon={icon} {...props} /> : null;
}
