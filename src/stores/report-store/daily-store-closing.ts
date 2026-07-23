"use client";

import {
  getDailyStoreClosingReport,
  type DailyStoreClosingReportResponse,
  type FetchDailyStoreClosingReportParams
} from "@/services/report";
import { registerSessionStoreReset } from "@/stores/session-store-registry";
import { createSimpleReportStore } from "./create-report-store";
import { normalizeDailyStoreClosingReportResponse, type DailyStoreClosingReport } from "./daily-store-closing-normalizers";

interface DailyStoreClosingReportFields {
  report: DailyStoreClosingReport | null;
}

export const useDailyStoreClosingReportStore = createSimpleReportStore<
  FetchDailyStoreClosingReportParams,
  DailyStoreClosingReportResponse,
  DailyStoreClosingReportFields
>({
  key: "dailyStoreClosing",
  fetch: getDailyStoreClosingReport,
  finalize: (response) => ({ report: normalizeDailyStoreClosingReportResponse(response) }),
  emptyState: { report: null },
  clearOnStart: true
});

registerSessionStoreReset("daily-store-closing-report", () => useDailyStoreClosingReportStore.getState().reset());
