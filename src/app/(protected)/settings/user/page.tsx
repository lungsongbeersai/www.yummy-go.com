import type { Metadata } from "next";
import { UserSettingsPage } from "@/features/settings/user/user-page";
import { parseUrlPagination } from "@/lib/url-pagination";

export const metadata: Metadata = {
  title: "ຜູ້ໃຊ້",
};

export default async function Page(props: PageProps<"/settings/user">) {
  const params = await props.searchParams;

  return <UserSettingsPage initialPagination={parseUrlPagination(params)} />;
}