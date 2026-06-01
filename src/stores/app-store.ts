"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_LANGUAGE, type Language } from "@/lib/language";

export type ThemeMode = "light" | "dark";

interface AppState {
  theme: ThemeMode;
  language: Language;
  sidebarOpen: boolean;
  collapsed: boolean;
  hydrated: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLanguage: (language: Language) => void;
  setSidebarOpen: (open: boolean) => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: "light",
      language: DEFAULT_LANGUAGE,
      sidebarOpen: false,
      collapsed: false,
      hydrated: false,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
      setLanguage: (language) => set({ language }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setCollapsed: (collapsed) => set({ collapsed }),
      toggleCollapsed: () => set({ collapsed: !get().collapsed }),
      setHydrated: (hydrated) => set({ hydrated })
    }),
    {
      name: "yummy-go-app",
      partialize: ({ theme, language, collapsed }) => ({ theme, language, collapsed }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => state?.setHydrated(true)
    }
  )
);
