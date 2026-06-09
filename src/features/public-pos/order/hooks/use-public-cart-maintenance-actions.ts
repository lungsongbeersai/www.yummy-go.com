"use client";

import type { TFunction } from "i18next";
import { useCallback, useEffect } from "react";
import type { CartOrder, ChangeType } from "@/services/pos";
import { usePublicPosStore } from "@/stores/public-pos-store";
import type { ToastInput } from "@/stores/toast-store";
import { getConfirmableOrderPayload } from "../utils";

type PublicPosState = ReturnType<typeof usePublicPosStore.getState>;

interface UsePublicCartMaintenanceActionsParams {
  cart: CartOrder[];
  cartOpen: boolean;
  cartStatusRule: Parameters<typeof getConfirmableOrderPayload>[1];
  confirming: boolean;
  confirmKitchen: PublicPosState["confirmKitchen"];
  deleteItem: PublicPosState["deleteItem"];
  ensureCartLoaded: PublicPosState["ensureCartLoaded"];
  lang: string;
  t: TFunction;
  toast: (toast: ToastInput) => void;
  token: string;
  updateQty: PublicPosState["updateQty"];
}

export function usePublicCartMaintenanceActions({
  cart,
  cartOpen,
  cartStatusRule,
  confirming,
  confirmKitchen,
  deleteItem,
  ensureCartLoaded,
  lang,
  t,
  toast,
  token,
  updateQty,
}: UsePublicCartMaintenanceActionsParams) {
  const handleUpdateItemQty = useCallback(
    async (orderItemUuid: string, changeType: ChangeType, changeQty = 1) => {
      try {
        await updateQty({
          t: token,
          order_item_uuid: orderItemUuid,
          change_type: changeType,
          change_qty: changeQty,
        });
      } catch (error) {
        toast({
          title: t("pos.orderFailed"),
          description: error instanceof Error ? error.message : undefined,
          tone: "error",
        });
      }
    },
    [t, toast, token, updateQty],
  );

  const handleDeleteItem = useCallback(
    async (orderItemUuid: string) => {
      try {
        await deleteItem({ t: token, order_it_uuid: orderItemUuid });
        toast({ title: t("pos.deleteItem"), tone: "success" });
      } catch (error) {
        toast({
          title: t("pos.orderFailed"),
          description: error instanceof Error ? error.message : undefined,
          tone: "error",
        });
      }
    },
    [deleteItem, t, toast, token],
  );

  const handleConfirmKitchen = useCallback(async () => {
    if (confirming) return;

    const payload = getConfirmableOrderPayload(cart, cartStatusRule);
    if (!payload) return;

    try {
      await confirmKitchen({
        t: token,
        order_uuid: payload.orderUuid,
        order_item_uuids: payload.orderItemUuids,
      });

      toast({ title: t("pos.orderConfirmed"), tone: "success" });
    } catch (error) {
      toast({
        title: t("pos.orderConfirmFailed"),
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    }
  }, [cart, cartStatusRule, confirming, confirmKitchen, t, toast, token]);

  useEffect(() => {
    if (!cartOpen) return;

    void ensureCartLoaded({ t: token, lang }).catch((error) => {
      toast({
        title: t("pos.orderFailed"),
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    });
  }, [cartOpen, ensureCartLoaded, lang, t, toast, token]);

  return {
    handleConfirmKitchen,
    handleDeleteItem,
    handleUpdateItemQty,
  };
}
