import { Suspense } from "react";
import { PrinterFormPage } from "@/features/printer/printer-form-page";

export default function Page() {
  return (
    <Suspense>
      <PrinterFormPage />
    </Suspense>
  );
}
