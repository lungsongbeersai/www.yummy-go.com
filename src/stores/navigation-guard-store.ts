"use client";

import { create } from "zustand";

export type GuardedNavigationAction = () => void;
export type NavigationGuard = (action: GuardedNavigationAction) => void;

interface NavigationGuardState {
  guard: NavigationGuard | null;
  setGuard: (guard: NavigationGuard | null) => void;
  run: (action: GuardedNavigationAction) => boolean;
}

// guard เป็น UI wiring ชั่วคราวของหน้าปัจจุบันเท่านั้น ไม่ persist ลง storage
// หน้ารับออเดอร์ใช้จุดกลางนี้ครอบ programmatic navigation ของ shell เช่น notification
// และ logout ซึ่ง document click guard มองไม่เห็น
export const useNavigationGuardStore = create<NavigationGuardState>((set, get) => ({
  guard: null,
  setGuard: (guard) => set({ guard }),
  run: (action) => {
    const guard = get().guard;
    if (!guard) {
      action();
      return false;
    }
    guard(action);
    return true;
  },
}));
