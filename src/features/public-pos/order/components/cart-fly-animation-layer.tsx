"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ImageIcon, Utensils } from "lucide-react";
import {
  ProductImageStatus,
  type CateProductItem,
  type ProdItem,
} from "@/services/pos";
import type { CartFlyAnimationState } from "@/features/public-pos/order/types";
import { isHexColor, productImageUrl } from "@/features/public-pos/order/utils";

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

  useEffect(() => {
    setActive(false);
    const frame = window.requestAnimationFrame(() => setActive(true));
    const timer = window.setTimeout(() => onDone(animation.id), 680);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [animation.id, onDone]);

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
      className="fixed overflow-hidden rounded-2xl border border-white/80 bg-background shadow-2xl shadow-emerald-950/20 will-change-transform"
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
  const colorCandidate = product.prod_color || product.prod_image;
  const colorSwatch =
    product.prod_status_imge === ProductImageStatus.COLOR &&
    isHexColor(colorCandidate)
      ? colorCandidate
      : "";

  if (imageUrl) {
    return (
      <div className="relative h-full w-full bg-emerald-50 dark:bg-muted">
        <Image
          src={imageUrl}
          alt=""
          fill
          loading="eager"
          quality={55}
          sizes="120px"
          className="object-cover"
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
    <div className="grid h-full w-full place-items-center bg-emerald-50 text-primary dark:bg-muted">
      <ImageIcon className="size-8" />
    </div>
  );
}
