"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { subscribeOrderQueueChanged, type OrderQueueChangedPayload } from "@/lib/socket";
import { useToastStore } from "@/stores/toast-store";

// reason ที่ backend ส่งมาจาก emitOrderQueueChanged (create.js) — เฉพาะสอง
// ขั้นตอนที่ลูกค้าอยากรู้แบบ real-time: ร้านรับออเดอร์เข้าครัวแล้ว กับ เสิร์ฟแล้ว
const KITCHEN_CONFIRMED_REASONS = new Set(["kitchen_confirmation_submitted"]);
const SERVED_REASONS = new Set(["kitchen_item_served"]);

interface UsePublicOrderStatusNotificationsParams {
  branchUuid?: string;
  orderUuids: string[];
}

// use-public-order-realtime.ts รีเฟรช cart แบบเงียบๆ ทุก event ในสาขา — hook นี้
// ทำหน้าที่ต่างกัน: เด้ง toast บอกลูกค้าตรงๆ ว่าออเดอร์ "ของตัวเอง" (ไม่ใช่โต๊ะ
// อื่น) เพิ่งเข้าสู่ขั้นตอนไหน ใช้ reason จาก order_queue_changed กรองด้วย
// order_uuids ของตัวเองก่อนเด้ง กันไม่ให้ลูกค้าโต๊ะ A เห็น toast ของโต๊ะ B
export function usePublicOrderStatusNotifications({
  branchUuid,
  orderUuids,
}: UsePublicOrderStatusNotificationsParams) {
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.show);
  const orderUuidsRef = useRef(orderUuids);
  useEffect(() => {
    orderUuidsRef.current = orderUuids;
  }, [orderUuids]);

  useEffect(() => {
    if (!branchUuid) return;

    function handleOrderQueueChanged(payload: OrderQueueChangedPayload) {
      const activeOrderUuids = orderUuidsRef.current;
      if (!activeOrderUuids.length) return;

      const affectsOwnOrder = (payload.order_uuids ?? []).some((uuid) =>
        activeOrderUuids.includes(uuid),
      );
      if (!affectsOwnOrder) return;

      const reason = payload.reason ?? "";

      if (KITCHEN_CONFIRMED_REASONS.has(reason)) {
        showToast({
          title: t("notifications.orderStatusToast.kitchenConfirmed.title"),
          description: t("notifications.orderStatusToast.kitchenConfirmed.description"),
          tone: "success",
        });
        return;
      }

      if (SERVED_REASONS.has(reason)) {
        showToast({
          title: t("notifications.orderStatusToast.served.title"),
          description: t("notifications.orderStatusToast.served.description"),
          tone: "success",
        });
      }
    }

    return subscribeOrderQueueChanged(branchUuid, handleOrderQueueChanged);
  }, [branchUuid, showToast, t]);
}
