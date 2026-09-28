"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product } from "@/services/product";
import { productColor, productImageSrc } from "./product-list-utils";

export function ProductMedia({ className, row }: { className?: string; row: Product }) {
  const image = productImageSrc(row);
  const color = productColor(row);
  const style = color ? ({ backgroundColor: color } as CSSProperties) : undefined;

  return (
    <span
      className={cn(
        "relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border bg-muted",
        className
      )}
      style={style}
    >
      {image ? (
        <Image
          src={image}
          alt={String(row.prod_name ?? row.prod_name_la ?? row.prod_name_eng ?? "Product")}
          fill
          sizes="64px"
          className="object-contain"
        />
      ) : color ? null : (
        <Package className="text-muted-foreground" />
      )}
    </span>
  );
}
