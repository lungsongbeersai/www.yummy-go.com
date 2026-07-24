import type {
  CateProductItem,
  CateWithProducts,
  FetchCateProductsResponse,
  PosProduct,
  ProdDetail,
  ProdItem,
  ProdTopping,
} from "@/services/pos/types";
import type {
  ApiCateProductItem,
  ApiCateWithProducts,
  ApiFetchCateProductsResponse,
  ApiPosProduct,
  ApiProdDetail,
  ApiProdItem,
  ApiProdTopping,
} from "@/services/pos/api-types";

export function mapApiProdDetail(detail: ApiProdDetail): ProdDetail {
  return {
    proDetailUuid: detail.pro_detail_uuid,
    proDetailId: detail.pro_detail_id,
    proDetailSort: detail.pro_detail_sort,
    sizeUuidFk: detail.size_uuid_fk,
    sizeName: detail.size_name,
    price: detail.price,
    proDetailSprice: detail.pro_detail_sprice,
    qtyStock: detail.qty_stock,
    proDetailQtyStock: detail.pro_detail_qty_stock,
    proDetailEnabled: detail.pro_detail_enabled,
    proDetailStatus: detail.pro_detail_status,
    cutStock: detail.cut_stock,
    proDetailCusQtyBuy: detail.pro_detail_cus_qtyBuy,
    proDetailCusQtyFree: detail.pro_detail_cus_qtyFree,
    proDetailSDate: detail.pro_detail_sDate,
    proDetailEDate: detail.pro_detail_eDate,
    proDetailSTime: detail.pro_detail_sTime,
    proDetailETime: detail.pro_detail_eTime,
    defaultQty: detail.default_qty,
  };
}

export function mapApiProdTopping(topping: ApiProdTopping): ProdTopping {
  return {
    prodToppingUuid: topping.prod_topping_uuid,
    toppingUuidFk: topping.topping_uuid_fk,
    toppingUuid: topping.topping_uuid,
    toppingName: topping.topping_name,
    toppingNameLa: topping.topping_name_la,
    toppingNameEng: topping.topping_name_eng,
    toppingPrice: topping.topping_price,
    toppingEnabled: topping.topping_enabled,
    toppingStatus: topping.topping_status,
  };
}

export function mapApiProdItem(product: ApiProdItem): ProdItem {
  return {
    prodUuid: product.prod_uuid,
    prodCode: product.prod_code,
    prodName: product.prod_name,
    prodStatusImge: product.prod_status_imge,
    prodImage: product.prod_image,
    prodColor: product.prod_color,
    prodPrice: product.prod_price,
    typeGroup: product.type_group,
    uniteName: product.unite_name,
    prodSetPrice: product.prod_set_price,
    proDetailSprice: product.pro_detail_sprice,
    statusSortFk: product.status_sort_fk,
    details: (product.details ?? []).map(mapApiProdDetail),
    toppings: (product.toppings ?? []).map(mapApiProdTopping),
  };
}

function mapApiPosProduct(product: ApiPosProduct): PosProduct {
  return {
    prodUuid: product.prod_uuid,
    prodCode: product.prod_code,
    prodSort: product.prod_sort,
    prodName: product.prod_name,
    prodImage: product.prod_image,
    prodStatusImge: product.prod_status_imge,
    prodColor: product.prod_color,
    statusSortFk: product.status_sort_fk,
    statusName: product.status_name,
    promoState: product.promo_state,
    promoExpired: product.promo_expired,
    promoMsg: product.promo_msg,
    prodPrice: product.prod_price,
    typeGroup: product.type_group,
    uniteName: product.unite_name,
    prodSetPrice: product.prod_set_price,
  };
}

function mapApiCateProductItem(product: ApiCateProductItem): CateProductItem {
  return {
    ...mapApiPosProduct(product),
    proDetailSprice: product.pro_detail_sprice,
    minPrice: product.min_price,
    maxPrice: product.max_price,
    canAdd: product.can_add,
    hasOptions: product.has_options,
    optionsMsg: product.options_msg,
    soldOutManual: product.sold_out_manual,
    soldOutMsg: product.sold_out_msg,
    stockSoldOut: product.stock_sold_out,
    stockAvailable: product.stock_available,
    countOptionAll: product.count_option_all,
    countOptionEnabled: product.count_option_enabled,
    countToppingEnabled: product.count_topping_enabled,
    customerBuy: product.customer_buy,
    customerFree: product.customer_free,
    proDetailUuid: product.pro_detail_uuid,
  };
}

function productSortValue(product: Pick<CateProductItem, "prodSort">) {
  const value = Number(product.prodSort);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function sortProductsByProductSort(products: CateProductItem[] | undefined) {
  if (!products) return products;
  return [...products].sort((left, right) => {
    const leftSort = productSortValue(left);
    const rightSort = productSortValue(right);
    if (leftSort === rightSort) return 0;
    return leftSort - rightSort;
  });
}

function mapApiCategory(category: ApiCateWithProducts): CateWithProducts {
  return {
    cateUuid: category.cate_uuid,
    cateName: category.cate_name,
    cateIcon: category.cate_icon,
    products:
      sortProductsByProductSort(
        (category.products ?? []).map(mapApiCateProductItem),
      ) ?? [],
  };
}

export function normalizeFetchCateProductsResponse(
  response: ApiFetchCateProductsResponse,
): FetchCateProductsResponse {
  return {
    status: response.status,
    message: response.message,
    lang: response.lang,
    search: response.search,
    branchUuidFk: response.branch_uuid_fk,
    specialProducts: response.special_products
      ? sortProductsByProductSort(
          response.special_products.map(mapApiCateProductItem),
        )
      : undefined,
    totalSpecial: response.total_special,
    selectedCateUuid: response.selected_cate_uuid,
    categories: (response.data ?? []).map(mapApiCategory),
    defaultCateUuid: response.default_cate_uuid,
    total: response.total,
  };
}
