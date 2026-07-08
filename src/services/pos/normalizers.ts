import type {
  CateProductItem,
  CateWithProducts,
  FetchCateProductsResponse,
} from "@/services/pos/types";

function productSortValue(product: Pick<CateProductItem, "prod_sort">) {
  const value = Number(product.prod_sort);
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

function normalizeCategoryProducts(category: CateWithProducts) {
  return {
    ...category,
    products: sortProductsByProductSort(category.products) ?? [],
  };
}

export function normalizeFetchCateProductsResponse(
  response: FetchCateProductsResponse,
): FetchCateProductsResponse {
  return {
    ...response,
    data: (response.data ?? []).map(normalizeCategoryProducts),
    special_products: sortProductsByProductSort(response.special_products),
  };
}
