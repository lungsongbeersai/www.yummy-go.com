"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DRAFT_INACTIVITY_TIMEOUT_MS,
  DRAFT_INACTIVITY_WARNING_MS,
  OrderItemStatus,
} from "@/config/pos-constants";
import type { CartItem, CartOrder } from "@/services/pos";
import { usePosStore } from "@/stores/pos-store";
import { primaryCartOrder } from "../table-selection/utils";

// รายการของ "ตัวเอง" (login_uuid ตรงกับผู้เรียก) ที่ยังไม่กด "ยืนยันออเดอร์"
// (WAITING_CONFIRM) บนบิลนี้ -- ยังไม่เคยตัด stock/ส่งครัว จึงเป็นของที่ cleanup
// ทิ้งได้อย่างปลอดภัยถ้าถูกทิ้งร้าง (ดู cleanup_draft ฝั่ง backend)
export function myDraftItems(cart: CartOrder | null, userUuid: string): CartItem[] {
  if (!cart?.items?.length || !userUuid) return [];
  return cart.items.filter(
    (item) =>
      Number(item.detail?.order_it_status) === OrderItemStatus.WAITING_CONFIRM &&
      item.detail?.order_it_created_by === userUuid,
  );
}

// ลายเซ็นของรายการ draft ของตัวเอง ณ ตอนนี้ -- เปลี่ยนทุกครั้งที่เพิ่ม/แก้จำนวน/
// ลบ/แก้โน้ต (หรือกดยืนยันสำเร็จจนหลุดออกจากรายการนี้ไปเลย) ใช้เป็น activity
// signal เดียวรีเซ็ต inactivity timer แทนการเรียก "reset timer" ด้วยมือจากทุกจุด
// ที่แก้ไข cart กระจายอยู่คนละไฟล์กัน (เช่น use-selected-table-cart-panel-workflow)
export function draftSignature(items: CartItem[]) {
  return items
    .map((item) => {
      const uuid = item.order_it_uuid ?? item.order_item_uuid ?? "";
      const qty = item.qty ?? item.detail?.order_it_qty ?? 0;
      const note = item.detail?.order_it_note ?? "";
      return `${uuid}:${qty}:${note}`;
    })
    .sort()
    .join("|");
}

export function useDraftCleanup({
  cart,
  userUuid,
}: {
  cart: CartOrder | CartOrder[] | null;
  userUuid: string;
}) {
  const cleanupDraftOrderItems = usePosStore((state) => state.cleanupDraftOrderItems);

  const order = useMemo(() => primaryCartOrder(cart), [cart]);
  const orderUuid = order?.order_uuid ?? "";
  const draftItems = useMemo(() => myDraftItems(order, userUuid), [order, userUuid]);
  const hasPendingDraft = draftItems.length > 0;
  const signature = draftSignature(draftItems);
  const signatureRef = useRef(signature);

  const [lastActivityAt, setLastActivityAt] = useState(() => Date.now());
  // showWarning ที่คืนออกไปคือ hasPendingDraft && warningActive เสมอ (ดูด้านล่าง)
  // เก็บแค่ "อยากเตือนไหม" ไว้ในนี้ ไม่ต้องคอยรีเซ็ตตอน draft หมดแล้วแยกอีกที
  const [warningActive, setWarningActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    Math.ceil(DRAFT_INACTIVITY_WARNING_MS / 1000),
  );

  useEffect(() => {
    if (signatureRef.current === signature) return;
    signatureRef.current = signature;
    setLastActivityAt(Date.now());
    setWarningActive(false);
  }, [signature]);

  const cleanupNow = useCallback(async () => {
    if (!orderUuid) return;
    await cleanupDraftOrderItems({ order_uuid: orderUuid });
    setWarningActive(false);
  }, [cleanupDraftOrderItems, orderUuid]);

  const extend = useCallback(() => {
    setLastActivityAt(Date.now());
    setWarningActive(false);
  }, []);

  useEffect(() => {
    if (!hasPendingDraft) return;

    const tick = () => {
      const remaining = DRAFT_INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityAt);

      if (remaining <= 0) {
        setWarningActive(false);
        void cleanupNow();
        return;
      }

      if (remaining <= DRAFT_INACTIVITY_WARNING_MS) {
        setWarningActive(true);
        setSecondsLeft(Math.max(0, Math.ceil(remaining / 1000)));
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [hasPendingDraft, lastActivityAt, cleanupNow]);

  return {
    hasPendingDraft,
    showWarning: hasPendingDraft && warningActive,
    secondsLeft,
    extend,
    cleanupNow,
  };
}
