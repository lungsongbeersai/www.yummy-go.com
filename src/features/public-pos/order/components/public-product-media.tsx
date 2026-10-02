"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { ImageIcon, Utensils } from "lucide-react";
import { IMAGE_CROP_ASPECT, IMAGE_CROP_ASPECT_CLASS } from "@/config/image-crop";
import { cn } from "@/lib/utils";
import { ProductImageStatus } from "@/config/pos-constants";
import type { CateProductItem, ProdItem } from "@/services/pos";
import type { ProductBlockedState } from "../types";
import { isHexColor, productImageUrl } from "../utils";

// แผ่นพื้นของรูปตามดีไซน์ — ไล่สีอุ่นสองชั้น ชั้นบนเป็นแสง accent เยื้องซ้ายบน
const MEDIA_PLATE_STYLE = {
  backgroundImage:
    "radial-gradient(120% 90% at 30% 16%, var(--yg-media-glow), transparent 56%), linear-gradient(160deg, var(--yg-media-a), var(--yg-media-b))",
} as const;

export function ProductMedia({
  product,
  variant = "card",
  blockedState,
  blockedLabel,
  preload = false,
  overlay,
}: {
  product: CateProductItem | ProdItem;
  variant?: "card" | "sheet" | "sheetThumb" | "listThumb";
  blockedState?: ProductBlockedState | null;
  blockedLabel?: string;
  preload?: boolean;
  /** Pinned to the picture's own box (its corners), e.g. the card's "+" button. Without a
   *  photo it sits on the media box instead. */
  overlay?: ReactNode;
}) {
  const imageUrl = productImageUrl(product);
  const colorCandidate = product.prodColor || product.prodImage;
  const colorSwatch =
    product.prodStatusImge === ProductImageStatus.COLOR &&
    isHexColor(colorCandidate)
      ? colorCandidate
      : "";
  // รูปสินค้าในระบบมีสัดส่วนปนกันตั้งแต่แนวตั้งถึง 16:9 เพราะมาจาก 2 เส้นทาง
  // (ผ่านเครื่องมือตัดรูป กับอัปตรงโดยไม่ตัด) จึงใช้ object-contain ให้เห็นรูปครบตามที่ตัดไว้จริง
  // ไม่ครอป/ซูมเข้าไปเด็ดขาด — กล่องยังคงสัดส่วนมาตรฐานไว้ให้กริดเรียงสวย รูปที่ตัดมาตรงสัดส่วนแล้วจะเต็มกล่องพอดีไม่มีขอบ
  // variant sheet = แบนเนอร์เต็มความกว้างหัวโมดัล ความสูงคุมจากกล่องภายนอก
  const fillsParent = variant === "listThumb" || variant === "sheet";
  const mediaClass = fillsParent ? "h-full" : IMAGE_CROP_ASPECT_CLASS;
  const imageSizes =
    variant === "sheetThumb" || variant === "listThumb"
      ? "96px"
      : variant === "sheet"
        ? "(min-width: 640px) 500px, 96vw"
        : "(min-width: 1024px) 220px, (min-width: 640px) 30vw, calc((100vw - 40px) / 2)";

  if (imageUrl) {
    // Fit each photo without cropping inside a consistent neutral frame.
    // Actions belong to the frame so portrait and landscape photos align.
    if (variant !== "sheet" && variant !== "listThumb") {
      return (
        <div className={cn("relative w-full overflow-hidden bg-yg-panel2", mediaClass)}>
          <FittedTileImage
            alt={product.prodName}
            blocked={Boolean(blockedState)}
            boxRatio={IMAGE_CROP_ASPECT}
            inset={false}
            preload={preload}
            // card 18 − padding 8 and the 14px list thumbnail both give 10; the small sheet thumbnail 8.
            radiusClass={variant === "sheetThumb" ? "rounded-md" : "rounded-lg"}
            sizes={imageSizes}
            src={imageUrl}
          />
          {overlay}
          <ProductMediaStateOverlay
            blockedState={blockedState}
            label={blockedLabel}
            compact={variant === "sheetThumb"}
          />
        </div>
      );
    }

    return (
      <div
        className={cn("relative w-full overflow-hidden", mediaClass)}
        style={MEDIA_PLATE_STYLE}
      >
        <Image
          src={imageUrl}
          alt={product.prodName}
          fill
          preload={preload || undefined}
          // เมนูถูกโหลดฝั่ง client หลัง mount — URL รูปจึงไม่มีอยู่ใน HTML ตอน SSR
          // <link rel=preload> ที่ Next ใส่ให้จึงช่วยไม่ได้ ต้องสั่ง eager/high ที่แท็กรูปตรง ๆ
          // ให้รูปแรกที่อยู่เหนือ fold เริ่มโหลดทันทีที่ mount ไม่ต้องรอ intersection check ของ lazy
          loading={preload ? "eager" : "lazy"}
          fetchPriority={preload ? "high" : undefined}
          quality={75}
          sizes={imageSizes}
          className={cn(variant === "listThumb" ? "object-cover" : "object-contain", blockedState ? "saturate-[0.55]" : "")}
        />
        <ProductMediaStateOverlay blockedState={blockedState} label={blockedLabel} compact={variant === "listThumb"} />
      </div>
    );
  }

  if (colorSwatch) {
    return (
      <div
        className={cn(
          "relative grid w-full place-items-center overflow-hidden",
          fillsParent ? "" : "border-b border-yg-line2",
          mediaClass,
        )}
        style={{ backgroundColor: `color-mix(in srgb, ${colorSwatch} 12%, var(--yg-panel))` }}
      >
        <span className="grid size-14 place-items-center rounded-lg border border-yg-accent-line bg-yg-panel text-yg-accent-strong">
          <Utensils
            className={cn("size-7", blockedState ? "opacity-75" : "")}
            aria-hidden="true"
          />
        </span>
        {overlay}
        <ProductMediaStateOverlay
          blockedState={blockedState}
          label={blockedLabel}
          compact={variant === "sheetThumb"}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative grid w-full place-items-center overflow-hidden text-yg-faint",
        mediaClass,
      )}
      style={MEDIA_PLATE_STYLE}
    >
      <span className="grid size-14 place-items-center rounded-full border border-yg-line bg-yg-panel backdrop-blur-sm">
        <ImageIcon
          className={cn("size-7", blockedState ? "opacity-75" : "")}
          aria-hidden="true"
        />
      </span>
      {overlay}
      <ProductMediaStateOverlay
        blockedState={blockedState}
        label={blockedLabel}
        compact={variant === "sheetThumb"}
      />
    </div>
  );
}

