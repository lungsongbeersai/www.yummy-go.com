"use client";

import Image from "next/image";
import { AlertCircle, ImageIcon, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ProductImageStatus,
  type CateProductItem,
  type ProdItem,
} from "@/services/pos";
import type { ProductBlockedState } from "../types";
import { isHexColor, productImageUrl } from "../utils";

export function ProductMedia({
  product,
  variant = "card",
  blockedState,
  blockedLabel,
  priority = false,
}: {
  product: CateProductItem | ProdItem;
  variant?: "card" | "sheet" | "sheetThumb";
  blockedState?: ProductBlockedState | null;
  blockedLabel?: string;
  priority?: boolean;
}) {
  const imageUrl = productImageUrl(product);
  const colorCandidate = product.prod_color || product.prod_image;
  const colorSwatch =
    product.prod_status_imge === ProductImageStatus.COLOR &&
    isHexColor(colorCandidate)
      ? colorCandidate
      : "";
  const mediaClass =
    variant === "sheet"
      ? "aspect-[16/9]"
      : variant === "sheetThumb"
        ? "aspect-square"
        : "aspect-[1.05/1]";
  const imageSizes =
    variant === "sheetThumb"
      ? "96px"
      : "(min-width: 1024px) 240px, (min-width: 640px) 30vw, 50vw";

  if (imageUrl) {
    return (
      <div
        className={cn(
          "relative w-full overflow-hidden bg-emerald-50 dark:bg-muted",
          mediaClass,
        )}
      >
        <Image
          src={imageUrl}
          alt={product.prod_name}
          fill
          priority={priority || undefined}
          loading={priority ? undefined : "lazy"}
          quality={60}
          sizes={imageSizes}
          className={cn(
            "object-cover",
            blockedState ? "opacity-65 saturate-[0.55]" : "",
          )}
        />
        <ProductMediaStateOverlay
          blockedState={blockedState}
          label={blockedLabel}
        />
      </div>
    );
  }

  if (colorSwatch) {
    return (
      <div
        className={cn(
          "relative grid w-full place-items-center overflow-hidden border-b border-emerald-100 dark:border-border",
          mediaClass,
        )}
        style={{ backgroundColor: colorSwatch }}
      >
        <Utensils
          className={cn(
            "size-9 text-background/85 drop-shadow",
            blockedState ? "opacity-60 saturate-[0.55]" : "",
          )}
        />
        <ProductMediaStateOverlay
          blockedState={blockedState}
          label={blockedLabel}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative grid w-full place-items-center overflow-hidden bg-emerald-50 text-muted-foreground dark:bg-muted",
        mediaClass,
      )}
    >
      <ImageIcon className={cn("size-9", blockedState ? "opacity-60" : "")} />
      <ProductMediaStateOverlay
        blockedState={blockedState}
        label={blockedLabel}
      />
    </div>
  );
}

function ProductMediaStateOverlay({
  blockedState,
  label,
}: {
  blockedState?: ProductBlockedState | null;
  label?: string;
}) {
  if (!blockedState || !label) return null;

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-white/35 dark:bg-black/35" />
      <Badge
        className={cn(
          "absolute left-2 top-2 h-6 max-w-[calc(100%-1rem)] gap-1 rounded-full px-2 py-0 text-[10px] font-black leading-none shadow-sm backdrop-blur-sm",
          blockedState === "promotion-ended"
            ? "border-amber-300 bg-amber-50/95 text-amber-800 dark:border-amber-500/50 dark:bg-amber-950/85 dark:text-amber-100"
            : "border-destructive/35 bg-destructive/10 text-destructive dark:bg-destructive/20",
        )}
      >
        <AlertCircle className="size-3 shrink-0" />
        <span className="truncate">{label}</span>
      </Badge>
    </div>
  );
}
