import { CurrencySettingsPage } from "@/features/settings/currency/currency-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export default async function Page(props: PageProps<"/setting/currency">) {
  const params = await props.searchParams;

  return <CurrencySettingsPage initialPagination={parseUrlPagination(params)} />;
}