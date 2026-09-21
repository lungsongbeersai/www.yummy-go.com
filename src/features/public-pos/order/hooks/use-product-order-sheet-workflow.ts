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
  PublicSelectedTaste,
  PublicSelectedTopping,
} from "../types";
import {
  changePublicToppingQty,
  defaultOrderQty,
  getModalBasePrice,
  getPublicOrderPriceTotals,
  getProductModalMode,
  isDetailAvailable,
  isRequiredTasteSelectionMissing,
  isToppingAvailable,
  isTasteAvailable,
  maxAvailableQty,
  productModeLabel,
  promotionQuantity,
  togglePublicToppingQty,
  toppingMaxQty,
  toppingSelectionLimit,
  tasteSelectionLimit,
  togglePublicTaste,
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
  // ดูเมนูได้อย่างเดียว — เปิด modal เพื่อดูรายละเอียดสินค้าได้ตามปกติ แต่ซ่อนปุ่มสั่งของ
  viewOnly?: boolean;
  // ปุ่ม "สแกน QR เพื่อสั่งอาหาร" ในท้าย modal โหมดดูอย่างเดียว
  onScanQr?: () => void;
  // ปิดการคืนโฟกัสอัตโนมัติของ Radix ตอน modal ปิด — ผู้เรียกจัดการโฟกัสเองหลังปิด
  // (ใช้ตอนกดปุ่มสแกน QR เพื่อโฟกัสไปที่ปุ่มสแกนนอก modal แทนที่จะกลับไปที่การ์ดสินค้าเดิม)
  onCloseAutoFocus?: (event: Event) => void;
}

export type PublicProductSelectionIssue =
  | "noAvailableOptions"
  | "invalidProductPrice"
  | "insufficientStock"
  | "invalidQuantity"
  | "tasteRequired";

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
  viewOnly = false,
  onScanQr,
  onCloseAutoFocus,
}: ProductOrderSheetProps) {
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const details = useMemo(() => product?.details ?? [], [product]);
  const toppings = useMemo(() => product?.toppings ?? [], [product]);
  const tastes = useMemo(() => product?.tastes ?? [], [product]);
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
  const [selectedTastes, setSelectedTastes] = useState<PublicSelectedTaste[]>([]);
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
    setSelectedTastes([]);
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
  const tasteSelectionLimitNow = tasteSelectionLimit(product);
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
  } else if (
    mode !== "set" &&
    isRequiredTasteSelectionMissing(product, selectedTastes.length)
  ) {
    selectionIssue = "tasteRequired";
  }
  const canSubmit = !viewOnly && selectionIssue === null && !saving;
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

  const availableToppingCount = useMemo(
    () => toppings.filter(isToppingAvailable).length,
    [toppings],
  );
  const availableTastes = useMemo(
    () => tastes.filter(isTasteAvailable),
    [tastes],
  );
  const canSelectMoreTastesNow = selectedTastes.length < tasteSelectionLimitNow;

  const handleTasteToggle = (tasteUuid: string) => {
    const taste = availableTastes.find((item) => item.tasteUuid === tasteUuid);
    if (!taste) return;
    setSelectedTastes((current) =>
      togglePublicTaste(current, taste, tasteSelectionLimitNow),
    );
  };
  const toppingSelectionLimitNow = toppingSelectionLimit(
    availableToppingCount,
    product?.prodToppingMaxSelect,
  );
  const canSelectMoreToppingsNow =
    selectedToppings.length < toppingSelectionLimitNow;

  const handleToppingToggle = (toppingUuid: string) => {
    const topping = toppings.find(
      (item) => item.prodToppingUuid === toppingUuid,
    );
    if (!isToppingAvailable(topping)) return;

    const selectedQty = toppingQtyByUuid[toppingUuid];
    // ยังไม่ได้เลือกอยู่ตอนนี้ (selectedQty ว่าง) และครบเพดานจำนวนชนิดแล้ว = ห้ามเลือกเพิ่ม
    // (เช็คซ้ำที่นี่เป็น safety net แม้ checkbox ฝั่ง UI จะ disabled ไว้แล้วก็ตาม)
    if (!selectedQty && !canSelectMoreToppingsNow) return;

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
        tastes: selectedTastes,
        toppings: selectedToppings,
        note: note.trim(),
      },
      mediaRef.current?.getBoundingClientRect(),
    );
  };

  return {
    basePrice,
    canSelectMoreToppings: canSelectMoreToppingsNow,
    canSelectMoreTastes: canSelectMoreTastesNow,
    canSubmit,
    detailUuid,
    details,
    handleDetailSelect,
    handleQty,
    handleQtyInput,
    handleSubmit,
    handleTasteToggle,
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
    selectedTastes,
    selectionIssue,
    selectedToppings,
    toppingQtyByUuid,
    toppingSelectionLimit: toppingSelectionLimitNow,
    toppingTotal,
    toppings,
    tasteSelectionLimit: tasteSelectionLimitNow,
    tastes: availableTastes,
    viewOnly,
    onScanQr,
    onCloseAutoFocus,
  };
}

export type ProductOrderSheetWorkflow = ReturnType<
  typeof useProductOrderSheetWorkflow
>;
