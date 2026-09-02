import { publicApiClient, publicApiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { isBranchMenuQrToken } from "@/services/public-pos/qr-token";
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
  BranchMenuQRScanResponse,
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

export async function scanTableQR(t: string, lang = "la") {
  const token = requiredToken(t);

  // QR เมนูอย่างเดียว (ສ້າງ QR ເມນູອາຫານ) ไม่มีโต๊ะ ผูก endpoint/middleware
  // คนละชุดกับ QR โต๊ะ — ดู token prefix ก็รู้แล้วว่าเป็นแบบไหน แล้วแปลงร่างให้
  // เป็น QRScanResponse shape เดียวกัน ที่เหลือของแอปจะได้ไม่ต้องรู้ว่ามี 2 แบบ
  if (isBranchMenuQrToken(token)) {
    const result = await publicApiRequest<BranchMenuQRScanResponse>(
      "get",
      "/api/v1/posAll/customer/menu_qrscan",
      { params: { t: token, lang: toApiLanguage(lang) } },
    );
    return {
      status: result.status,
      message: result.message,
      lang: result.lang,
      table_uuid: "",
      table_name: result.branch_name,
      table_status: 0,
      qr_enabled: true,
      branch_uuid_fk: result.branch_uuid_fk,
      view_only: true,
    };
  }

  return publicApiRequest<QRScanResponse>("get", "/api/v1/posAll/customer/qrscan", {
    params: { t: token, lang: toApiLanguage(lang) }
  });
}

export async function fetchCustomerStatusSorts(lang = "la") {
  const result = await publicApiRequest<PublicStatusSortResponse>("get", "/api/v1/status/fetch_all", {
    params: { lang: toApiLanguage(lang) }
  });
  return result.data ?? [];
}

export function fetchCustomerCart(params: CustomerFetchCartParams) {
  return publicApiRequest<FetchCartResponse>("get", "/api/v1/posAll/customer/fetch_cart", {
    params: { t: requiredToken(params.t), lang: toApiLanguage(params.lang) }
  });
}

export async function customerFetchCateProducts(params: CustomerFetchCateProductsParams) {
  const endpoint = isBranchMenuQrToken(params.token)
    ? "/api/v1/posAll/customer/menu/fetch_cate_products"
    : "/api/v1/posAll/customer/fetch_cate_products";

  const response = await publicApiRequest<ApiFetchCateProductsResponse>(
    "get",
    endpoint,
    {
      params: buildCustomerCatalogQuery(params),
    },
  );
  return normalizeFetchCateProductsResponse(response);
}

export async function customerGetProdItem(params: CustomerGetProdItemParams) {
  const token = requiredToken(params.token);
  const path = isBranchMenuQrToken(token)
    ? "/api/v1/posAll/customer/menu/get_prod_item"
    : "/api/v1/posAll/customer/get_prod_item";

  const result = await publicApiRequest<ApiProdItemResponse>(
    "post",
    `${path}?t=${encodeURIComponent(token)}`,
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
    `/api/v1/posAll/customer/order_item/update_qty?t=${encodeURIComponent(requiredToken(params.t))}`,
    { data: params }
  );
}

export function customerDeleteOrderItem(params: CustomerDeleteOrderItemParams) {
  return publicApiRequest<DeleteOrderItemResponse>("delete", "/api/v1/posAll/customer/delete_order_item", {
    params: { t: requiredToken(params.t), order_it_uuid: params.order_it_uuid }
  });
}

export function customerUpdateOrderNote(params: CustomerUpdateOrderNoteInput) {
  return publicApiRequest<UpdateOrderNoteResponse>(
    "patch",
    `/api/v1/posAll/customer/update_note?t=${encodeURIComponent(requiredToken(params.t))}`,
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
    `/api/v1/posAll/customer/confirm_to_kitchen?t=${encodeURIComponent(requiredToken(params.t))}`,
    { data: params }
  );
}

export function customerEmitTableStatus(params: CustomerEmitTableStatusParams) {
  requiredToken(params.t);
  return publicApiClient
    .get<EmitTableStatusResponse>("/api/v1/posAll/emit_table_status", {
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
