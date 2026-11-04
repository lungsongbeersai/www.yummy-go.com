"use client";

import type { UrlPaginationState } from "@/lib/url-pagination";
import { MySalesPage } from "@/features/sales/my-sales/my-sales-page";

export function SalesListPage({ initialPagination }: { initialPagination: UrlPaginationState }) {
  return <MySalesPage initialPagination={initialPagination} />;
}
