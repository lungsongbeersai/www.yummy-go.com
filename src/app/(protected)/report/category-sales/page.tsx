import { CategorySalesReportPage } from "@/features/report/category-sales/category-sales-report-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export default async function CategorySalesReportRoute(props: PageProps<"/report/category-sales">) {
  const params = await props.searchParams;
  return <CategorySalesReportPage initialPagination={parseUrlPagination(params)} />;
}
