import { publicApiClient, publicApiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import type {
  ApiFetchCateProductsResponse,
  ApiProdItemResponse,
} from "@/services/pos/api-types";
import {
  mapApiProdItem,
  normalizeFetchCateProductsResponse,
} from "@/services/pos/normalizers";
import { requiredItems, requiredToken } from "@/services/shared/validators";
import type { EmitTableStatusResponse } from "@/services/pos";
import type {
  CustomerConfirmKitchenInput,
  CustomerCreateOrderInput,
  CustomerDeleteOrderItemParams,
  CustomerEmitTableStatusParams,
  CustomerFetchCartParams,
  CustomerFetchCateProductsParams,
  CustomerGetProdItemParams,
  CustomerUpdateOrderNoteInput,
  CustomerUpdateQtyInput,
  PublicStatusSortResponse,
  QRScanResponse
} from "@/services/public-pos/types";
import type {
  ConfirmToKitchenResponse,
  CreateOrderResponse,
  DeleteOrderItemResponse,
  FetchCartResponse,
  UpdateOrderNoteResponse,
  UpdateQtyResponse
} from "@/services/pos";

function buildCustomerCatalogQuery(
  params: CustomerFetchCateProductsParams,
): Record<string, string | number | undefined> {
  const query: Record<string, string | number | undefined> = {
    t: requiredToken(params.token),
    lang: toApiLanguage(params.lang),
    search: params.search ?? "",
  };

  if (params.cateUuid?.trim()) {
    query.cate_uuid = params.cateUuid;
  }

  return query;
}

function buildCustomerProductBody(params: CustomerGetProdItemParams) {
  return {
    prod_uuid: params.prodUuid,
    lang: toApiLanguage(params.lang),
    cate_uuid: params.cateUuid,
    search: params.search,
    status_sort_fk: params.statusSortFk ?? 1,
  };
}

export function scanTableQR(t: string, lang = "la") {
  return publicApiRequest<QRScanResponse>("get", "/api/v1/pos/customer/qrscan", {
    params: { t: requiredToken(t), lang: toApiLanguage(lang) }
  });
}

export async function fetchCustomerStatusSorts(lang = "la") {
  const result = await publicApiRequest<PublicStatusSortResponse>("get", "/api/v1/status/fetch_all", {
    params: { lang: toApiLanguage(lang) }
  });
  return result.data ?? [];
}

export function fetchCustomerCart(params: CustomerFetchCartParams) {
  return publicApiRequest<FetchCartResponse>("get", "/api/v1/pos/customer/fetch_cart", {
    params: { t: requiredToken(params.t), lang: toApiLanguage(params.lang) }
  });
}

export async function customerFetchCateProducts(params: CustomerFetchCateProductsParams) {
  const response = await publicApiRequest<ApiFetchCateProductsResponse>(
    "get",
    "/api/v1/pos/customer/fetch_cate_products",
    {
      params: buildCustomerCatalogQuery(params),
    },
  );
  return normalizeFetchCateProductsResponse(response);
}

export async function customerGetProdItem(params: CustomerGetProdItemParams) {
  const result = await publicApiRequest<ApiProdItemResponse>(
    "post",
    `/api/v1/pos/customer/get_prod_item?t=${encodeURIComponent(requiredToken(params.token))}`,
    {
      data: buildCustomerProductBody(params),
    },
  );
  return mapApiProdItem(result.data);
}

export function customerCreateOrder(t: string, input: CustomerCreateOrderInput) {
  requiredItems(input.items);
  return publicApiRequest<CreateOrderResponse>(
    "post",
    `/api/v1/posAll/customer/create_order?t=${encodeURIComponent(requiredToken(t))}`,
    { data: input }
  );
}

export function customerUpdateQty(params: CustomerUpdateQtyInput) {
  return publicApiRequest<UpdateQtyResponse>(
    "patch",
    `/api/v1/pos/customer/order_item/update_qty?t=${encodeURIComponent(requiredToken(params.t))}`,
    { data: params }
  );
}

export function customerDeleteOrderItem(params: CustomerDeleteOrderItemParams) {
  return publicApiRequest<DeleteOrderItemResponse>("delete", "/api/v1/pos/customer/delete_order_item", {
    params: { t: requiredToken(params.t), order_it_uuid: params.order_it_uuid }
  });
}

export function customerUpdateOrderNote(params: CustomerUpdateOrderNoteInput) {
  return publicApiRequest<UpdateOrderNoteResponse>(
    "patch",
    `/api/v1/pos/customer/update_note?t=${encodeURIComponent(requiredToken(params.t))}`,
    {
      data: {
        order_it_uuid: params.order_it_uuid,
        order_it_note: params.order_it_note
      }
    }
  );
}

export function customerConfirmKitchen(params: CustomerConfirmKitchenInput) {
  return publicApiRequest<ConfirmToKitchenResponse>(
    "patch",
    `/api/v1/pos/customer/confirm_to_kitchen?t=${encodeURIComponent(requiredToken(params.t))}`,
    { data: params }
  );
}

export function customerEmitTableStatus(params: CustomerEmitTableStatusParams) {
  requiredToken(params.t);
  return publicApiClient
    .get<EmitTableStatusResponse>("/api/v1/pos/emit_table_status", {
      params: {
        t: params.t,
        branch_uuid_fk: params.branch_uuid_fk,
        table_uuid: params.table_uuid
      }
    })
    .then((response) => response.data)
    .catch((error) => {
      throw new ServiceError("emit_table_status failed", 0, error);
    });
}
