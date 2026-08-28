"use client";

import { useSearchParams } from "next/navigation";
import { OrderCustomerView } from "./order-customer-view";
import { orderCustomerRouteInput } from "./order-customer-route";
import { useOrderCustomerWorkflow } from "./use-order-customer-workflow";

export function OrderCustomerPage() {
  const searchParams = useSearchParams();
  const { initialTableUuid, initialTableName } = orderCustomerRouteInput(searchParams);
  const workflow = useOrderCustomerWorkflow({
    initialTableUuid,
    initialTableName,
  });

  return <OrderCustomerView workflow={workflow} />;
}
