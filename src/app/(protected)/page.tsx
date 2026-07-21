import type { Metadata } from "next";
import { DashboardPage } from "@/features/dashboard/overview/dashboard-page";

export const metadata: Metadata = {
  title: "ໜ້າຫຼັກ",
};

export default function Page() {
  return <DashboardPage />;
}
