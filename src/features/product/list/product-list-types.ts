import type { Product } from "@/services/product";

export type ProductTableRow = Product & { row_number: number };

export type ProductStatusKey =
  | `notification:${string}`
  | `enabled:${string}`
  | `stock:${string}`
  | `stock-all:${string}`;

export type ProductStockModeValue = 1 | 2;

export type ProductDetailMotion = {
  initial: { opacity: number; y: number; scale: number };
  animate: { opacity: number; y: number; scale: number };
  exit: { opacity: number; y: number; scale: number };
  transition: { duration: number; ease: "easeOut" };
};
