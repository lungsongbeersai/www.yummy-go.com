"use client";

import { create } from "zustand";
import { EMPLOYEE_SALES_ROLE_ID } from "@/config/employee-sales";
import { getEmployeeOptions, type User } from "@/services/user";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

interface EmployeeOptionsState {
  employees: User[];
  branchUuid: string;
  loading: boolean;
  error: string | null;
  loadEmployeeOptions: (branchUuid: string) => Promise<User[]>;
  reset: () => void;
}

let employeeOptionsRequestId = 0;

export const useEmployeeOptionsStore = create<EmployeeOptionsState>((set) => ({
  employees: [],
  branchUuid: "",
  loading: false,
  error: null,
  loadEmployeeOptions: async (branchUuid) => {
    const requestId = ++employeeOptionsRequestId;
    const isCurrentSession = createSessionGuard();
    if (!branchUuid) {
      set({ employees: [], branchUuid: "", loading: false, error: null });
      return [];
    }
    set({ loading: true, error: null });
    try {
      const employees = await getEmployeeOptions(branchUuid, EMPLOYEE_SALES_ROLE_ID);
      if (requestId === employeeOptionsRequestId && isCurrentSession()) {
        set({ employees, branchUuid, loading: false });
      }
      return employees;
    } catch (error) {
      if (requestId === employeeOptionsRequestId && isCurrentSession()) {
        set({ employees: [], branchUuid: "", error: errorMessage(error), loading: false });
      }
      throw error;
    }
  },
  reset: () => {
    employeeOptionsRequestId += 1;
    set({ employees: [], branchUuid: "", loading: false, error: null });
  }
}));

registerSessionStoreReset("employee-options", () => useEmployeeOptionsStore.getState().reset());
