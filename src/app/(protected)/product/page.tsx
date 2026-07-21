import { ProductPage } from "@/features/product/list/product-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export default async function Page(props: PageProps<"/product">) {
  const params = await props.searchParams;

  return <ProductPage initialPagination={parseUrlPagination(params)} />;
}
