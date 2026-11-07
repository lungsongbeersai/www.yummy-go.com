"use client";

import { useSearchParams } from "next/navigation";
import { OrderCustomerView } from "./order-customer-view";
import { orderCustomerRouteInput } from "./order-customer-route";
import { useOrderCustomerWorkflow } from "./use-order-customer-workflow";

export function OrderCustomerPage() {
  const searchParams = useSearchParams();
  const { initialTableUuid, initialTableName, initialZoneUuid, initialBillRequestKey } = orderCustomerRouteInput(searchParams);
  const workflow = useOrderCustomerWorkflow({
    initialTableUuid,
    initialTableName,
    initialZoneUuid,
    initialBillRequestKey,
  });

  return <OrderCustomerView workflow={workflow} />;
}