/** ดีไซน์แสดงสถานะ "หมด" เป็นม่านคลุมเต็มแผ่นพร้อมข้อความกลาง
 *  ชัดกว่าป้ายมุมเดิมเมื่อดูจากระยะโต๊ะ */
function ProductMediaStateOverlay({
  blockedState,
  label,
  compact = false,
}: {
  blockedState?: ProductBlockedState | null;
  label?: string;
  compact?: boolean;
}) {
  if (!blockedState || !label) return null;

  return (
    // black/65 คงที่ทั้งสองโหมด ไม่ใช้ --yg-scrim เพราะม่านนี้ทับอยู่บนรูปสินค้า
    // ซึ่งสว่างแค่ไหนก็ได้ — ที่ 65% ตัวอักษรขาวยังได้ 5.0:1 แม้รูปเป็นสีขาวล้วน
    <div
      className="pointer-events-none absolute inset-0 grid place-items-center bg-black/65 px-2 backdrop-blur-[1px]"
      aria-hidden="true"
    >
      <span
        className={cn(
          "lao-tone-text line-clamp-2 text-center font-extrabold tracking-wide text-white",
          compact ? "text-2xs" : "text-xs",
        )}
      >
        {label}
      </span>
    </div>
  );
}

// Rounded corners on a letterboxed picture: with fill + object-contain the corners belong to the
// box, and a picture narrower or shorter than the box keeps square ones. So the image element
// takes the picture's own shape instead: once the file loads its ratio says whether it is wider than the
// box (full width, auto height) or taller (full height, auto width). Pictures are never
// cropped, as before. Until the load the tile shows the contain layout.
function FittedTileImage({
  alt,
  blocked,
  boxRatio,
  children,
  inset,
  preload,
  radiusClass,
  sizes,
  src,
}: {
  alt: string;
  blocked: boolean;
  boxRatio: number;
  children?: ReactNode;
  inset: boolean;
  preload: boolean;
  radiusClass: string;
  sizes: string;
  src: string;
}) {
  const [ratio, setRatio] = useState<{ src: string; value: number } | null>(null);
  const loadedRatio = ratio?.src === src ? ratio.value : null;
  // The picture box: its ratio once known, as wide or as tall as the frame allows.
  const fit = loadedRatio === null ? "h-full w-full" : loadedRatio >= boxRatio ? "h-auto w-full" : "h-full w-auto";

  return (
    // absolute inset gives the frame a definite height, which max-h-full needs.
    <div className={cn("absolute inset-0 flex items-center justify-center", inset ? "p-1.5" : "")}>
      {/* This box is exactly the picture, so children (the "+" button) pin to its corners. */}
      <div
        className={cn("relative max-h-full max-w-full", fit)}
        style={loadedRatio === null ? undefined : { aspectRatio: loadedRatio }}
      >
        <Image
          src={src}
          alt={alt}
          // A placeholder shape only; the real ratio comes from the loaded file.
          width={480}
          height={480}
          preload={preload || undefined}
          loading={preload ? "eager" : "lazy"}
          fetchPriority={preload ? "high" : undefined}
          quality={75}
          sizes={sizes}
          onLoad={(event) => {
            const { naturalHeight, naturalWidth } = event.currentTarget;
            if (naturalWidth && naturalHeight) setRatio({ src, value: naturalWidth / naturalHeight });
          }}
          className={cn(
            "size-full object-contain",
            loadedRatio === null ? "" : radiusClass,
            blocked ? "saturate-[0.55]" : "",
          )}
        />
        {children}
      </div>
    </div>
  );
}
