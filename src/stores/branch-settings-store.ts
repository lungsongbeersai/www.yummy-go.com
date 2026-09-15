"use client";

import {
  deleteBranch,
  getBranches,
  saveBranch,
  setBranchOfflineMobileEnabled as setBranchOfflineMobileEnabledRequest,
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

// Kept separate from the generic `save` above: this flips one owner-facing
// switch (see docs/Decisions.md, back-end/api/v1/branch/create.js) and must
// never require the rest of the branch form's VAT/email/QR fields to be valid.
export async function setBranchOfflineMobileEnabled(branchUuid: string, enabled: boolean) {
  const result = await setBranchOfflineMobileEnabledRequest(branchUuid, enabled);
  const resolved = Boolean(result.data?.offline_mobile_enabled ?? enabled);
  useBranchSettingsStore.setState((state) => ({
    rows: state.rows.map((row) =>
      row.branch_uuid === branchUuid ? { ...row, offline_mobile_enabled: resolved } : row
    )
  }));
  return resolved;
}
