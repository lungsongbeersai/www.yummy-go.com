import type { Metadata } from "next";
import { AccountSettingsPage } from "@/features/settings/bank-account/account-settings-page";

export const metadata: Metadata = {
  title: "ບັນຊີຮັບໂອນ",
};

export default function Page() {
  return <AccountSettingsPage />;
}
