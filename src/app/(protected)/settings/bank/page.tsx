import type { Metadata } from "next";
import { BankSettingsPage } from "@/features/settings/bank-account/bank-settings-page";

export const metadata: Metadata = {
  title: "ທະນາຄານ",
};

export default function Page() {
  return <BankSettingsPage />;
}
