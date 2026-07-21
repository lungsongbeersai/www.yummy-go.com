import type { Metadata } from "next";
import { STOCK_PAGE_LIMIT_OPTIONS } from "@/features/stock/stock-constants";
import { StockPage } from "@/features/stock/stock-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ຈຳນວນສະຕັອກ",
};

export default async function Page(props: PageProps<"/stock">) {
  const params = await props.searchParams;

  return (
    <StockPage
      initialPagination={parseUrlPagination(params, {
        limitOptions: [...STOCK_PAGE_LIMIT_OPTIONS],
      })}
    />
  );
}
