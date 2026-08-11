"use client";

import { create } from "zustand";
import type { AppVersionConfig } from "@/lib/app-version";
import { fetchAppVersionConfig } from "@/services/app-version";

interface AppVersionState {
  config: AppVersionConfig | null;
  loadConfig: (signal?: AbortSignal) => Promise<AppVersionConfig | null>;
}

export const useAppVersionStore = create<AppVersionState>((set) => ({
  config: null,
  loadConfig: async (signal) => {
    const config = await fetchAppVersionConfig(signal);
    set({ config });
    return config;
  }
}));
