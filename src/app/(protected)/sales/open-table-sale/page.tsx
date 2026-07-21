import type { Metadata } from "next";
import { TableSelectionPage } from "@/features/pos/table-selection/table-selection-page";

export const metadata: Metadata = {
  title: "ເປີດຂາຍໂຕະ",
};

export default function Page() {
  return <TableSelectionPage />;
}
