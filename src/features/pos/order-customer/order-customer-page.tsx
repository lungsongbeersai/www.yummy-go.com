"use client";

import { OrderCustomerView } from "./order-customer-view";
import { useOrderCustomerWorkflow } from "./use-order-customer-workflow";

export function OrderCustomerPage({
  initialOrderUuid,
  initialTableUuid,
  initialTableName,
}: {
  initialOrderUuid: string;
  initialTableUuid: string;
  initialTableName: string;
}) {
  const workflow = useOrderCustomerWorkflow({
    initialOrderUuid,
    initialTableUuid,
    initialTableName,
  });

  return <OrderCustomerView workflow={workflow} />;
}
