"use client";

import { type RefObject, useCallback, useRef, useState } from "react";
import type { CateProductItem, ProdItem } from "@/services/pos";
import type { CartFlyAnimationState } from "@/features/public-pos/order/types";
import {
  prefersReducedMotion,
  snapshotRect,
} from "@/features/public-pos/order/utils";

export function useCartFlyAnimation(
  cartTargetRef: RefObject<HTMLButtonElement | null>,
) {
  const [cartFlyAnimations, setCartFlyAnimations] = useState<
    CartFlyAnimationState[]
  >([]);
  const cartFlyAnimationId = useRef(0);

  const playCartFlyAnimation = useCallback(
    (product: CateProductItem | ProdItem, sourceRect?: DOMRect | null) => {
      const targetRect = cartTargetRef.current?.getBoundingClientRect();
      if (!sourceRect || !targetRect || prefersReducedMotion()) return;
      if (
        !sourceRect.width ||
        !sourceRect.height ||
        !targetRect.width ||
        !targetRect.height
      )
        return;

      cartFlyAnimationId.current += 1;
      const animation: CartFlyAnimationState = {
        id: cartFlyAnimationId.current,
        product,
        start: snapshotRect(sourceRect),
        end: snapshotRect(targetRect),
      };

      setCartFlyAnimations((animations) => [...animations, animation]);
    },
    [cartTargetRef],
  );

  const handleCartFlyDone = useCallback((id: number) => {
    setCartFlyAnimations((animations) =>
      animations.filter((animation) => animation.id !== id),
    );
  }, []);

  return {
    cartFlyAnimations,
    playCartFlyAnimation,
    handleCartFlyDone,
  };
}
