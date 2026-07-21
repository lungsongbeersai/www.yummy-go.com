import { Suspense } from "react";
import { LoadingState } from "@/components/common/loading-state";
import { PrinterFormPage } from "@/features/printer/form/printer-form-page";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState variant="page" />}>
      <PrinterFormPage />
    </Suspense>
  );
}
