"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CartOrder, ProdItem } from "@/services/pos";
import {
  publicMenuKindToStatusSortFk,
  type PublicMenuKind,
} from "@/stores/public-pos-store";
import { MAX_OPEN_QTY } from "../constants";
import type {
  PublicAddToCartPayload,
  PublicSelectedTopping,
} from "../types";
import {
  changePublicToppingQty,
  defaultOrderQty,
  firstAvailableDetail,
  formatMoney,
  getModalBasePrice,
  getProductModalMode,
  isDetailAvailable,
  isToppingAvailable,
  maxAvailableQty,
  numeric,
  productModeLabel,
  promotionQuantity,
  togglePublicToppingQty,
} from "../utils";

export interface ProductOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProdItem | null;
  statusKind: PublicMenuKind;
  cart: CartOrder[];
  lang: string;
  loading: boolean;
  saving: boolean;
  onAdd: (payload: PublicAddToCartPayload, sourceRect?: DOMRect | null) => void;
}

export function useProductOrderSheetWorkflow({
  open,
  onOpenChange,
  product,
  statusKind,
  cart,
  lang,
  loading,
  saving,
  onAdd,
}: ProductOrderSheetProps) {
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const details = useMemo(() => product?.details ?? [], [product]);
  const toppings = useMemo(() => product?.toppings ?? [], [product]);
  const statusSortFk = publicMenuKindToStatusSortFk(statusKind);
  const mode = useMemo(
    () => getProductModalMode(statusSortFk, product),
    [product, statusSortFk],
  );
  const [detailUuid, setDetailUuid] = useState("");
  const [toppingQtyByUuid, setToppingQtyByUuid] = useState<
    Record<string, number>
  >({});
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open || !product) return;
    const nextDetail = firstAvailableDetail(product) ?? details[0];
    setDetailUuid(nextDetail?.pro_detail_uuid ?? "");
    setQty(defaultOrderQty(nextDetail));
    setToppingQtyByUuid({});
    setNote("");
  }, [details, open, product]);

  const selectedDetail = useMemo(
    () =>
      details.find((detail) => detail.pro_detail_uuid === detailUuid) ??
      firstAvailableDetail(product),
    [detailUuid, details, product],
  );
  const selectedToppings = useMemo(
    () =>
      toppings.flatMap((topping): PublicSelectedTopping[] => {
        const toppingQty = toppingQtyByUuid[topping.prod_topping_uuid] ?? 0;
        return toppingQty >= 1 && isToppingAvailable(topping)
          ? [{ topping, qty: toppingQty }]
          : [];
      }),
    [toppingQtyByUuid, toppings],
  );
  const basePrice = getModalBasePrice(product, selectedDetail, mode);
  const toppingTotal = selectedToppings.reduce(
    (sum, selected) =>
      sum + numeric(selected.topping.topping_price) * selected.qty,
    0,
  );
  const lineTotal = (basePrice + toppingTotal) * qty;
  const maxQty = Math.min(
    MAX_OPEN_QTY,
    maxAvailableQty(product, selectedDetail ?? undefined, cart),
  );
  const quantityMeta = promotionQuantity(selectedDetail);
  const qtyStep = quantityMeta.qtyStep;
  const minQty = qtyStep;
  const maxSelectableQty = maxQty >= minQty ? maxQty : minQty;
  const canSubmit = Boolean(
    product &&
      selectedDetail &&
      isDetailAvailable(selectedDetail) &&
      qty >= minQty &&
      qty <= maxQty &&
      !saving,
  );
  const modeLabel = product ? productModeLabel(mode, product, lang) : "";
  const hasSelectableDetails = mode !== "set" && details.length > 0;
  const priceLabel =
    mode === "set"
      ? formatMoney(basePrice, lang)
      : selectedDetail
        ? formatMoney(basePrice, lang)
        : "";

  const handleDetailSelect = (nextDetailUuid: string) => {
    const nextDetail = details.find(
      (detail) => detail.pro_detail_uuid === nextDetailUuid,
    );
    setDetailUuid(nextDetailUuid);
    setQty(defaultOrderQty(nextDetail));
  };

  const handleQty = (nextQty: number) => {
    setQty(Math.max(minQty, Math.min(maxSelectableQty, nextQty)));
  };

  const handleToppingToggle = (toppingUuid: string) => {
    const topping = toppings.find(
      (item) => item.prod_topping_uuid === toppingUuid,
    );
    if (!isToppingAvailable(topping)) return;

    setToppingQtyByUuid((current) =>
      togglePublicToppingQty(current, toppingUuid),
    );
  };

  const handleToppingQty = (toppingUuid: string, nextQty: number) => {
    const topping = toppings.find(
      (item) => item.prod_topping_uuid === toppingUuid,
    );
    if (!isToppingAvailable(topping)) return;

    setToppingQtyByUuid((current) =>
      changePublicToppingQty(current, toppingUuid, nextQty),
    );
  };

  const handleSubmit = () => {
    if (!selectedDetail) return;
    onAdd(
      {
        detail: selectedDetail,
        qty,
        toppings: selectedToppings,
        note: note.trim(),
      },
      mediaRef.current?.getBoundingClientRect(),
    );
  };

  return {
    basePrice,
    canSubmit,
    detailUuid,
    details,
    handleDetailSelect,
    handleQty,
    handleSubmit,
    handleToppingQty,
    handleToppingToggle,
    hasSelectableDetails,
    lang,
    lineTotal,
    loading,
    maxQty,
    mediaRef,
    minQty,
    mode,
    modeLabel,
    note,
    onNoteChange: setNote,
    onOpenChange,
    open,
    priceLabel,
    product,
    qty,
    qtyStep,
    quantityMeta,
    saving,
    selectedDetail,
    selectedToppings,
    toppingQtyByUuid,
    toppingTotal,
    toppings,
  };
}

export type ProductOrderSheetWorkflow = ReturnType<
  typeof useProductOrderSheetWorkflow
>;
