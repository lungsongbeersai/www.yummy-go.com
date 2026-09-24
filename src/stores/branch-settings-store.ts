"use client";

import {
  deleteBranch,
  getBranches,
  saveBranch,
  type Branch,
  type FetchBranchesParams,
  type SaveBranchInput
} from "@/services/branch";
import { createCrudListStore } from "@/stores/crud-list-store";

// Backs the store-branch settings screen's "branch" tab. Named "*SettingsStore"
// to stay distinct from the existing options-oriented branch-store.ts.
export const useBranchSettingsStore = createCrudListStore<
  Branch,
  SaveBranchInput,
  FetchBranchesParams
>({
  idKey: "branch_uuid",
  list: getBranches,
  save: saveBranch,
  remove: deleteBranch
});
