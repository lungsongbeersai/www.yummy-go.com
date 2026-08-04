"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useResetOnChange } from "@/hooks/use-reset-on-change";
import { ImageIcon, Utensils } from "lucide-react";
import { ProductImageStatus } from "@/config/pos-constants";
import type { CateProductItem, ProdItem } from "@/services/pos";
import type { CartFlyAnimationState } from "@/features/public-pos/order/types";
import { prefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import {
  isHexColor,
  productImageUrl,
} from "@/features/public-pos/order/utils";

export function CartFlyAnimationLayer({
  animations,
  onDone,
}: {
  animations: CartFlyAnimationState[];
  onDone: (id: number) => void;
}) {
  if (!animations.length) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-70"
    >
      {animations.map((animation) => (
        <CartFlyAnimationItem
          key={animation.id}
          animation={animation}
          onDone={onDone}
        />
      ))}
    </div>
  );
}

function CartFlyAnimationItem({
  animation,
  onDone,
}: {
  animation: CartFlyAnimationState;
  onDone: (id: number) => void;
}) {
  const [active, setActive] = useState(false);
  const reduceMotion = prefersReducedMotion();

  // เริ่มแอนิเมชันชิ้นใหม่ = กลับไปสถานะตั้งต้นก่อน เพื่อให้ transition เล่นซ้ำได้
  // (ต้องเป็น false ก่อนแล้วค่อย true ในเฟรมถัดไป CSS transition จึงจะทำงาน)
  useResetOnChange(animation.id, () => setActive(false));

  useEffect(() => {
    if (reduceMotion) {
      const frame = window.requestAnimationFrame(() => onDone(animation.id));
      return () => window.cancelAnimationFrame(frame);
    }

    const frame = window.requestAnimationFrame(() => setActive(true));
    const timer = window.setTimeout(() => onDone(animation.id), 680);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [animation.id, onDone, reduceMotion]);

  if (reduceMotion) return null;

  const startWidth = animation.start.width;
  const startHeight = animation.start.height;
  const startX = animation.start.left;
  const startY = animation.start.top;
  const startCenterX = startX + startWidth / 2;
  const startCenterY = startY + startHeight / 2;
  const endCenterX = animation.end.left + animation.end.width / 2;
  const endCenterY = animation.end.top + animation.end.height / 2;

  return (
    <div
      className="fixed overflow-hidden rounded-2xl border border-yg-accent-line bg-yg-bg2 shadow-[0_18px_40px_-16px_var(--yg-accent)] will-change-transform"
      style={{
        left: startX,
        top: startY,
        width: startWidth,
        height: startHeight,
        opacity: active ? 0 : 1,
        transform: active
          ? `translate3d(${endCenterX - startCenterX}px, ${endCenterY - startCenterY}px, 0) scale(0.24)`
          : "translate3d(0, 0, 0) scale(1)",
        transformOrigin: "center",
        transition:
          "transform 620ms cubic-bezier(.2,.8,.2,1), opacity 620ms ease",
      }}
    >
      <FlyProductMedia product={animation.product} />
    </div>
  );
}

function FlyProductMedia({ product }: { product: CateProductItem | ProdItem }) {
  const imageUrl = productImageUrl(product);
  const colorCandidate = product.prodColor || product.prodImage;
  const colorSwatch =
    product.prodStatusImge === ProductImageStatus.COLOR &&
    isHexColor(colorCandidate)
      ? colorCandidate
      : "";

  if (imageUrl) {
    return (
      <div className="relative h-full w-full bg-yg-media-b">
        <Image
          src={imageUrl}
          alt=""
          fill
          loading="eager"
          quality={55}
          sizes="120px"
          className="object-contain"
        />
      </div>
    );
  }

  if (colorSwatch) {
    return (
      <div
        className="grid h-full w-full place-items-center"
        style={{ backgroundColor: colorSwatch }}
      >
        <Utensils className="size-8 text-background/85 drop-shadow" />
      </div>
    );
  }

  return (
    <div className="grid h-full w-full place-items-center bg-yg-media-b text-yg-accent-strong">
      <ImageIcon className="size-8" />
    </div>
  );
}
