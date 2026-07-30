"use client";

import { create } from "zustand";
import { fetchPublicPackages, type PackageBillingGroup } from "@/services/package";
import { errorMessage } from "@/stores/store-utils";

// สโตร์แยกจาก package-store ของหลังบ้าน ด้วยเหตุผลเดียวกับ public-pos-store vs pos-store:
// หน้าเว็บก่อนล็อกอินต้องไม่ลาก CRUD/จัดลำดับ/แคตตาล็อกของหลังบ้านติดไปในบันเดิล
// และต้องยิง API ผ่านช่องทางที่ไม่ต้องใช้ token
interface PublicPackageState {
  groups: PackageBillingGroup[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  load: (language?: string) => Promise<void>;
}

export const usePublicPackageStore = create<PublicPackageState>((set, get) => ({
  groups: [],
  loading: false,
  loaded: false,
  error: null,
  async load(language) {
    if (get().loading) return;

    set({ loading: true, error: null });
    try {
      const result = await fetchPublicPackages(language);
      set({ groups: result.groups, loading: false, loaded: true });
    } catch (error) {
      // หน้าแรกต้องไม่พังทั้งหน้าเพราะแพ็กเกจโหลดไม่ได้ — เก็บ error ไว้ให้เซกชันซ่อนตัวเองเงียบ ๆ
      set({ error: errorMessage(error), loading: false, loaded: true });
    }
  }
}));
