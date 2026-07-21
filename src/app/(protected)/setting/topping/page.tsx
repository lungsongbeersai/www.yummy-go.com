import type { Metadata } from "next";
import { ToppingSettingsPage } from "@/features/settings/topping/topping-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ທັອບປິ້ງ",
};

export default async function Page(props: PageProps<"/setting/topping">) {
  const params = await props.searchParams;

  return <ToppingSettingsPage initialPagination={parseUrlPagination(params)} />;
}