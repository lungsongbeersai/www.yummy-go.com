import { PaymentMethodsReportPage } from "@/features/report/payment-methods/payment-methods-report-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export default async function PaymentMethodsReportRoute(props: PageProps<"/report/payment-methods">) {
  const params = await props.searchParams;

  return <PaymentMethodsReportPage initialPagination={parseUrlPagination(params)} />;
}
