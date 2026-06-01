import { binaryNumber, requiredUuid } from "@/services/shared/validators";
import type {
  ProductEnabledPatch,
  ProductNotificationPatch,
  ProductStockModePatch
} from "@/services/product/types";

export function enabledPatch(
  input: ProductEnabledPatch | string,
  pro_detail_enabled?: number
): ProductEnabledPatch {
  const patch =
    typeof input === "string"
      ? { pro_detail_uuid: input, pro_detail_enabled: Number(pro_detail_enabled) }
      : input;

  return {
    pro_detail_uuid: requiredUuid(patch.pro_detail_uuid, "pro_detail_uuid"),
    pro_detail_enabled: binaryNumber(patch.pro_detail_enabled, "pro_detail_enabled")
  };
}

export function stockModePatch(
  input: ProductStockModePatch | string,
  pro_detail_stock?: number
): ProductStockModePatch {
  const patch =
    typeof input === "string"
      ? { pro_detail_uuid: input, pro_detail_stock: Number(pro_detail_stock) }
      : input;

  return {
    pro_detail_uuid: requiredUuid(patch.pro_detail_uuid, "pro_detail_uuid"),
    pro_detail_stock: binaryNumber(patch.pro_detail_stock, "pro_detail_stock")
  };
}

export function notificationPatch(
  input: ProductNotificationPatch | string,
  prod_notification?: number
): ProductNotificationPatch {
  const patch =
    typeof input === "string"
      ? { prod_uuid: input, prod_notification: Number(prod_notification) }
      : input;

  return {
    prod_uuid: requiredUuid(patch.prod_uuid, "prod_uuid"),
    prod_notification: binaryNumber(patch.prod_notification, "prod_notification")
  };
}
