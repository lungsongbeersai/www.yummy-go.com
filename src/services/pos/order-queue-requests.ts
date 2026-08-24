import { apiRequest } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { requiredItems, requiredText } from "@/services/shared/validators";
import type {
  ConfirmOrderItemsServedInput,
  FetchOrderQueueParams,
  FetchOrderQueueResponse,
  SendToKitchenInput,
  SendToKitchenResponse
} from "@/services/pos/types";

export async function fetchOrderQueue(params: FetchOrderQueueParams) {
  requiredText(params.branch_uuid_fk, "branch_uuid_fk");

  return apiRequest<FetchOrderQueueResponse>(
    "get",
    "/api/v1/posAll/customer_order_queue",
    {
      params: {
        branch_uuid_fk: params.branch_uuid_fk,
        status: params.status,
        lang: toApiLanguage(params.lang)
      }
    },
    "Failed to fetch order queue"
  );
}

export const sendToKitchen = (input: SendToKitchenInput) => {
  requiredItems(input.order_item_uuids, "order_item_uuids");

  return apiRequest<SendToKitchenResponse>(
    "patch",
    "/api/v1/posAll/customer_order_queue/send_to_kitchen",
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
    "/api/v1/posAll/confirm_order_item_served",
    {
      data: {
        order_item_uuids: input.order_item_uuids,
        lang: toApiLanguage(input.lang)
      }
    }
  );
};