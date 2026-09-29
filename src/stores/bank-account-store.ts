"use client";

import { create } from "zustand";
import {
  fetchBanks,
  fetchBranchAccounts,
  fetchPosTransferAccounts,
  saveBank,
  saveBranchAccount,
} from "@/services/bank-account";

interface BankAccountStore {
  fetchBanks: typeof fetchBanks;
  fetchBranchAccounts: typeof fetchBranchAccounts;
  fetchPosTransferAccounts: typeof fetchPosTransferAccounts;
  saveBank: typeof saveBank;
  saveBranchAccount: typeof saveBranchAccount;
}

export const useBankAccountStore = create<BankAccountStore>(() => ({
  fetchBanks,
  fetchBranchAccounts,
  fetchPosTransferAccounts,
  saveBank,
  saveBranchAccount,
}));
