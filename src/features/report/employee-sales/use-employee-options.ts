"use client";

import { useEffect } from "react";
import { useEmployeeOptionsStore } from "@/stores/employee-options-store";

export function useEmployeeOptions(branchUuid: string) {
  const loadEmployeeOptions = useEmployeeOptionsStore((state) => state.loadEmployeeOptions);
  const employees = useEmployeeOptionsStore((state) => state.employees);
  const storeBranchUuid = useEmployeeOptionsStore((state) => state.branchUuid);
  const loading = useEmployeeOptionsStore((state) => state.loading);

  useEffect(() => {
    void loadEmployeeOptions(branchUuid).catch(() => undefined);
  }, [loadEmployeeOptions, branchUuid]);

  return { options: storeBranchUuid === branchUuid ? employees : [], loading };
}
