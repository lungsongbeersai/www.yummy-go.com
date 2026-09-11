"use client";

import { useEffect } from "react";
import type { Zone } from "@/services/zone";
import { useReferenceStore } from "@/stores/reference-store";

const EMPTY_ZONES: Zone[] = [];

// โซนผูกกับสาขา ไม่แบ่งหน้า (เหมือน useEmployeeOptions) — ใช้ useReferenceStore ที่มีการโหลด
// zone options แบบนี้อยู่แล้ว (printer form/list, settings/table) แทนที่จะเขียน store ใหม่ซ้ำ
export function useZoneOptions(branchUuid: string, language: string) {
  const zones = (useReferenceStore(state => state.options.zones) ?? EMPTY_ZONES) as Zone[];
  const loading = useReferenceStore(state => state.loadingKeys.zones ?? false);
  const loadZones = useReferenceStore(state => state.loadZones);

  useEffect(() => {
    if (!branchUuid) return;
    void loadZones(language, branchUuid).catch(() => undefined);
  }, [loadZones, branchUuid, language]);

  return { zones, loading };
}
