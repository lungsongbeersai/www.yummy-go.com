"use client";

import { create } from "zustand";
import {
  deleteDeportment,
  getAllDeportments,
  saveDeportment,
  type Deportment
} from "@/services/deportment";
import {
  deletePosition,
  getAllPositions,
  savePosition,
  type Position
} from "@/services/position";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

export type UserTaxonomyKind = "deportment" | "position";

export interface UserTaxonomyInput {
  uuid?: string;
  code: string;
  nameLa: string;
  nameEng: string;
  active: number;
}

interface UserTaxonomyState {
  deportments: Deportment[];
  positions: Position[];
  loading: boolean;
  saving: boolean;
  deletingId: string;
  error: string | null;
  load: (kind: UserTaxonomyKind, lang?: string) => Promise<void>;
  save: (kind: UserTaxonomyKind, input: UserTaxonomyInput, lang?: string) => Promise<string>;
  remove: (kind: UserTaxonomyKind, uuid: string, lang?: string) => Promise<void>;
  reset: () => void;
}

export const useUserTaxonomyStore = create<UserTaxonomyState>((set) => ({
  deportments: [],
  positions: [],
  loading: false,
  saving: false,
  deletingId: "",
  error: null,
  load: async (kind, lang) => {
    const isCurrentSession = createSessionGuard();
    set({ error: null, loading: true });
    try {
      if (kind === "position") {
        const positions = await getAllPositions(lang);
        if (isCurrentSession()) set({ loading: false, positions });
      } else {
        const deportments = await getAllDeportments(lang);
        if (isCurrentSession()) set({ deportments, loading: false });
      }
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  save: async (kind, input, lang) => {
    const isCurrentSession = createSessionGuard();
    set({ error: null, saving: true });
    try {
      if (kind === "position") {
        const saved = await savePosition({
          position_uuid: input.uuid,
          position_code: input.code,
          position_name_la: input.nameLa,
          position_name_eng: input.nameEng,
          position_active: input.active
        });
        const positions = await getAllPositions(lang);
        if (isCurrentSession()) set({ positions, saving: false });
        return saved?.position_uuid || input.uuid || "";
      }

      const saved = await saveDeportment({
        deportment_uuid: input.uuid,
        deportment_code: input.code,
        deportment_name_la: input.nameLa,
        deportment_name_eng: input.nameEng,
        deportment_active: input.active
      });
      const deportments = await getAllDeportments(lang);
      if (isCurrentSession()) set({ deportments, saving: false });
      return saved?.deportment_uuid || input.uuid || "";
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  remove: async (kind, uuid, lang) => {
    const isCurrentSession = createSessionGuard();
    set({ deletingId: uuid, error: null });
    try {
      if (kind === "position") {
        await deletePosition(uuid);
        const positions = await getAllPositions(lang);
        if (isCurrentSession()) set({ deletingId: "", positions });
      } else {
        await deleteDeportment(uuid);
        const deportments = await getAllDeportments(lang);
        if (isCurrentSession()) set({ deletingId: "", deportments });
      }
    } catch (error) {
      if (isCurrentSession()) set({ deletingId: "", error: errorMessage(error) });
      throw error;
    }
  },
  reset: () => set({
    deletingId: "",
    deportments: [],
    error: null,
    loading: false,
    positions: [],
    saving: false
  })
}));

registerSessionStoreReset("user-taxonomy", () => useUserTaxonomyStore.getState().reset());
