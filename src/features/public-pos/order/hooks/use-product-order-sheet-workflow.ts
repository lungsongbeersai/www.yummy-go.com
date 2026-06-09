"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CartOrder, ProdItem } from "@/services/pos";
import {
  publicMenuKindToStatusSortFk,
  type PublicMenuKind,
} from "@/stores/public-pos-store";
import { MAX_OPEN_QTY } from "../constants";
import type { PublicAddToCartPayload } from "../types";
import {
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
  const [selectedToppingUuids, setSelectedToppingUuids] = useState<string[]>(
    [],
  );
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open || !product) return;
    const nextDetail = firstAvailableDetail(product) ?? details[0];
    setDetailUuid(nextDetail?.pro_detail_uuid ?? "");
    setQty(defaultOrderQty(nextDetail));
    setSelectedToppingUuids([]);
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
      toppings.filter(
        (topping) =>
          selectedToppingUuids.includes(topping.prod_topping_uuid) &&
          isToppingAvailable(topping),
      ),
    [selectedToppingUuids, toppings],
  );
  const basePrice = getModalBasePrice(product, selectedDetail, mode);
  const toppingTotal = selectedToppings.reduce(
    (sum, topping) => sum + numeric(topping.topping_price),
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

    setSelectedToppingUuids((current) =>
      current.includes(toppingUuid)
        ? current.filter((uuid) => uuid !== toppingUuid)
        : [...current, toppingUuid],
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
    selectedToppingUuids,
    toppingTotal,
    toppings,
  };
}

export type ProductOrderSheetWorkflow = ReturnType<
  typeof useProductOrderSheetWorkflow
>;
