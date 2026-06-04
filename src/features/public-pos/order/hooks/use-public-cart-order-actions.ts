"use client";

import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CartOrder,
  CateProductItem,
  ChangeType,
  FetchCartStatusRule,
  ProdItem,
} from "@/services/pos";
import type { QRScanResponse } from "@/services/public-pos";
import {
  PUBLIC_MENU_KIND,
  publicMenuKindToStatusSortFk,
  type PublicMenuKind,
  usePublicPosStore,
} from "@/stores/public-pos-store";
import type { ToastInput } from "@/stores/toast-store";
import type { PublicAddToCartPayload } from "@/features/public-pos/order/types";
import {
  buildPublicOrderInput,
  canAddQty,
  defaultOrderQty,
  findExistingCartItem,
  firstAvailableDetail,
  getConfirmableOrderPayload,
  getDirectAddListPayload,
  getOrderItemUuid,
  getProductBlockedState,
  productNeedsModal,
} from "@/features/public-pos/order/utils";

type PublicPosState = ReturnType<typeof usePublicPosStore.getState>;

interface UsePublicCartOrderActionsParams {
  cart: CartOrder[];
  cartOpen: boolean;
  cartStatusRule: FetchCartStatusRule | null;
  confirming: boolean;
  createOrder: PublicPosState["createOrder"];
  deleteItem: PublicPosState["deleteItem"];
  ensureCartLoaded: PublicPosState["ensureCartLoaded"];
  lang: string;
  loadProductItem: PublicPosState["loadProductItem"];
  loadingItem: boolean;
  playCartFlyAnimation: (
    product: CateProductItem | ProdItem,
    sourceRect?: DOMRect | null,
  ) => void;
  saving: boolean;
  submittedSearch: string;
  table: QRScanResponse | null;
  t: TFunction;
  toast: (toast: ToastInput) => void;
  token: string;
  updateQty: PublicPosState["updateQty"];
  confirmKitchen: PublicPosState["confirmKitchen"];
}

export function usePublicCartOrderActions({
  cart,
  cartOpen,
  cartStatusRule,
  confirming,
  createOrder,
  deleteItem,
  ensureCartLoaded,
  lang,
  loadProductItem,
  loadingItem,
  playCartFlyAnimation,
  saving,
  submittedSearch,
  table,
  t,
  toast,
  token,
  updateQty,
  confirmKitchen,
}: UsePublicCartOrderActionsParams) {
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [selectedProductStatusKind, setSelectedProductStatusKind] =
    useState<PublicMenuKind>(PUBLIC_MENU_KIND.NORMAL);
  const [loadingProductUuid, setLoadingProductUuid] = useState("");
  const directAddingRef = useRef(false);

  const handleAddToCart = useCallback(
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
      table,
      t,
      toast,
      token,
      updateQty,
    ],
  );

  const handleProductClick = useCallback(
    (
      product: CateProductItem,
      cateUuid: string,
      statusKind: PublicMenuKind,
      sourceRect?: DOMRect | null,
    ) => {
      const statusSortFk = publicMenuKindToStatusSortFk(statusKind);

      if (
        getProductBlockedState(product, statusSortFk) ||
        loadingItem ||
        saving ||
        directAddingRef.current
      ) {
        return;
      }

      directAddingRef.current = true;
      setSelectedProductStatusKind(statusKind);
      setLoadingProductUuid(product.prod_uuid);

      void (async () => {
        try {
          const directAdd = getDirectAddListPayload(
            product,
            statusSortFk,
            usePublicPosStore.getState().cart,
          );

          if (directAdd.ok) {
            await handleAddToCart(
              directAdd.item,
              directAdd.payload,
              sourceRect,
            );
            return;
          }

          if (directAdd.reason === "sold-out") {
            toast({ title: t("pos.soldOut"), tone: "info" });
            return;
          }

          const item = await loadProductItem({
            t: token,
            lang,
            prod_uuid: product.prod_uuid,
            cate_uuid: cateUuid || undefined,
            search: submittedSearch,
            status_sort_fk: statusSortFk,
          });

          if (productNeedsModal(product, item, statusSortFk)) {
            setProductSheetOpen(true);
            return;
          }

          const detail = firstAvailableDetail(item);

          if (!detail) {
            toast({ title: t("pos.soldOut"), tone: "info" });
            return;
          }

          const qty = defaultOrderQty(detail);

          if (
            !canAddQty(item, detail, qty, usePublicPosStore.getState().cart)
          ) {
            toast({ title: t("pos.soldOut"), tone: "info" });
            return;
          }

          await handleAddToCart(
            item,
            { detail, qty, toppings: [], note: "" },
            sourceRect,
          );
        } catch (error) {
          toast({
            title: t("pos.productLoadFailed"),
            description: error instanceof Error ? error.message : undefined,
            tone: "error",
          });
        } finally {
          directAddingRef.current = false;
          setLoadingProductUuid("");
        }
      })();
    },
    [
      handleAddToCart,
      lang,
      loadProductItem,
      loadingItem,
      saving,
      submittedSearch,
      t,
      toast,
      token,
    ],
  );

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
    productSheetOpen,
    setProductSheetOpen,
    selectedProductStatusKind,
    loadingProductUuid,
    handleAddToCart,
    handleProductClick,
    handleUpdateItemQty,
    handleDeleteItem,
    handleConfirmKitchen,
  };
}
