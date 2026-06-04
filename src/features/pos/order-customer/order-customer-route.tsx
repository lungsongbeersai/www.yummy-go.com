"use client";

import { useSearchParams } from "next/navigation";
import { OrderCustomerPage } from "@/features/pos/order-customer/order-customer-page";
import { TableSelectionPage } from "@/features/pos/table-selection/table-selection-page";

export function OrderCustomerRoute() {
  const params = useSearchParams();
  const tableUuid = params.get("table_uuid") ?? "";

  if (!tableUuid) return <TableSelectionPage />;

  return (
    <OrderCustomerPage
      initialTableUuid={tableUuid}
      initialTableName={params.get("table_name") ?? ""}
    />
  );
}
