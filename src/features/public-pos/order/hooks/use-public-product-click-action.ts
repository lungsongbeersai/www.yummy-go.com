"use client";

import type { TFunction } from "i18next";
import { useCallback } from "react";
import type { MutableRefObject } from "react";
import type { CateProductItem } from "@/services/pos";
import {
  publicMenuKindToStatusSortFk,
  type PublicMenuKind,
  usePublicPosStore,
} from "@/stores/public-pos-store";
import type { ToastInput } from "@/stores/toast-store";
import type { PublicAddToCartPayload } from "../types";
import {
  canAddQty,
  defaultOrderQty,
  firstAvailableDetail,
  getDirectAddListPayload,
  getProductBlockedState,
  productNeedsModal,
} from "../utils";

type PublicPosState = ReturnType<typeof usePublicPosStore.getState>;

interface UsePublicProductClickActionParams {
  directAddingRef: MutableRefObject<boolean>;
  handleAddToCart: (
    product: Awaited<ReturnType<PublicPosState["loadProductItem"]>>,
    payload: PublicAddToCartPayload,
    sourceRect?: DOMRect | null,
  ) => Promise<void>;
  lang: string;
  loadProductItem: PublicPosState["loadProductItem"];
  loadingItem: boolean;
  saving: boolean;
  setLoadingProductUuid: (prodUuid: string) => void;
  setProductSheetOpen: (open: boolean) => void;
  setSelectedProductStatusKind: (statusKind: PublicMenuKind) => void;
  submittedSearch: string;
  t: TFunction;
  toast: (toast: ToastInput) => void;
  token: string;
}

export function usePublicProductClickAction({
  directAddingRef,
  handleAddToCart,
  lang,
  loadProductItem,
  loadingItem,
  saving,
  setLoadingProductUuid,
  setProductSheetOpen,
  setSelectedProductStatusKind,
  submittedSearch,
  t,
  toast,
  token,
}: UsePublicProductClickActionParams) {
  return useCallback(
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
      directAddingRef,
      handleAddToCart,
      lang,
      loadProductItem,
      loadingItem,
      saving,
      setLoadingProductUuid,
      setProductSheetOpen,
      setSelectedProductStatusKind,
      submittedSearch,
      t,
      toast,
      token,
    ],
  );
}
