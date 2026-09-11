"use client";

import { getZoneSalesReport, type ZoneSalesParams, type ZoneSalesResponse } from "@/services/report";
import { registerSessionStoreReset } from "@/stores/session-store-registry";
import { createSimpleReportStore } from "./create-report-store";

export const useZoneSalesReportStore = createSimpleReportStore<
  ZoneSalesParams, ZoneSalesResponse, { report: ZoneSalesResponse | null }
>({
  key: "zoneSalesReport",
  fetch: getZoneSalesReport,
  finalize: (report) => ({ report }),
  emptyState: { report: null },
  clearOnStart: true,
});

registerSessionStoreReset("zone-sales-report", () => useZoneSalesReportStore.getState().reset());
