import type { Metadata } from "next";
import { DepositPage } from "@/features/sales/deposit/deposit-page";

export const metadata: Metadata = {
  title: "ຝາກເຄື່ອງດື່ມ"
};

export default function Page() {
  return <DepositPage />;
}
