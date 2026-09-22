"use client";

import { useCallback, useMemo } from "react";
import { OrderItemStatus } from "@/config/pos-constants";
import type { CartItem, CartOrder } from "@/services/pos";
import { usePosStore } from "@/stores/pos-store";
import { primaryCartOrder } from "../table-selection/utils";

// รายการของ "ตัวเอง" (login_uuid ตรงกับผู้เรียก) ที่ยังไม่กด "ยืนยันออเดอร์"
// (WAITING_CONFIRM) บนบิลนี้ -- ฝั่ง client ใช้ตัดสินใจเฉพาะ navigation ภายใน
// ส่วน cleanup เมื่อไม่มี activity 5 นาทีเป็นหน้าที่ Backend (source of truth)
export function myDraftItems(cart: CartOrder | null, userUuid: string): CartItem[] {
  if (!cart?.items?.length || !userUuid) return [];
  return cart.items.filter(
    (item) =>
      Number(item.detail?.order_it_status) === OrderItemStatus.WAITING_CONFIRM &&
      item.detail?.order_it_created_by === userUuid,
  );
}

export type DraftBackDecision = "leave" | "prompt" | "wait";

export function draftBackDecision(
  hasPendingDraft: boolean,
  activeKitchenConfirmations: number,
): DraftBackDecision {
  if (!hasPendingDraft) return "leave";
  return activeKitchenConfirmations > 0 ? "wait" : "prompt";
}

export function useDraftCleanup({
  cart,
  userUuid,
}: {
  cart: CartOrder | CartOrder[] | null;
  userUuid: string;
}) {
  const cleanupDraftOrderItems = usePosStore((state) => state.cleanupDraftOrderItems);
  const activeKitchenConfirmations = usePosStore(
    (state) => state.activeKitchenConfirmations,
  );

  const order = useMemo(() => primaryCartOrder(cart), [cart]);
  const orderUuid = order?.order_uuid ?? "";
  const draftItems = useMemo(() => myDraftItems(order, userUuid), [order, userUuid]);
  const hasPendingDraft = draftItems.length > 0;

  const cleanupNow = useCallback(async () => {
    // เมื่อกดยืนยันแล้ว รายการอาจยังเป็น status 1 บน cart เก่าระหว่างสร้างคิวพิมพ์
    // กับ refresh ห้าม navigation guard ส่ง cleanup มาชนช่วงนั้น
    if (activeKitchenConfirmations > 0) return false;
    if (!orderUuid) return true;
    await cleanupDraftOrderItems({ order_uuid: orderUuid });
    return true;
  }, [activeKitchenConfirmations, cleanupDraftOrderItems, orderUuid]);

  return {
    hasPendingDraft,
    backDecision: draftBackDecision(
      hasPendingDraft,
      activeKitchenConfirmations,
    ),
    cleanupNow,
  };
}
