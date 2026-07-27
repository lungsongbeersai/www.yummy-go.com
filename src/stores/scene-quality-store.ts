"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_SCENE_QUALITY,
  toSceneQualitySetting,
  type SceneQualitySetting
} from "@/lib/scene-quality";

interface SceneQualityState {
  setting: SceneQualitySetting;
  hydrated: boolean;
  setSetting: (setting: SceneQualitySetting) => void;
  setHydrated: (hydrated: boolean) => void;
}

/**
 * ค่าคุณภาพกราฟิกของฉาก 3D หน้า landing — เก็บลง localStorage แยกจาก app-store
 * เพราะเป็นค่าเฉพาะเครื่อง (เครื่องแรงต่างกัน) ไม่ควรติดไปกับ preference อื่นของผู้ใช้
 */
export const useSceneQualityStore = create<SceneQualityState>()(
  persist(
    (set) => ({
      setting: DEFAULT_SCENE_QUALITY,
      hydrated: false,
      setSetting: (setting) => set({ setting }),
      setHydrated: (hydrated) => set({ hydrated })
    }),
    {
      name: "yummy-go-scene-quality",
      partialize: ({ setting }) => ({ setting }),
      skipHydration: true,
      // ค่าใน localStorage อาจเป็นของเวอร์ชันเก่าหรือถูกแก้มือ จึงกรองผ่าน toSceneQualitySetting เสมอ
      merge: (persisted, current) => ({
        ...current,
        setting: toSceneQualitySetting((persisted as { setting?: string } | null)?.setting)
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true)
    }
  )
);
