import type { Metadata } from "next";
import { ProductPage } from "@/features/product/list/product-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ສິນຄ້າ",
};

export default async function Page(props: PageProps<"/products">) {
  const params = await props.searchParams;

  return <ProductPage initialPagination={parseUrlPagination(params)} />;
}
