"use client";

import { OrderCustomerView } from "./order-customer-view";
import { useOrderCustomerWorkflow } from "./use-order-customer-workflow";

export function OrderCustomerPage({
  initialTableUuid,
  initialTableName,
}: {
  initialTableUuid: string;
  initialTableName: string;
}) {
  const workflow = useOrderCustomerWorkflow({
    initialTableUuid,
    initialTableName,
  });

  return <OrderCustomerView workflow={workflow} />;
}
