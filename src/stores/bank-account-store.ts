"use client";

import { create } from "zustand";
import {
  deleteBank,
  deleteBranchAccount,
  fetchBanks,
  fetchBranchAccounts,
  fetchPosTransferAccounts,
  saveBank,
  saveBranchAccount,
} from "@/services/bank-account";
import { getBranchOptions } from "@/services/branch";

interface BankAccountStore {
  deleteBank: typeof deleteBank;
  deleteBranchAccount: typeof deleteBranchAccount;
  fetchBanks: typeof fetchBanks;
  fetchBranchAccounts: typeof fetchBranchAccounts;
  fetchBranches: typeof getBranchOptions;
  fetchPosTransferAccounts: typeof fetchPosTransferAccounts;
  saveBank: typeof saveBank;
  saveBranchAccount: typeof saveBranchAccount;
}

export const useBankAccountStore = create<BankAccountStore>(() => ({
  deleteBank,
  deleteBranchAccount,
  fetchBanks,
  fetchBranchAccounts,
  fetchBranches: getBranchOptions,
  fetchPosTransferAccounts,
  saveBank,
  saveBranchAccount,
}));
