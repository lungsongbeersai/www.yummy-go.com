"use client";
import { create } from "zustand";
import * as api from "@/services/waiter-requests";
import {
  createSessionGuard,
  registerSessionStoreReset,
} from "@/stores/session-store-registry";
interface WaiterState {
  publicRequests: api.WaiterRequest[];
  staffRequests: api.WaiterRequest[];
  publicKey: string;
  staffKey: string;
  publicLoading: boolean;
  staffLoading: boolean;
  sending: boolean;
  handling: string;
  publicError: string | null;
  staffError: string | null;
  loadPublic: (token: string) => Promise<void>;
  send: (token: string, input: api.SendWaiterRequest) => Promise<boolean>;
  loadStaff: (branch: string) => Promise<void>;
  handle: (id: string, status: 1 | 2) => Promise<void>;
}
const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Unable to load requests";
let publicRun = 0;
let staffRun = 0;
export const useWaiterRequestsStore = create<WaiterState>((set, get) => ({
  publicRequests: [],
  staffRequests: [],
  publicKey: "",
  staffKey: "",
  publicLoading: false,
  staffLoading: false,
  sending: false,
  handling: "",
  publicError: null,
  staffError: null,
  loadPublic: async (token) => {
    const current = createSessionGuard();
    const run = ++publicRun;
    set({
      publicKey: token,
      publicLoading: true,
      publicError: null,
      ...(get().publicKey !== token ? { publicRequests: [] } : {}),
    });
    try {
      const result = await api.fetchCustomerWaiterRequests(token);
      if (current() && run === publicRun)
        set({ publicRequests: result, publicLoading: false });
    } catch (e) {
      if (current() && run === publicRun)
        set({ publicError: errorMessage(e), publicLoading: false });
    }
  },
  send: async (token, input) => {
    if (get().sending) return false;
    const current = createSessionGuard();
    set({ sending: true, publicError: null });
    try {
      const result = await api.sendCustomerWaiterRequest(token, input);
      if (!current()) return false;
      if (get().publicKey === token) {
        ++publicRun;
        set((s) => ({
          publicLoading: false,
          publicRequests: [
            result,
            ...s.publicRequests.filter(
              (r) => r.request_uuid !== result.request_uuid
            ),
          ],
        }));
        void get().loadPublic(token);
      }
      return true;
    } catch (e) {
      if (current() && get().publicKey === token)
        set({ publicError: errorMessage(e) });
      return false;
    } finally {
      if (current()) set({ sending: false });
    }
  },
  loadStaff: async (branch) => {
    const current = createSessionGuard();
    const run = ++staffRun;
    set({
      staffKey: branch,
      staffLoading: true,
      staffError: null,
      ...(get().staffKey !== branch ? { staffRequests: [] } : {}),
    });
    try {
      const result = await api.fetchStaffWaiterRequests();
      if (current() && run === staffRun)
        set({ staffRequests: result, staffLoading: false });
    } catch (e) {
      if (current() && run === staffRun)
        set({ staffError: errorMessage(e), staffLoading: false });
    }
  },
  handle: async (id, status) => {
    if (get().handling) return;
    const current = createSessionGuard();
    const branch = get().staffKey;
    set({ handling: id, staffError: null });
    try {
      await api.updateStaffWaiterRequest(id, status);
      if (current() && get().staffKey === branch) await get().loadStaff(branch);
    } catch (e) {
      if (current() && get().staffKey === branch)
        set({ staffError: errorMessage(e) });
    } finally {
      if (current()) set({ handling: "" });
    }
  },
}));

registerSessionStoreReset("waiter-requests", () => {
  ++publicRun;
  ++staffRun;
  useWaiterRequestsStore.setState({
    publicRequests: [],
    staffRequests: [],
    publicKey: "",
    staffKey: "",
    publicLoading: false,
    staffLoading: false,
    sending: false,
    handling: "",
    publicError: null,
    staffError: null,
  });
});
