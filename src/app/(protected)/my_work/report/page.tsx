import { Suspense } from "react";
import { LoadingState } from "@/components/common/loading-state";
import { EmployeeWorkReportPage } from "@/features/pos/employee-work/employee-work-report-page";

export default function Page() {
  return <Suspense fallback={<LoadingState variant="page" />}><EmployeeWorkReportPage /></Suspense>;
}
