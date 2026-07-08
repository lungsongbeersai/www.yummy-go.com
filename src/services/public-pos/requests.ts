import { publicApiClient, publicApiRequest, ServiceError } from "@/lib/api";
import { normalizeFetchCateProductsResponse } from "@/services/pos/normalizers";
import { langParam } from "@/services/shared/request-helpers";
import { requiredItems, requiredToken } from "@/services/shared/validators";
import type { EmitTableStatusResponse, ProdItem } from "@/services/pos";
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
  FetchCateProductsResponse,
  UpdateOrderNoteResponse,
  UpdateQtyResponse
} from "@/services/pos";

export function scanTableQR(t: string, lang = "la") {
  return publicApiRequest<QRScanResponse>("get", "/api/v1/pos/customer/qrscan", {
    params: { t: requiredToken(t), lang: langParam(lang) }
  });
}

export async function fetchCustomerStatusSorts(lang = "la") {
  const result = await publicApiRequest<PublicStatusSortResponse>("get", "/api/v1/status/fetch_all", {
    params: { lang: langParam(lang) }
  });
  return result.data ?? [];
}

export function fetchCustomerCart(params: CustomerFetchCartParams) {
  return publicApiRequest<FetchCartResponse>("get", "/api/v1/pos/customer/fetch_cart", {
    params: { t: requiredToken(params.t), lang: langParam(params.lang) }
  });
}

export async function customerFetchCateProducts(params: CustomerFetchCateProductsParams) {
  const requestParams: Record<string, string | number | undefined> = {
    t: requiredToken(params.t),
    lang: langParam(params.lang),
    search: params.search ?? ""
  };

  if (params.cate_uuid?.trim()) {
    requestParams.cate_uuid = params.cate_uuid;
  }

  const response = await publicApiRequest<FetchCateProductsResponse>("get", "/api/v1/pos/customer/fetch_cate_products", {
    params: requestParams
  });
  return normalizeFetchCateProductsResponse(response);
}

export async function customerGetProdItem(params: CustomerGetProdItemParams) {
  const result = await publicApiRequest<{ data: ProdItem }>(
    "post",
    `/api/v1/pos/customer/get_prod_item?t=${encodeURIComponent(requiredToken(params.t))}`,
    {
      data: {
        prod_uuid: params.prod_uuid,
        lang: langParam(params.lang),
        cate_uuid: params.cate_uuid,
        search: params.search,
        status_sort_fk: params.status_sort_fk ?? 1
      }
    }
  );
  return result.data;
}

export function customerCreateOrder(t: string, input: CustomerCreateOrderInput) {
  requiredItems(input.items);
  return publicApiRequest<CreateOrderResponse>(
    "post",
    `/api/v1/pos/customer/create_order?t=${encodeURIComponent(requiredToken(t))}`,
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
