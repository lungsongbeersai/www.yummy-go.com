"use client";

import type { TFunction } from "i18next";
import { useRef, useState } from "react";
import type {
  CartOrder,
  CateProductItem,
  FetchCartStatusRule,
  ProdItem,
} from "@/services/pos";
import type { QRScanResponse } from "@/services/public-pos";
import {
  PUBLIC_MENU_KIND,
  type PublicMenuKind,
  usePublicPosStore,
} from "@/stores/public-pos-store";
import type { ToastInput } from "@/stores/toast-store";
import { usePublicAddToCartAction } from "./use-public-add-to-cart-action";
import { usePublicCartMaintenanceActions } from "./use-public-cart-maintenance-actions";
import { usePublicProductClickAction } from "./use-public-product-click-action";

type PublicPosState = ReturnType<typeof usePublicPosStore.getState>;

interface UsePublicCartOrderActionsParams {
  cart: CartOrder[];
  cartOpen: boolean;
  cartStatusRule: FetchCartStatusRule | null;
  confirming: boolean;
  createOrder: PublicPosState["createOrder"];
  deleteItem: PublicPosState["deleteItem"];
  ensureCartLoaded: PublicPosState["ensureCartLoaded"];
  loadCart: PublicPosState["loadCart"];
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
  updateNote: PublicPosState["updateNote"];
  updateQty: PublicPosState["updateQty"];
  confirmKitchen: PublicPosState["confirmKitchen"];
  viewOnly: boolean;
}

export function usePublicCartOrderActions({
  cart,
  cartOpen,
  cartStatusRule,
  confirming,
  createOrder,
  deleteItem,
  ensureCartLoaded,
  loadCart,
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
  updateNote,
  updateQty,
  confirmKitchen,
  viewOnly,
}: UsePublicCartOrderActionsParams) {
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [selectedProductStatusKind, setSelectedProductStatusKind] =
    useState<PublicMenuKind>(PUBLIC_MENU_KIND.NORMAL);
  const [loadingProductUuid, setLoadingProductUuid] = useState("");
  const directAddingRef = useRef(false);

  const handleAddToCart = usePublicAddToCartAction({
    cart,
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
  });
  const handleProductClick = usePublicProductClickAction({
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
    viewOnly,
  });
  const {
    handleConfirmKitchen,
    handleDeleteItem,
    handleNoteDialogOpenChange,
    handleOpenNoteDialog,
    handleOpenQuantityDialog,
    handleQuantityDialogOpenChange,
    handleSubmitQuantity,
    handleUpdateItemNote,
    handleUpdateItemQty,
    noteDraft,
    noteTarget,
    quantityTarget,
    setNoteDraft,
  } = usePublicCartMaintenanceActions({
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
  });

  return {
    productSheetOpen,
    setProductSheetOpen,
    selectedProductStatusKind,
    loadingProductUuid,
    handleAddToCart,
    handleProductClick,
    handleNoteDialogOpenChange,
    handleOpenNoteDialog,
    handleOpenQuantityDialog,
    handleQuantityDialogOpenChange,
    handleSubmitQuantity,
    handleUpdateItemNote,
    handleDeleteItem,
    handleConfirmKitchen,
    handleUpdateItemQty,
    noteDraft,
    noteTarget,
    quantityTarget,
    setNoteDraft,
  };
}
