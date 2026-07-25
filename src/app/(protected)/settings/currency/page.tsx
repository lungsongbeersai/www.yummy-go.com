import type { Metadata } from "next";
import { CurrencySettingsPage } from "@/features/settings/currency/currency-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ສະກຸນເງິນ",
};

export default async function Page(props: PageProps<"/settings/currency">) {
  const params = await props.searchParams;

  return <CurrencySettingsPage initialPagination={parseUrlPagination(params)} />;
}