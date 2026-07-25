import type { Metadata } from "next";
import { BestSellingProductsReportPage } from "@/features/report/best-selling-products/best-selling-products-report-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ສິນຄ້າຂາຍດີ",
};

export default async function Page(props: PageProps<"/report/best-selling-products">) {
  const params = await props.searchParams;

  return <BestSellingProductsReportPage initialPagination={parseUrlPagination(params)} />;
}
