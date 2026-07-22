import type { Metadata } from "next";
import { StorePermissionsPage } from "@/features/store-permissions/manage/store-permissions-page";

export const metadata: Metadata = {
  title: "ຈັດການສິດທິເຂົ້າໃຊ້",
};

export default function Page() {
  return <StorePermissionsPage />;
}
