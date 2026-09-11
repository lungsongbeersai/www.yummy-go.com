"use client";

import { useEffect } from "react";
import { toApiLanguage } from "@/lib/language";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import { useCustomerStore } from "@/stores/customer-store";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 20;

// ค้นหาลูกค้าแบบ debounce ผ่าน store CRUD ที่มีอยู่แล้ว (ไม่มี endpoint "options" แบบไม่แบ่งหน้า
// เหมือนพนักงาน — ลูกค้าผูกกับร้านทั้งร้าน ไม่ใช่รายสาขา จึงค้นด้วยข้อความแทนการโหลดทั้งหมดมากรองเอง)
// อ่าน rows/loading ตรงจาก store แทน state ในเครื่อง — หน้าจอมี combobox 2 ตัวพร้อมกันเสมอ
// (แถบ desktop + sheet มือถือ ซ่อนกันด้วย CSS ไม่ได้ unmount) enabled กันไม่ให้ตัวที่ปิดอยู่ยิง
// คำขอแย่งกับตัวที่ผู้ใช้กำลังเปิดค้นหาอยู่
export function useCustomerSearch(searchText: string, language: string, enabled: boolean) {
  const user = useAuthStore(state => state.user);
  const storeUuid = authStoreUuid(user);
  const load = useCustomerStore(state => state.load);
  const options = useCustomerStore(state => state.rows);
  const loading = useCustomerStore(state => state.loading);

  useEffect(() => {
    if (!enabled || !storeUuid) return;
    const timer = setTimeout(() => {
      void load({ store_uuid_fk: storeUuid, page: 1, limit: SEARCH_LIMIT, search: searchText, lang: toApiLanguage(language) })
        .catch(() => undefined);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, load, storeUuid, searchText, language]);

  return { options, loading };
}
