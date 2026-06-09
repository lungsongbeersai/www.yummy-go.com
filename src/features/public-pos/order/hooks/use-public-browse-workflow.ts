"use client";

import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { usePublicPosStore } from "@/stores/public-pos-store";
import { useToastStore } from "@/stores/toast-store";
import { useCartFlyAnimation } from "./use-cart-fly-animation";
import { usePublicCartOrderActions } from "./use-public-cart-order-actions";
import { usePublicMenuBrowse } from "./use-public-menu-browse";
import { usePublicQrDialog } from "./use-public-qr-dialog";
import { usePublicSearch } from "./use-public-search";
import { totalCartQty } from "../utils";

interface UsePublicBrowseWorkflowParams {
  cartOpen: boolean;
  lang: string;
  onCartOpenChange: (open: boolean) => void;
  token: string;
}

export function usePublicBrowseWorkflow({
  cartOpen,
  lang,
  onCartOpenChange,
  token,
}: UsePublicBrowseWorkflowParams) {
  const { t } = useTranslation();
  const toast = useToastStore((state) => state.show);
  const {
    table,
    menuByKind,
    loadingMenu,
    menuRequestKey,
    cart,
    cartStatusRule,
    cartHydrated,
    loadingCart,
    loadingItem,
    selectedProduct,
    saving,
    confirming,
  } = usePublicPosStore(
    useShallow((state) => ({
      table: state.scan,
      menuByKind: state.menuByKind,
      loadingMenu: state.loadingMenu,
      menuRequestKey: state.menuRequestKey,
      cart: state.cart,
      cartStatusRule: state.cartStatusRule,
      cartHydrated: state.cartHydrated,
      loadingCart: state.loadingCart,
      loadingItem: state.loadingItem,
      selectedProduct: state.selectedProduct,
      saving: state.saving,
      confirming: state.confirming,
    })),
  );
  const {
    setError,
    setSelectedCateUuid,
    ensureCartLoaded,
    loadMenuProducts,
    loadNormalCategoryProducts,
    loadProductItem,
    createOrder,
    updateQty,
    deleteItem,
    confirmKitchen,
  } = usePublicPosStore(
    useShallow((state) => ({
      setError: state.setError,
      setSelectedCateUuid: state.setSelectedCateUuid,
      ensureCartLoaded: state.ensureCartLoaded,
      loadMenuProducts: state.loadMenuProducts,
      loadNormalCategoryProducts: state.loadNormalCategoryProducts,
      loadProductItem: state.loadProductItem,
      createOrder: state.createOrder,
      updateQty: state.updateQty,
      deleteItem: state.deleteItem,
      confirmKitchen: state.confirmKitchen,
    })),
  );

  const cartTargetRef = useRef<HTMLButtonElement | null>(null);
  const { cartFlyAnimations, playCartFlyAnimation, handleCartFlyDone } =
    useCartFlyAnimation(cartTargetRef);
  const cartQty = useMemo(() => totalCartQty(cart), [cart]);
  const search = usePublicSearch({ branchUuid: table?.branch_uuid_fk, lang });
  const browse = usePublicMenuBrowse({
    lang,
    loadMenuProducts,
    loadNormalCategoryProducts,
    menuByKind,
    menuRequestKey,
    searchRun: search.searchRun,
    setError,
    setSelectedCateUuid,
    submittedSearch: search.submittedSearch,
    t,
    toast,
    token,
  });
  const qr = usePublicQrDialog({ table, t, toast });
  const cartActions = usePublicCartOrderActions({
    cart,
    cartOpen,
    cartStatusRule,
    confirming,
    confirmKitchen,
    createOrder,
    deleteItem,
    ensureCartLoaded,
    lang,
    loadProductItem,
    loadingItem,
    playCartFlyAnimation,
    saving,
    submittedSearch: search.submittedSearch,
    table,
    t,
    toast,
    token,
    updateQty,
  });

  return {
    cart,
    cartActions,
    cartFlyAnimations,
    cartHydrated,
    cartOpen,
    cartQty,
    cartStatusRule,
    cartTargetRef,
    confirming,
    browse,
    handleCartFlyDone,
    lang,
    loadingCart,
    loadingItem,
    loadingMenu,
    onCartOpenChange,
    qr,
    saving,
    search,
    selectedProduct,
    table,
  };
}

export type PublicBrowseWorkflow = ReturnType<typeof usePublicBrowseWorkflow>;
