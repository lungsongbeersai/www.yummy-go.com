"use client";

import { getEmployeeSalesReport, type EmployeeSalesParams, type EmployeeSalesResponse } from "@/services/report";
import { registerSessionStoreReset } from "@/stores/session-store-registry";
import { createSimpleReportStore } from "./create-report-store";

export const useEmployeeSalesReportStore = createSimpleReportStore<
  EmployeeSalesParams, EmployeeSalesResponse, { report: EmployeeSalesResponse | null }
>({
  key: "employeeSales",
  fetch: getEmployeeSalesReport,
  finalize: (report) => ({ report }),
  emptyState: { report: null },
  clearOnStart: true,
});

registerSessionStoreReset("employee-sales-report", () => useEmployeeSalesReportStore.getState().reset());
