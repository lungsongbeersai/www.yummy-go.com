import type { Metadata } from "next";
import { CreditPage } from "@/features/sales/credit/credit-page";

export const metadata: Metadata = {
  title: "ຊຳລະ Credit"
};

export default function Page() {
  return <CreditPage />;
}
