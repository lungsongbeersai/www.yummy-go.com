import { PackagePage } from "@/features/package/package-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export default async function Page(props: PageProps<"/package">) {
  const params = await props.searchParams;

  return (
    <PackagePage
      initialPagination={parseUrlPagination(params, {
        defaultLimit: 10,
        limitOptions: [10, 20, 50],
      })}
    />
  );
}
