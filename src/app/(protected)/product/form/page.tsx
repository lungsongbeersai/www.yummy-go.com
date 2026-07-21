import { Suspense } from "react";
import { LoadingState } from "@/components/common/loading-state";
import { ProductFormPage } from "@/features/product/form/product-form-page";

export default function Page() {
  return (
    <Suspense fallback={<LoadingState variant="page" />}>
      <ProductFormPage />
    </Suspense>
  );
}
