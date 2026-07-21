import { ExchangeSettingsPage } from "@/features/settings/exchange/exchange-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export default async function Page(props: PageProps<"/setting/exchange">) {
  const params = await props.searchParams;

  return <ExchangeSettingsPage initialPagination={parseUrlPagination(params)} />;
}