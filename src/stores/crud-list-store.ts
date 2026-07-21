"use client";

import { create } from "zustand";
import type { ApiEntity, FetchParams, ApiListResponse } from "@/services/shared/types";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage, type AsyncSlice } from "@/stores/store-utils";

interface CrudListStoreConfig<
  Row extends ApiEntity,
  SaveInput extends ApiEntity,
  Params extends FetchParams
> {
  idKey: keyof Row & string;
  list: (params?: Params) => Promise<ApiListResponse<Row>>;
  save: (input: SaveInput) => Promise<Row>;
  remove: (id: string) => Promise<void>;
}

export interface CrudListLoadOptions {
  background?: boolean;
}

export interface CrudListState<
  Row extends ApiEntity,
  SaveInput extends ApiEntity,
  Params extends FetchParams
> extends AsyncSlice {
  rows: Row[];
  total: number;
  totalPages: number;
  search: string;
  hasLoaded: boolean;
  refreshing: boolean;
  setSearch: (search: string) => void;
  load: (params?: Params, options?: CrudListLoadOptions) => Promise<Row[]>;
  save: (input: SaveInput) => Promise<Row>;
  remove: (id: string) => Promise<void>;
  reset: () => void;
}

export function createCrudListStore<
  Row extends ApiEntity,
  SaveInput extends ApiEntity,
  Params extends FetchParams
>({ idKey, list, save, remove }: CrudListStoreConfig<Row, SaveInput, Params>) {
  let loadRequestId = 0;
  const store = create<CrudListState<Row, SaveInput, Params>>((set, get) => ({
    rows: [],
    total: 0,
    totalPages: 1,
    search: "",
    hasLoaded: false,
    loading: false,
    refreshing: false,
    saving: false,
    error: null,
    setSearch: (search) => set({ search }),
    load: async (params = {} as Params, options) => {
      const requestId = ++loadRequestId;
      const isCurrentSession = createSessionGuard();
      const background = Boolean(options?.background && get().hasLoaded);
      set({ error: null, loading: !background, refreshing: background });
      try {
        const result = await list({ ...params, search: params.search ?? get().search } as Params);
        const rows = Array.isArray(result.data) ? result.data : [];
        if (requestId === loadRequestId && isCurrentSession()) {
          set({
            rows,
            total: Number(result.total ?? rows.length),
            totalPages: Number(result.totalPages ?? result.total_page ?? 1),
            hasLoaded: true,
            loading: false,
            refreshing: false
          });
        }
        return rows;
      } catch (error) {
        if (requestId === loadRequestId && isCurrentSession()) {
          set({ error: errorMessage(error), loading: false, refreshing: false });
        }
        throw error;
      }
    },
    save: async (input) => {
      const isCurrentSession = createSessionGuard();
      set({ saving: true, error: null });
      try {
        const row = await save(input);
        if (isCurrentSession()) set({ saving: false });
        return row;
      } catch (error) {
        if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
        throw error;
      }
    },
    remove: async (id) => {
      const isCurrentSession = createSessionGuard();
      set({ saving: true, error: null });
      try {
        await remove(id);
        if (isCurrentSession()) {
          set((state) => ({
            rows: state.rows.filter((row) => String(row[idKey] ?? "") !== id),
            saving: false
          }));
        }
      } catch (error) {
        if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
        throw error;
      }
    },
    reset: () => {
      loadRequestId += 1;
      set({
        rows: [],
        total: 0,
        totalPages: 1,
        search: "",
        hasLoaded: false,
        loading: false,
        refreshing: false,
        saving: false,
        error: null
      });
    }
  }));

  registerSessionStoreReset(`crud:${idKey}`, () => store.getState().reset());
  return store;
}
