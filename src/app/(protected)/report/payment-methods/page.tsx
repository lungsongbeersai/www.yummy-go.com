import { PaymentMethodsReportPage } from "@/features/report/payment-methods/payment-methods-report-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function PaymentMethodsReportRoute({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <PaymentMethodsReportPage initialPagination={parseUrlPagination(params)} />;
}
