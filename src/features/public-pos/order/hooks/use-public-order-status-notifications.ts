"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  subscribeOrderQueueChanged,
  type OrderQueueChangedPayload,
} from "@/lib/socket";
import { useToastStore } from "@/stores/toast-store";

// Confirmation success is displayed by PublicSuccessDialog after the API succeeds.
// Keep realtime served notifications independent of that confirmation flow.
const SERVED_REASONS = new Set(["kitchen_item_served"]);

interface UsePublicOrderStatusNotificationsParams {
  branchUuid?: string;
  orderUuids: string[];
}

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
        activeOrderUuids.includes(uuid)
      );
      if (!affectsOwnOrder) return;

      const reason = payload.reason ?? "";

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
