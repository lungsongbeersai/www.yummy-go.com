"use client";

import {
  type ProductOrderSheetProps,
  useProductOrderSheetWorkflow,
} from "../hooks/use-product-order-sheet-workflow";
import { ProductOrderSheetContent } from "./product-order-sheet-content";

export function ProductOrderSheet(props: ProductOrderSheetProps) {
  const workflow = useProductOrderSheetWorkflow(props);

  return <ProductOrderSheetContent workflow={workflow} />;
}
