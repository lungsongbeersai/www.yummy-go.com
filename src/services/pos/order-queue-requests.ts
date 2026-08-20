import { apiClient, apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { requiredItems, requiredText } from "@/services/shared/validators";
import type {
  ConfirmOrderItemsServedInput,
  FetchOrderQueueParams,
  FetchOrderQueueResponse,
  SendToKitchenInput,
  SendToKitchenResponse
} from "@/services/pos/types";

function normalizeError(error: unknown, fallback = "Request failed") {
  if (error instanceof ServiceError) return error;

  return new ServiceError(
    error instanceof Error ? error.message : fallback,
    500,
    error
  );
}

// endpoint นี้ตอบ { status: <รหัสสถานะออเดอร์ตัวเลข>, data, ... } ไม่ใช่ envelope
// มาตรฐาน { status: "success" } จึงเรียก apiClient ตรง ข้าม apiRequest/assertApiSuccess
// เพื่อไม่ให้โดน throw ผิดพลาดทุกครั้งที่ status ที่ query ไปไม่ใช่ "success"
export async function fetchOrderQueue(params: FetchOrderQueueParams) {
  requiredText(params.branch_uuid_fk, "branch_uuid_fk");

  try {
    const response = await apiClient.get<FetchOrderQueueResponse>(
      "/api/v1/posAll/customer_order_queue",
      {
        params: {
          branch_uuid_fk: params.branch_uuid_fk,
          status: params.status,
          lang: toApiLanguage(params.lang)
        }
      }
    );

    return response.data;
  } catch (error) {
    throw normalizeError(error, "Failed to fetch order queue");
  }
}

export const sendToKitchen = (input: SendToKitchenInput) => {
  requiredItems(input.order_item_uuids, "order_item_uuids");

  return apiRequest<SendToKitchenResponse>(
    "patch",
    "/api/v1/pos/customer_order_queue/send_to_kitchen",
    {
      data: {
        order_item_uuids: input.order_item_uuids,
        device_code: input.device_code,
        agent_id: input.agent_id,
        print_mode: input.print_mode,
        lang: toApiLanguage(input.lang)
      }
    }
  );
};

// bulk เวอร์ชันของ confirmOrderItemServed
// endpoint เดียวกัน แต่คิวออเดอร์ส่ง order_item_uuids
// เป็น array เพื่อรองรับหลายรายการพร้อมกัน
export const confirmOrderItemsServed = (
  input: ConfirmOrderItemsServedInput
) => {
  requiredItems(input.order_item_uuids, "order_item_uuids");

  return apiRequest<{ status: string; message: string }>(
    "patch",
    "/api/v1/pos/confirm_order_item_served",
    {
      data: {
        order_item_uuids: input.order_item_uuids,
        lang: toApiLanguage(input.lang)
      }
    }
  );
};