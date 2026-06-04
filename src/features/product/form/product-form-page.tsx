"use client";

import { ProductFormView } from "./product-form-view";
import { useProductFormWorkflow } from "./use-product-form-workflow";

export function ProductFormPage() {
  const form = useProductFormWorkflow();

  return <ProductFormView form={form} />;
}