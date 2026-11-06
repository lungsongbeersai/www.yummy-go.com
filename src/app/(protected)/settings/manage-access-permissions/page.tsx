import type { Metadata } from "next";
import { StorePermissionsPage } from "@/features/permissions/store/store-permissions-page";

export const metadata: Metadata = {
  title: "ຈັດການສິດທິເຂົ້າໃຊ້",
};

export default async function Page({ searchParams }: {
  searchParams: Promise<{ store_uuid?: string | string[]; role_id?: string | string[] }>;
}) {
  const params = await searchParams;
  return <StorePermissionsPage initialTrialContext={{ storeUuid: params.store_uuid, roleId: params.role_id }} />;
}
