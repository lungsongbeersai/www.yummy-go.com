import { ProductPage } from "@/features/product/list/product-page";
import { parseUrlPagination, type UrlSearchParamsRecord } from "@/lib/url-pagination";

type SearchParams = Promise<UrlSearchParamsRecord>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;

  return <ProductPage initialPagination={parseUrlPagination(params)} />;
}
