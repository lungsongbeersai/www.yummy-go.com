"use client";

import {
  type CartSheetProps,
  usePublicCartSheetWorkflow,
} from "../hooks/use-public-cart-sheet-workflow";
import { CartSheetContent } from "./cart-sheet-content";

export function CartSheet(props: CartSheetProps) {
  const workflow = usePublicCartSheetWorkflow(props);

  return <CartSheetContent workflow={workflow} />;
}
