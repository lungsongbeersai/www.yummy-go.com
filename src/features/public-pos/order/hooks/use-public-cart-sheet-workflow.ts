"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type {
  CartItem,
  CartOrder,
  ChangeType,
  FetchCartStatusRule,
} from "@/services/pos";
import {
  cartGroupTitle,
  getCartReceiptTotals,
  getOrderGrandTotal,
  isCanceledCartItem,
  isConfirmableCartItem,
  isServedCartItem,
  isWaitingStaffConfirmCartItem,
} from "../utils";

export interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartOrder[];
  statusRule: FetchCartStatusRule | null;
  lang: string;
  loading: boolean;
  saving: boolean;
  confirming: boolean;
  onUpdateQty: (
    orderItemUuid: string,
    changeType: ChangeType,
    changeQty?: number,
  ) => void;
  onDeleteItem: (orderItemUuid: string) => void;
  onConfirmKitchen: () => void;
}

export interface CartSheetGroup {
  key: "confirmable" | "waiting-staff" | "kitchen" | "served" | "canceled";
  title: string;
  items: CartItem[];
}

export function usePublicCartSheetWorkflow({
  open,
  onOpenChange,
  cart,
  statusRule,
  lang,
  loading,
  saving,
  confirming,
  onUpdateQty,
  onDeleteItem,
  onConfirmKitchen,
}: CartSheetProps) {
  const { t } = useTranslation();
  const receipt = cart[0] ?? null;
  const allItems = useMemo(
    () => cart.flatMap((order) => order.items ?? []),
    [cart],
  );
  const confirmableItems = useMemo(
    () => allItems.filter((item) => isConfirmableCartItem(item, statusRule)),
    [allItems, statusRule],
  );
  const waitingStaffItems = useMemo(
    () => allItems.filter(isWaitingStaffConfirmCartItem),
    [allItems],
  );
  const kitchenItems = useMemo(
    () =>
      allItems.filter(
        (item) =>
          !isConfirmableCartItem(item, statusRule) &&
          !isWaitingStaffConfirmCartItem(item) &&
          !isServedCartItem(item) &&
          !isCanceledCartItem(item),
      ),
    [allItems, statusRule],
  );
  const servedItems = useMemo(
    () => allItems.filter(isServedCartItem),
    [allItems],
  );
  const canceledItems = useMemo(
    () => allItems.filter(isCanceledCartItem),
    [allItems],
  );
  const total = useMemo(
    () => cart.reduce((sum, order) => sum + getOrderGrandTotal(order), 0),
    [cart],
  );
  const totals = useMemo(() => getCartReceiptTotals(cart), [cart]);
  const invoice = receipt?.order_invoice
    ? `#${receipt.order_invoice}`
    : t("pos.basket");
  const tableName = receipt?.table_name_la || receipt?.table_name_eng || "";
  const groups = useMemo<CartSheetGroup[]>(
    () => [
      {
        key: "confirmable",
        title: cartGroupTitle(confirmableItems, t("pos.newOrder")),
        items: confirmableItems,
      },
      {
        key: "waiting-staff",
        title: cartGroupTitle(
          waitingStaffItems,
          t("pos.cartStatusWaitingConfirm"),
        ),
        items: waitingStaffItems,
      },
      {
        key: "kitchen",
        title: cartGroupTitle(kitchenItems, t("pos.orderInProgress")),
        items: kitchenItems,
      },
      {
        key: "served",
        title: cartGroupTitle(servedItems, t("pos.orderServed")),
        items: servedItems,
      },
      {
        key: "canceled",
        title: cartGroupTitle(canceledItems, t("pos.orderCanceled")),
        items: canceledItems,
      },
    ],
    [
      canceledItems,
      confirmableItems,
      kitchenItems,
      servedItems,
      t,
      waitingStaffItems,
    ],
  );

  return {
    allItems,
    cart,
    confirming,
    confirmableItems,
    groups,
    invoice,
    lang,
    loading,
    onConfirmKitchen,
    onDeleteItem,
    onOpenChange,
    onUpdateQty,
    open,
    saving,
    statusRule,
    tableName,
    total,
    totals,
  };
}

export type PublicCartSheetWorkflow = ReturnType<
  typeof usePublicCartSheetWorkflow
>;
