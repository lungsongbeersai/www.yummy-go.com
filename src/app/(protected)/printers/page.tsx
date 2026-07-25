import type { Metadata } from "next";
import { PrinterPage } from "@/features/printer/list/printer-page";

export const metadata: Metadata = {
  title: "ເຄື່ອງພິມ",
};

export default function Page() {
  return <PrinterPage />;
}
