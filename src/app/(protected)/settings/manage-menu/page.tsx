import type { Metadata } from "next";
import { PermissionMenuPage } from "@/features/permissions/menu/permission-menu-page";

export const metadata: Metadata = {
  title: "ຈັດການເມນູ",
};

export default function Page() {
  return <PermissionMenuPage />;
}
