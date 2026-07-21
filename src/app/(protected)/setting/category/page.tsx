import { CategorySettingsPage } from "@/features/settings/category/category-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export default async function Page(props: PageProps<"/setting/category">) {
  const params = await props.searchParams;

  return <CategorySettingsPage initialPagination={parseUrlPagination(params)} />;
}