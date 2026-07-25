import type { Metadata } from "next";
import { SettingsIndexPage } from "@/features/settings/overview/settings-index-page";

export const metadata: Metadata = {
  title: "ຕັ້ງຄ່າ",
};

export default function Page() {
  return <SettingsIndexPage />;
}
