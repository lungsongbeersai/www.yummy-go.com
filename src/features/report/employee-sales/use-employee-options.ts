"use client";

import { useEffect, useState } from "react";
import { EMPLOYEE_SALES_ROLE_ID } from "@/config/employee-sales";
import { getEmployeeOptions, type User } from "@/services/user";

export function useEmployeeOptions(branchUuid: string) {
  const [options, setOptions] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!branchUuid) return;
    let active = true;
    queueMicrotask(() => { if (active) setLoading(true); });
    getEmployeeOptions(branchUuid, EMPLOYEE_SALES_ROLE_ID)
      .then(rows => { if (active) setOptions(rows); })
      .catch(() => { if (active) setOptions([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [branchUuid]);

  return { options: branchUuid ? options : [], loading };
}
