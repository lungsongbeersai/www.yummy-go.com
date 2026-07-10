"use client";

import { create } from "zustand";
import { getExecutiveDashboard, type FetchExecutiveDashboardParams } from "@/services/dashboard";
import type { ApiEntity } from "@/services/shared/types";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

interface DashboardState {
  data: ApiEntity | null;
  loading: boolean;
  error: string | null;
  lastParams: FetchExecutiveDashboardParams | null;
  load: (params: FetchExecutiveDashboardParams) => Promise<ApiEntity | null>;
  reset: () => void;
}

function dashboardParamsKey(params: FetchExecutiveDashboardParams) {
  return [
    params.branch_uuid_fk,
    params.lang ?? "",
    params.start_date ?? "",
    params.end_date ?? "",
    params.top ?? ""
  ].join("|");
}

let requestSeq = 0;
let inFlight: { key: string; promise: Promise<ApiEntity | null> } | null = null;

export const useDashboardStore = create<DashboardState>((set) => ({
  data: null,
  loading: false,
  error: null,
  lastParams: null,
  load: async (params) => {
    const isCurrentSession = createSessionGuard();
    const key = dashboardParamsKey(params);
    if (inFlight?.key === key) return inFlight.promise;

    const requestId = ++requestSeq;
    set({ loading: true, error: null, lastParams: params });
    const promise = getExecutiveDashboard(params)
      .then((result) => {
        const data = result.data ?? result;
        if (requestId === requestSeq && isCurrentSession()) set({ data, loading: false });
        return data;
      })
      .catch((error) => {
        if (requestId === requestSeq && isCurrentSession()) {
          set({ error: errorMessage(error), loading: false });
        }
        throw error;
      })
      .finally(() => {
        if (inFlight?.promise === promise) inFlight = null;
      });

    inFlight = { key, promise };
    return promise;
  },
  reset: () => {
    requestSeq += 1;
    inFlight = null;
    set({ data: null, error: null, lastParams: null, loading: false });
  }
}));

registerSessionStoreReset("dashboard", () => useDashboardStore.getState().reset());
