import type { Metadata } from "next";
import { Suspense } from "react";
import { TableSelectionPage } from "@/features/pos/table-selection/table-selection-page";

export const metadata: Metadata = {
  title: "ເປີດຂາຍໂຕະ",
};

export default function PosAllTablesPage() {
  return (
    <Suspense fallback={null}>
      <TableSelectionPage />
    </Suspense>
  );
}
