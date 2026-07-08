import { ServiceError } from "@/lib/api";
import { binaryNumber, requiredItems, requiredUuid } from "@/services/shared/validators";
import type {
  ProductEnabledPatch,
  ProductNotificationPatch,
  ProductStockModePatch,
  SortProductDetailsByProductInput,
  SortProductsByCategoryInput
} from "@/services/product/types";

function sortNumber(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new ServiceError(`${field} must be a positive integer`, 400);
  }
  return number;
}

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

export function sortProductsByCategoryPayload(
  input: SortProductsByCategoryInput
): SortProductsByCategoryInput {
  return {
    cate_uuid_fk: requiredUuid(input.cate_uuid_fk, "cate_uuid_fk"),
    items: requiredItems(input.items).map((item) => ({
      prod_uuid: requiredUuid(item.prod_uuid, "prod_uuid"),
      prod_sort: sortNumber(item.prod_sort, "prod_sort")
    }))
  };
}

export function sortProductDetailsByProductPayload(
  input: SortProductDetailsByProductInput
): SortProductDetailsByProductInput {
  return {
    prod_uuid_fk: requiredUuid(input.prod_uuid_fk, "prod_uuid_fk"),
    items: requiredItems(input.items).map((item) => ({
      pro_detail_uuid: requiredUuid(item.pro_detail_uuid, "pro_detail_uuid"),
      pro_detail_sort: sortNumber(item.pro_detail_sort, "pro_detail_sort")
    }))
  };
}
