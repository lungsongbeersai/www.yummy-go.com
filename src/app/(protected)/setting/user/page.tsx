import { UserSettingsPage } from "@/features/settings/user/user-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export default async function Page(props: PageProps<"/setting/user">) {
  const params = await props.searchParams;

  return <UserSettingsPage initialPagination={parseUrlPagination(params)} />;
}