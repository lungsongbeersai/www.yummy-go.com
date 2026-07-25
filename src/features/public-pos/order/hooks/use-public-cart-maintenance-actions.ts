"use client";

import type { TFunction } from "i18next";
import { useCallback, useEffect, useState } from "react";
import type { CartItem, CartOrder, ChangeType } from "@/services/pos";
import { usePublicPosStore } from "@/stores/public-pos-store";
import type { ToastInput } from "@/stores/toast-store";
import { getConfirmableOrderPayload, getOrderItemUuid } from "@/features/public-pos/order/cart-domain";

type PublicPosState = ReturnType<typeof usePublicPosStore.getState>;

interface UsePublicCartMaintenanceActionsParams {
  cart: CartOrder[];
  cartOpen: boolean;
  cartStatusRule: Parameters<typeof getConfirmableOrderPayload>[1];
  confirming: boolean;
  confirmKitchen: PublicPosState["confirmKitchen"];
  deleteItem: PublicPosState["deleteItem"];
  loadCart: PublicPosState["loadCart"];
  lang: string;
  t: TFunction;
  toast: (toast: ToastInput) => void;
  token: string;
  updateNote: PublicPosState["updateNote"];
  updateQty: PublicPosState["updateQty"];
}

export function usePublicCartMaintenanceActions({
  cart,
  cartOpen,
  cartStatusRule,
  confirming,
  confirmKitchen,
  deleteItem,
  loadCart,
  lang,
  t,
  toast,
  token,
  updateNote,
  updateQty,
}: UsePublicCartMaintenanceActionsParams) {
  const [noteTarget, setNoteTarget] = useState<CartItem | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

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

  const handleOpenNoteDialog = useCallback((item: CartItem) => {
    setNoteTarget(item);
    setNoteDraft(item.detail?.order_it_note ?? "");
  }, []);

  const handleNoteDialogOpenChange = useCallback((open: boolean) => {
    if (open) return;

    setNoteTarget(null);
    setNoteDraft("");
  }, []);

  const handleUpdateItemNote = useCallback(async () => {
    const orderItemUuid = noteTarget ? getOrderItemUuid(noteTarget) : "";
    if (!orderItemUuid) return;

    try {
      await updateNote({
        t: token,
        order_it_uuid: orderItemUuid,
        order_it_note: noteDraft.trim(),
      });
      toast({ title: t("pos.noteUpdated"), tone: "success" });
      setNoteTarget(null);
      setNoteDraft("");
    } catch (error) {
      toast({
        title: t("pos.noteUpdateFailed"),
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    }
  }, [noteDraft, noteTarget, t, toast, token, updateNote]);

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

    void loadCart({ t: token, lang }).catch((error) => {
      toast({
        title: t("pos.orderFailed"),
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    });
  }, [cartOpen, lang, loadCart, t, toast, token]);

  return {
    handleConfirmKitchen,
    handleDeleteItem,
    handleNoteDialogOpenChange,
    handleOpenNoteDialog,
    handleUpdateItemNote,
    handleUpdateItemQty,
    noteDraft,
    noteTarget,
    setNoteDraft,
  };
}
