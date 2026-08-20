"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_LANGUAGE, type Language } from "@/lib/language";

export type ThemeMode = "light" | "dark";
export type ThemeColor = "emerald" | "blue" | "amber" | "rose" | "violet";
export type FontScale = "sm" | "md" | "lg";

const THEME_COLORS: readonly ThemeColor[] = ["emerald", "blue", "amber", "rose", "violet"];
const FONT_SCALES: readonly FontScale[] = ["sm", "md", "lg"];

interface AppState {
  theme: ThemeMode;
  themeColor: ThemeColor;
  fontScale: FontScale;
  language: Language;
  sidebarOpen: boolean;
  collapsed: boolean;
  hydrated: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setThemeColor: (themeColor: ThemeColor) => void;
  setFontScale: (fontScale: FontScale) => void;
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
      themeColor: "emerald",
      fontScale: "md",
      language: DEFAULT_LANGUAGE,
      sidebarOpen: false,
      collapsed: false,
      hydrated: false,
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
      setThemeColor: (themeColor) => set({ themeColor }),
      setFontScale: (fontScale) => set({ fontScale }),
      setLanguage: (language) => set({ language }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setCollapsed: (collapsed) => set({ collapsed }),
      toggleCollapsed: () => set({ collapsed: !get().collapsed }),
      setHydrated: (hydrated) => set({ hydrated })
    }),
    {
      name: "yummy-go-app",
      partialize: ({ theme, themeColor, fontScale, language, collapsed }) => ({
        theme,
        themeColor,
        fontScale,
        language,
        collapsed
      }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!THEME_COLORS.includes(state.themeColor)) state.setThemeColor("emerald");
        if (!FONT_SCALES.includes(state.fontScale)) state.setFontScale("md");
        state.setHydrated(true);
      }
    }
  )
);
