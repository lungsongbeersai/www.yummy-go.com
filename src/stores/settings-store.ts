"use client";

import { create } from "zustand";
import type { SettingConfig } from "@/features/settings/shared/settings-config";
import type { FetchParams } from "@/services/shared/types";
import { errorMessage } from "@/stores/store-utils";

interface SettingsEntityState {
  rows: Record<string, unknown>[];
  total: number;
  totalPages: number;
  search: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

interface SettingsState {
  entities: Record<string, SettingsEntityState>;
  getEntity: (slug: string) => SettingsEntityState;
  setSearch: (slug: string, search: string) => void;
  load: (config: SettingConfig, params?: FetchParams) => Promise<Record<string, unknown>[]>;
  save: (config: SettingConfig, input: Record<string, unknown>) => Promise<unknown>;
  remove: (config: SettingConfig, id: string) => Promise<void>;
  reset: (slug?: string) => void;
}

const emptyEntity = (): SettingsEntityState => ({
  rows: [],
  total: 0,
  totalPages: 0,
  search: "",
  loading: false,
  saving: false,
  error: null
});

function patchEntity(
  state: SettingsState,
  slug: string,
  patch: Partial<SettingsEntityState>
): Record<string, SettingsEntityState> {
  return {
    ...state.entities,
    [slug]: { ...(state.entities[slug] ?? emptyEntity()), ...patch }
  };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  entities: {},
  getEntity: (slug) => get().entities[slug] ?? emptyEntity(),
  setSearch: (slug, search) =>
    set((state) => ({ entities: patchEntity(state, slug, { search }) })),
  load: async (config, params = {}) => {
    const current = get().getEntity(config.slug);
    set((state) => ({
      entities: patchEntity(state, config.slug, { loading: true, error: null })
    }));
    try {
      const result = await config.list({ ...params, search: params.search ?? current.search });
      const rows = Array.isArray(result.data) ? result.data : [];
      set((state) => ({
        entities: patchEntity(state, config.slug, {
          rows,
          total: Number(result.total ?? rows.length),
          totalPages: Number(result.totalPages ?? 1),
          loading: false
        })
      }));
      return rows;
    } catch (error) {
      set((state) => ({
        entities: patchEntity(state, config.slug, {
          error: errorMessage(error),
          loading: false
        })
      }));
      throw error;
    }
  },
  save: async (config, input) => {
    set((state) => ({
      entities: patchEntity(state, config.slug, { saving: true, error: null })
    }));
    try {
      const result = await config.save(input);
      set((state) => ({
        entities: patchEntity(state, config.slug, { saving: false })
      }));
      return result;
    } catch (error) {
      set((state) => ({
        entities: patchEntity(state, config.slug, {
          error: errorMessage(error),
          saving: false
        })
      }));
      throw error;
    }
  },
  remove: async (config, id) => {
    set((state) => ({
      entities: patchEntity(state, config.slug, { saving: true, error: null })
    }));
    try {
      await config.remove(id);
      set((state) => ({
        entities: patchEntity(state, config.slug, {
          rows: get().getEntity(config.slug).rows.filter((row) => String(row[config.idKey] ?? "") !== id),
          saving: false
        })
      }));
    } catch (error) {
      set((state) => ({
        entities: patchEntity(state, config.slug, {
          error: errorMessage(error),
          saving: false
        })
      }));
      throw error;
    }
  },
  reset: (slug) =>
    set((state) => {
      if (!slug) return { entities: {} };
      const next = { ...state.entities };
      delete next[slug];
      return { entities: next };
    })
}));
