"use client";

import { create } from "zustand";
import { getBranchOptions, type Branch } from "@/services/branch";
import { errorMessage } from "@/stores/store-utils";

interface BranchState {
  branches: Branch[];
  selectedBranchUuid: string;
  storeUuid: string;
  loading: boolean;
  error: string | null;
  loadBranches: (storeUuid?: string, defaultBranchUuid?: string) => Promise<Branch[]>;
  setSelectedBranch: (branchUuid: string) => void;
  getSelectedBranch: () => Branch | null;
  reset: () => void;
}

function getBranchUuid(branch: Branch | null | undefined) {
  return String(branch?.branch_uuid ?? "");
}

function chooseBranchUuid(branches: Branch[], currentBranchUuid: string, defaultBranchUuid = "") {
  const ids = new Set(branches.map(getBranchUuid).filter(Boolean));
  if (currentBranchUuid && ids.has(currentBranchUuid)) return currentBranchUuid;
  if (defaultBranchUuid && ids.has(defaultBranchUuid)) return defaultBranchUuid;
  return getBranchUuid(branches[0]) || defaultBranchUuid;
}

export const useBranchStore = create<BranchState>((set, get) => ({
  branches: [],
  selectedBranchUuid: "",
  storeUuid: "",
  loading: false,
  error: null,
  loadBranches: async (storeUuid = "", defaultBranchUuid = "") => {
    if (!storeUuid) {
      set({
        branches: [],
        selectedBranchUuid: defaultBranchUuid,
        storeUuid: "",
        loading: false,
        error: null
      });
      return [];
    }

    const switchingStore = get().storeUuid !== storeUuid;
    set({
      storeUuid,
      loading: true,
      error: null,
      ...(switchingStore ? { selectedBranchUuid: defaultBranchUuid } : {})
    });
    try {
      const branches = await getBranchOptions(storeUuid);
      const selectedBranchUuid = chooseBranchUuid(
        branches,
        get().selectedBranchUuid,
        defaultBranchUuid
      );
      set({ branches, selectedBranchUuid, storeUuid, loading: false });
      return branches;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  setSelectedBranch: (selectedBranchUuid) => set({ selectedBranchUuid }),
  getSelectedBranch: () => {
    const selectedBranchUuid = get().selectedBranchUuid;
    return get().branches.find((branch) => getBranchUuid(branch) === selectedBranchUuid) ?? null;
  },
  reset: () =>
    set({
      branches: [],
      selectedBranchUuid: "",
      storeUuid: "",
      loading: false,
      error: null
    })
}));
