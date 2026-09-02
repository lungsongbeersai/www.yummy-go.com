"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { Icon } from "@iconify/react/offline";
import {
  getMdiIconData,
  loadMdiIconData,
  type MdiIconMap
} from "@/lib/mdi-icon-data";

type MdiIconProps = Omit<ComponentProps<typeof Icon>, "icon"> & {
  // false ที่หน้าแสดงผลอย่างเดียว (เมนูลูกค้า, รายการหมวดหมู่) กัน import()
  // ไฟล์ไอคอนทั้งชุด (~3MB) ทุกครั้งที่ค่าที่บันทึกไว้ไม่อยู่ใน icons ที่ให้มา —
  // เจอ value แปลกๆ แค่ตกไปโชว์ fallbackValue แทน ไม่คุ้มโหลดทั้งชุดเพื่อไอคอนเดียว
  // true (ค่าเริ่มต้น) ไว้ใช้เฉพาะหน้าเลือกไอคอน (category-icon-picker.tsx) ที่
  // ต้องโชว์ค่าที่บันทึกไว้เดิมให้ตรงจริงตอนแก้ไข
  allowRemoteFallback?: boolean;
  fallbackValue: string;
  icons: MdiIconMap;
  value?: unknown;
};

interface LoadedMdiIcon {
  data: NonNullable<Awaited<ReturnType<typeof loadMdiIconData>>>;
  value: unknown;
}

export function MdiIcon({
  allowRemoteFallback = true,
  fallbackValue,
  icons,
  value,
  ...props
}: MdiIconProps) {
  const [loaded, setLoaded] = useState<LoadedMdiIcon | null>(null);
  const immediate = getMdiIconData(value, icons);
  const fallback = getMdiIconData(fallbackValue, icons);

  useEffect(() => {
    if (immediate || !allowRemoteFallback) return;
    let active = true;

    void loadMdiIconData(value, icons)
      .then((data) => {
        if (active && data) setLoaded({ data, value });
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [allowRemoteFallback, icons, immediate, value]);

  const icon = immediate ?? (loaded && loaded.value === value ? loaded.data : fallback);
  return icon ? <Icon aria-hidden icon={icon} {...props} /> : null;
}
