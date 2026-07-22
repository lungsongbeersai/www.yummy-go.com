import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingState } from "@/components/common/loading-state";
import { ProductFormPage } from "@/features/product/form/product-form-page";

export const metadata: Metadata = {
  title: "ຟອມສິນຄ້າ",
};

export default function Page() {
  return (
    <Suspense fallback={<LoadingState variant="page" />}>
      <ProductFormPage />
    </Suspense>
  );
}
