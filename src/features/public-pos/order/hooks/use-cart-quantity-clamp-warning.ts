"use client";

import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef } from "react";
import type { CartOrder } from "@/services/pos";
import type { ToastInput } from "@/stores/toast-store";
import { getCartItemQty, getOrderItemUuid } from "../utils";

// เกินเวลานี้ถือว่า refresh ของ request เดิมหลุดไปแล้ว (เช่น runSavingCartMutation กลืน error ของ
// loadCart ภายในทิ้งเงียบๆ — updateQty ยัง resolve สำเร็จทั้งที่ cart ไม่ได้รีเฟรชจริง) ไม่เอามาเทียบ
// กับ cart ที่รีเฟรชด้วยเหตุผลอื่นทีหลัง ไม่งั้นจะโทษสต็อกผิดรายการ
const PENDING_CHECK_MAX_AGE_MS = 15_000;

// ตะกร้าไม่มีข้อมูลสต็อกติดมาเลย เช็คฝั่ง client ก่อนยิงไม่ได้ — จำ "จำนวนที่ขอ" ไว้ใน ref
// (ไม่ใช่ state เพราะ clear ค่าทิ้งใน useEffect จะโดน lint react-hooks/set-state-in-effect) แล้ว
// รอ cart รีเฟรชจริงจาก server มาเทียบ ถ้า backend เงียบๆ ปรับจำนวนลงเพราะสต็อกไม่พอ (ไม่ error
// กลับมา) จะได้เตือนทัน — ใช้เฉพาะทิศทางเพิ่ม เพราะมีแต่การเพิ่มเท่านั้นที่ชนเพดานสต็อกได้ ถ้าเทียบ
// ตอนลดจำนวนด้วยจะพลาดโทษสต็อกให้กรณีอื่น เช่นเครื่องอื่นแก้ไอเทมเดียวกันพร้อมกัน
//
// จุดที่เรียก updateQty ต้องผ่าน hook นี้ทุกจุด (มี 2 จุดในฝั่ง public-pos: แก้จำนวนในตะกร้า และ
// กดเพิ่มสินค้าที่มีอยู่แล้วซ้ำจากเมนู) ไม่งั้นจุดที่ไม่ผ่านจะไม่มีการเตือนเลย
export function useCartQuantityClampWarning({
  cart,
  t,
  toast,
}: {
  cart: CartOrder[];
  t: TFunction;
  toast: (toast: ToastInput) => void;
}) {
  const pendingRef = useRef<{
    orderItemUuid: string;
    requestedQty: number;
    trackedAt: number;
  } | null>(null);

  const trackIncrease = useCallback((orderItemUuid: string, requestedQty: number) => {
    pendingRef.current = { orderItemUuid, requestedQty, trackedAt: Date.now() };
  }, []);

  const clearPending = useCallback(() => {
    pendingRef.current = null;
  }, []);

  useEffect(() => {
    const pending = pendingRef.current;
    if (!pending) return;

    pendingRef.current = null;
    if (Date.now() - pending.trackedAt > PENDING_CHECK_MAX_AGE_MS) return;

    const matchedItem = cart
      .flatMap((order) => order.items ?? [])
      .find((item) => getOrderItemUuid(item) === pending.orderItemUuid);
    const actualQty = matchedItem ? getCartItemQty(matchedItem) : null;
    if (actualQty !== null && actualQty < pending.requestedQty) {
      toast({
        title: t("pos.cartQuantityAdjusted"),
        description: t("pos.cartQuantityAdjustedDescription", {
          requested: pending.requestedQty,
          actual: actualQty,
        }),
        tone: "info",
      });
    }
  }, [cart, t, toast]);

  return { clearPending, trackIncrease };
}
