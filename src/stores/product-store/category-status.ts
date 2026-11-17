export const PRODUCT_CATEGORY_STATUS_SORTS = ["1", "2", "3"] as const;

export interface ProductCategoryStatusTotal {
  statusSort: string;
  total: number | string | null | undefined;
}

function productCount(total: ProductCategoryStatusTotal["total"]) {
  const count = Number(total);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export function preferredProductCategoryStatus(
  totals: readonly ProductCategoryStatusTotal[],
  activeStatusSort: string,
) {
  let preferredStatusSort = activeStatusSort;
  let greatestCount = productCount(
    totals.find(({ statusSort }) => statusSort === activeStatusSort)?.total,
  );

  for (const { statusSort, total } of totals) {
    const count = productCount(total);
    if (count > greatestCount) {
      preferredStatusSort = statusSort;
      greatestCount = count;
    }
  }

  return preferredStatusSort;
}
