"use client";

import Image from "next/image";
import { AlertCircle, ImageIcon, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ProductImageStatus } from "@/config/pos-constants";
import type { CateProductItem, ProdItem } from "@/services/pos";
import type { ProductBlockedState } from "../types";
import { isHexColor, productImageUrl } from "@/features/public-pos/order/product-domain";

export function ProductMedia({
  product,
  variant = "card",
  blockedState,
  blockedLabel,
  preload = false,
}: {
  product: CateProductItem | ProdItem;
  variant?: "card" | "sheet" | "sheetThumb" | "listThumb";
  blockedState?: ProductBlockedState | null;
  blockedLabel?: string;
  preload?: boolean;
}) {
  const imageUrl = productImageUrl(product);
  const colorCandidate = product.prodColor || product.prodImage;
  const colorSwatch =
    product.prodStatusImge === ProductImageStatus.COLOR &&
    isHexColor(colorCandidate)
      ? colorCandidate
      : "";
  const mediaClass =
    variant === "sheet"
      ? "aspect-[16/9]"
      : variant === "sheetThumb"
        ? "aspect-square"
        : variant === "listThumb"
          ? "h-full"
          : "aspect-[4/3]";
  const imageSizes =
    variant === "sheetThumb" || variant === "listThumb"
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
          alt={product.prodName}
          fill
          preload={preload || undefined}
          loading={preload ? undefined : "lazy"}
          quality={60}
          sizes={imageSizes}
          className={cn(
            variant === "listThumb" ? "object-contain p-1.5" : "object-cover",
            blockedState ? "saturate-[0.65]" : "",
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
          "relative grid w-full place-items-center overflow-hidden border-emerald-100 dark:border-border",
          variant === "listThumb" ? "" : "border-b",
          mediaClass,
        )}
        style={{ backgroundColor: colorSwatch }}
      >
        <span className="grid size-14 place-items-center rounded-full bg-black/15 text-white shadow-sm backdrop-blur-sm">
          <Utensils
            className={cn("size-7", blockedState ? "opacity-75" : "")}
            aria-hidden="true"
          />
        </span>
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
        "relative grid w-full place-items-center overflow-hidden bg-linear-to-br from-emerald-50 to-slate-100 text-muted-foreground dark:from-emerald-950/35 dark:to-muted",
        mediaClass,
      )}
    >
      <span className="grid size-14 place-items-center rounded-full bg-background/75 shadow-sm backdrop-blur-sm dark:bg-background/55">
        <ImageIcon
          className={cn("size-7", blockedState ? "opacity-75" : "")}
          aria-hidden="true"
        />
      </span>
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
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-white/20 dark:bg-black/25" />
      <Badge
        className={cn(
          "absolute left-2 top-2 h-6 max-w-[calc(100%-1rem)] gap-1 rounded-full px-2 py-0 text-[11px] font-black leading-none shadow-sm backdrop-blur-sm",
          blockedState === "promotion-ended"
            ? "border-amber-300 bg-amber-50/95 text-amber-800 dark:border-amber-500/50 dark:bg-amber-950/85 dark:text-amber-100"
            : "border-destructive/35 bg-destructive/10 text-destructive dark:bg-destructive/20",
        )}
      >
        <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </Badge>
    </div>
  );
}
