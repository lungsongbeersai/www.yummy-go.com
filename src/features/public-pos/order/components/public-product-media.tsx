"use client";

import Image from "next/image";
import { ImageIcon, Utensils } from "lucide-react";
import { IMAGE_CROP_ASPECT_CLASS } from "@/config/image-crop";
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
  // รูปสินค้าในระบบมีสัดส่วนปนกันตั้งแต่แนวตั้งถึง 16:9 เพราะมาจาก 2 เส้นทาง
  // (ผ่านเครื่องมือตัดรูป กับอัปตรงโดยไม่ตัด) จึงใช้ object-contain ให้เห็นรูปครบตามที่ตัดไว้จริง
  // กล่องยังคงสัดส่วนมาตรฐานไว้ให้กริดเรียงสวย รูปที่ตัดมาตรงสัดส่วนแล้วจะเต็มกล่องพอดีไม่มีขอบ
  // variant sheet = แบนเนอร์เต็มความกว้างหัวโมดัล ความสูงคุมจากกล่องภายนอก
  const fillsParent = variant === "listThumb" || variant === "sheet";
  const mediaClass = fillsParent ? "h-full" : IMAGE_CROP_ASPECT_CLASS;
  const imageSizes =
    variant === "sheetThumb" || variant === "listThumb"
      ? "96px"
      : variant === "sheet"
        ? "(min-width: 640px) 500px, 96vw"
        : "(min-width: 1024px) 240px, (min-width: 640px) 30vw, 50vw";

  if (imageUrl) {
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
          quality={60}
          sizes={imageSizes}
          className={cn(
            "object-contain",
            variant === "listThumb" ? "p-1.5" : "",
            blockedState ? "saturate-[0.55]" : "",
          )}
        />
        <ProductMediaStateOverlay
          blockedState={blockedState}
          label={blockedLabel}
          compact={variant === "listThumb" || variant === "sheetThumb"}
        />
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
        style={{ backgroundColor: colorSwatch }}
      >
        <span className="grid size-14 place-items-center rounded-full bg-black/20 text-white backdrop-blur-sm">
          <Utensils
            className={cn("size-7", blockedState ? "opacity-75" : "")}
            aria-hidden="true"
          />
        </span>
        <ProductMediaStateOverlay
          blockedState={blockedState}
          label={blockedLabel}
          compact={variant === "listThumb" || variant === "sheetThumb"}
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
      <ProductMediaStateOverlay
        blockedState={blockedState}
        label={blockedLabel}
        compact={variant === "listThumb" || variant === "sheetThumb"}
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
