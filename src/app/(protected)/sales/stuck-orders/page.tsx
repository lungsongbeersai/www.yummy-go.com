import type { Metadata } from "next";
import { StuckOrdersPage } from "@/features/report/stuck-orders/stuck-orders-page";

export const metadata: Metadata = {
  title: "ອໍເດີຄ້າງສົ່ງ",
};

export default function Page() {
  return <StuckOrdersPage />;
}
