import type { Metadata } from "next";
import { DailyClosingReportPage } from "@/features/report/daily-closing/daily-closing-report-page";

export const metadata: Metadata = {
  title: "ລາຍງານປິດຮ້ານປະຈຳວັນ",
};

export default function Page() {
  return <DailyClosingReportPage />;
}
