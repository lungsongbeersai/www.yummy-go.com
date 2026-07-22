import type { Metadata } from "next";
import { PermissionMenuPage } from "@/features/permission-menu/manage/permission-menu-page";

export const metadata: Metadata = {
  title: "ຈັດການເມນູ",
};

export default function Page() {
  return <PermissionMenuPage />;
}
