"use client";

import { getVatReport, type VatReportParams, type VatReportResponse } from "@/services/report";
import { registerSessionStoreReset } from "@/stores/session-store-registry";
import { createSimpleReportStore } from "./create-report-store";

export const useVatReportStore = createSimpleReportStore<
  VatReportParams, VatReportResponse, { report: VatReportResponse | null }
>({
  key: "vatReport",
  fetch: getVatReport,
  finalize: (report) => ({ report }),
  emptyState: { report: null },
  clearOnStart: true,
});

registerSessionStoreReset("vat-report", () => useVatReportStore.getState().reset());
