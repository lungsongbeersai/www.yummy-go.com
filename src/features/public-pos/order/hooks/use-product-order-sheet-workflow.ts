"use client";

import { useMemo, useRef, useState } from "react";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
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
  getModalBasePrice,
  getPublicOrderPriceTotals,
  getProductModalMode,
  isDetailAvailable,
  isToppingAvailable,
  maxAvailableQty,
  productModeLabel,
  promotionQuantity,
  togglePublicToppingQty,
  toppingMaxQty,
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

export type PublicProductSelectionIssue =
  | "noAvailableOptions"
  | "invalidProductPrice"
  | "insufficientStock"
  | "invalidQuantity";

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
  const initialDetail = details.find(isDetailAvailable);
  const [detailUuid, setDetailUuid] = useState(
    () => initialDetail?.proDetailUuid ?? "",
  );
  const [toppingQtyByUuid, setToppingQtyByUuid] = useState<
    Record<string, number>
  >({});
  const [rememberedToppingQtyByUuid, setRememberedToppingQtyByUuid] = useState<
    Record<string, number>
  >({});
  const [qty, setQty] = useState(() => defaultOrderQty(initialDetail));
  const [note, setNote] = useState("");

  // เปิดแผงสั่งของสินค้าใหม่ (หรือรายการตัวเลือกเปลี่ยน) = เริ่มกรอกใหม่ทั้งหมด
  useResetOnDeps([details, open, product], () => {
    if (!open || !product) return;
    const nextDetail = details.find(isDetailAvailable);
    setDetailUuid(nextDetail?.proDetailUuid ?? "");
    setQty(defaultOrderQty(nextDetail));
    setToppingQtyByUuid({});
    setRememberedToppingQtyByUuid({});
    setNote("");
  });

  const selectedDetail = useMemo(
    () =>
      details.find((detail) => detail.proDetailUuid === detailUuid) ??
      details.find(isDetailAvailable),
    [detailUuid, details],
  );
  const selectedToppings = useMemo(
    () =>
      toppings.flatMap((topping): PublicSelectedTopping[] => {
        const toppingQty = toppingQtyByUuid[topping.prodToppingUuid] ?? 0;
        return toppingQty >= 1 && isToppingAvailable(topping)
          ? [{ topping, qty: toppingQty }]
          : [];
      }),
    [toppingQtyByUuid, toppings],
  );
  const basePrice = getModalBasePrice(product, selectedDetail, mode);
  const priceTotals = getPublicOrderPriceTotals({
    basePrice,
    productQty: qty,
    toppings: selectedToppings,
  });
  const { productSubtotal, toppingTotal, total: lineTotal } = priceTotals;
  const maxQty = Math.min(
    MAX_OPEN_QTY,
    maxAvailableQty(product, selectedDetail ?? undefined, cart),
  );
  const quantityMeta = promotionQuantity(selectedDetail);
  const qtyStep = quantityMeta.qtyStep;
  const minQty = qtyStep;
  const maxSelectableQty =
    maxQty >= minQty
      ? minQty + Math.floor((maxQty - minQty) / qtyStep) * qtyStep
      : minQty;
  let selectionIssue: PublicProductSelectionIssue | null = null;
  if (!product || !selectedDetail || !isDetailAvailable(selectedDetail)) {
    selectionIssue = "noAvailableOptions";
  } else if (!Number.isFinite(basePrice) || basePrice <= 0) {
    selectionIssue = "invalidProductPrice";
  } else if (maxQty < minQty) {
    selectionIssue = "insufficientStock";
  } else if (
    !Number.isInteger(qty) ||
    qty < minQty ||
    qty > maxSelectableQty ||
    (qty - minQty) % qtyStep !== 0
  ) {
    selectionIssue = "invalidQuantity";
  }
  const canSubmit = selectionIssue === null && !saving;
  const modeLabel = product ? productModeLabel(mode, product, lang) : "";
  const hasSelectableDetails = mode !== "set" && details.length > 1;

  const handleDetailSelect = (nextDetailUuid: string) => {
    const nextDetail = details.find(
      (detail) => detail.proDetailUuid === nextDetailUuid,
    );
    if (!isDetailAvailable(nextDetail)) return;
    setDetailUuid(nextDetailUuid);
    setQty(defaultOrderQty(nextDetail));
  };

  const handleQty = (nextQty: number) => {
    const clampedQty = Math.max(minQty, Math.min(maxSelectableQty, nextQty));
    const validQty =
      minQty + Math.floor((clampedQty - minQty) / qtyStep) * qtyStep;
    setQty(validQty);
  };

  // ต่างจาก handleQty (ปุ่ม +/- ที่ snap เข้ากรอบเสมอ) — พิมพ์เองต้องปล่อยค่าดิบไหลเข้า selectionIssue
  // ให้ตรวจจริง ไม่งั้นพิมพ์เกินสต็อกแล้วโดน snap เงียบๆ จะไม่มีทางเห็น Alert เตือนเลย
  const handleQtyInput = (nextQty: number) => {
    setQty(Number.isFinite(nextQty) ? Math.max(0, Math.floor(nextQty)) : minQty);
  };

  const handleToppingToggle = (toppingUuid: string) => {
    const topping = toppings.find(
      (item) => item.prodToppingUuid === toppingUuid,
    );
    if (!isToppingAvailable(topping)) return;

    const selectedQty = toppingQtyByUuid[toppingUuid];
    if (selectedQty) {
      setRememberedToppingQtyByUuid((remembered) => ({
        ...remembered,
        [toppingUuid]: selectedQty,
      }));
    }
    setToppingQtyByUuid((current) =>
      togglePublicToppingQty(
        current,
        toppingUuid,
        rememberedToppingQtyByUuid[toppingUuid] ?? 1,
        toppingMaxQty(topping),
      ),
    );
  };

  const handleToppingQty = (toppingUuid: string, nextQty: number) => {
    const topping = toppings.find(
      (item) => item.prodToppingUuid === toppingUuid,
    );
    if (!isToppingAvailable(topping)) return;

    setToppingQtyByUuid((current) =>
      changePublicToppingQty(current, toppingUuid, nextQty, toppingMaxQty(topping)),
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
    handleQtyInput,
    handleSubmit,
    handleToppingQty,
    handleToppingToggle,
    hasSelectableDetails,
    lang,
    lineTotal,
    loading,
    maxQty,
    maxSelectableQty,
    mediaRef,
    minQty,
    mode,
    modeLabel,
    note,
    onNoteChange: setNote,
    onOpenChange,
    open,
    product,
    productSubtotal,
    qty,
    qtyStep,
    quantityMeta,
    saving,
    selectedDetail,
    selectionIssue,
    selectedToppings,
    toppingQtyByUuid,
    toppingTotal,
    toppings,
  };
}

export type ProductOrderSheetWorkflow = ReturnType<
  typeof useProductOrderSheetWorkflow
>;
