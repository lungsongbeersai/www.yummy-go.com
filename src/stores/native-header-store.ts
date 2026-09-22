"use client";

import { create } from "zustand";

export interface NativeHeaderRefreshAction {
  loading: boolean;
  onClick: () => void;
}

interface NativeHeaderState {
  refreshAction: NativeHeaderRefreshAction | null;
  setRefreshAction: (refreshAction: NativeHeaderRefreshAction | null) => void;
  // เช่น หน้าอ๋อเดอร์โต๊ะอยากโชว์ชื่อโต๊ะ (เช่น "T01") แทนหัวข้อ static ของ route
  // ("ອໍເດີລູກຄ້າ") — null = ไม่ override ใช้หัวข้อ route ปกติ
  title: string | null;
  setTitle: (title: string | null) => void;
  // หน้าอ๋อเดอร์โต๊ะต้องเตือน draft ที่ยังไม่ยืนยันก่อนออกจากหน้าเสมอ
  // (ดู use-draft-cleanup.ts) — ทั้ง NativeTopBar และปุ่ม Back ของ Android อ่าน override
  // นี้แทน router.back() ตรง ๆ; null = ใช้ navigation fallback ปกติของ shell
  backAction: (() => void) | null;
  setBackAction: (backAction: (() => void) | null) => void;
}

// NativeTopBar (capacitor/top-bar.tsx) เป็น shell chrome ที่ render แยกต้นไม้จาก
// {children} ของหน้า — หน้าลึก ๆ อย่าง table-selection-page.tsx จึงไม่มีทาง prop-drill
// ปุ่มรีเฟรชของตัวเองขึ้นไปให้ top bar ได้ตรง ๆ ใช้ store กลางนี้เป็นทางสื่อสารแทน:
// หน้าที่ต้องการปุ่มรีเฟรชใน top bar ลงทะเบียน action ผ่าน useEffect (พร้อม cleanup
// เคลียร์ตอน unmount กันปุ่มค้างชี้ closure เก่าตอนเปลี่ยนหน้า), NativeTopBar อ่านค่านี้
// แล้วเรนเดอร์ปุ่มถ้ามี — ไม่ persist เพราะเป็น UI wiring ชั่วคราวต่อหน้า ไม่ใช่ข้อมูล
export const useNativeHeaderStore = create<NativeHeaderState>((set) => ({
  refreshAction: null,
  setRefreshAction: (refreshAction) => set({ refreshAction }),
  title: null,
  setTitle: (title) => set({ title }),
  backAction: null,
  setBackAction: (backAction) => set({ backAction })
}));
