"use client";

import type { TFunction } from "i18next";
import { useCallback } from "react";
import type {
  CateProductItem,
  ProdItem,
} from "@/services/pos";
import type { QRScanResponse } from "@/services/public-pos";
import { usePublicPosStore } from "@/stores/public-pos-store";
import type { ToastInput } from "@/stores/toast-store";
import type { PublicAddToCartPayload } from "../types";
import {
  buildPublicOrderInput,
  findExistingCartItem,
  getOrderItemUuid,
} from "../utils";

type PublicPosState = ReturnType<typeof usePublicPosStore.getState>;

interface UsePublicAddToCartActionParams {
  cartStatusRule: Parameters<typeof findExistingCartItem>[3];
  createOrder: PublicPosState["createOrder"];
  ensureCartLoaded: PublicPosState["ensureCartLoaded"];
  lang: string;
  playCartFlyAnimation: (
    product: CateProductItem | ProdItem,
    sourceRect?: DOMRect | null,
  ) => void;
  setProductSheetOpen: (open: boolean) => void;
  table: QRScanResponse | null;
  t: TFunction;
  toast: (toast: ToastInput) => void;
  token: string;
  updateQty: PublicPosState["updateQty"];
}

export function usePublicAddToCartAction({
  cartStatusRule,
  createOrder,
  ensureCartLoaded,
  lang,
  playCartFlyAnimation,
  setProductSheetOpen,
  table,
  t,
  toast,
  token,
  updateQty,
}: UsePublicAddToCartActionParams) {
  return useCallback(
    async (
      product: ProdItem,
      payload: PublicAddToCartPayload,
      sourceRect?: DOMRect | null,
    ) => {
      if (!table?.table_uuid) return;

      try {
        let currentCart = usePublicPosStore.getState().cart;

        try {
          currentCart = await ensureCartLoaded({ t: token, lang });
        } catch {
          currentCart = usePublicPosStore.getState().cart;
        }

        const existingItem = findExistingCartItem(
          currentCart,
          product,
          payload,
          cartStatusRule,
        );

        if (existingItem) {
          const orderItemUuid = getOrderItemUuid(existingItem);

          if (!orderItemUuid) throw new Error(t("pos.orderFailed"));

          await updateQty({
            t: token,
            order_item_uuid: orderItemUuid,
            change_type: "INCREASE",
            change_qty: payload.qty,
          });
        } else {
          await createOrder(
            token,
            buildPublicOrderInput({
              table,
              detail: payload.detail,
              qty: payload.qty,
              toppings: payload.toppings,
              note: payload.note,
              lang,
            }),
          );
        }

        playCartFlyAnimation(product, sourceRect);
        toast({ title: t("pos.orderCreated"), tone: "success" });
        setProductSheetOpen(false);
      } catch (error) {
        toast({
          title: t("pos.orderFailed"),
          description: error instanceof Error ? error.message : undefined,
          tone: "error",
        });
      }
    },
    [
      cartStatusRule,
      createOrder,
      ensureCartLoaded,
      lang,
      playCartFlyAnimation,
      setProductSheetOpen,
      table,
      t,
      toast,
      token,
      updateQty,
    ],
  );
}
