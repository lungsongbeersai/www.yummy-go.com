import type { SimulatorOrder, SimulatorSession } from "@/services/simulator";

export function formatSimMoney(value: number, locale = "en", currency = "LAK") {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: currency === "LAK" ? 0 : 2 }).format(value)} ${currency}`;
}

export function itemStatusLabel(status: number) {
  return ({ 0: "draft", 1: "draft", 2: "confirmed", 4: "served", 9: "cancelled" } as Record<number, string>)[status] ?? String(status);
}

export function tableStatusLabel(status: number) {
  return ({ 1: "available", 2: "occupied", 3: "draft", 4: "draft", 5: "callStaff", 6: "requestBill" } as Record<number, string>)[status] ?? String(status);
}

export function tableSceneStatus(status: number) {
  return ({ 1: "available", 2: "occupied", 3: "draft", 4: "awaiting", 5: "calling", 6: "billing" } as const)[status as 1 | 2 | 3 | 4 | 5 | 6] ?? "occupied";
}

export function tableStatusTone(status: number) {
  return ({ 1: "bg-success", 2: "bg-info", 3: "bg-pending", 4: "bg-warning", 5: "bg-destructive", 6: "bg-chart-cat-5" } as Record<number, string>)[status] ?? "bg-muted-foreground";
}

export function orderName(order: SimulatorOrder, session: SimulatorSession) {
  return session.tables.find((table) => table.table_uuid === order.table_uuid)?.name ?? `#${order.order_uuid.slice(0, 6)}`;
}

export function createSceneCharacters(session: SimulatorSession) {
  const customers = session.customers.filter((customer) => customer.state !== "left").map((customer) => ({
    id: customer.customer_uuid, role: "customer" as const, state: customer.state, tableId: customer.table_uuid ?? undefined,
  }));
  const autoOrders = new Set(session.customers.map((customer) => customer.order_uuid));
  for (const order of session.orders.filter((entry) => entry.status === "open" && !autoOrders.has(entry.order_uuid))) {
    for (let i = 0; i < Math.min(order.guests, 4); i += 1) {
      customers.push({ id: `guest:${order.order_uuid}:${i}`, role: "customer", tableId: order.table_uuid ?? undefined,
        state: order.items.some((item) => item.status === 4) ? "eating" : order.items.some((item) => item.status === 2) ? "waiting_food" : "browsing" });
    }
  }
  const ready = session.kitchen.find((job) => job.status === "ready");
  const preparing = session.kitchen.some((job) => job.status === "preparing");
  const delivery = session.orders.find((order) => order.order_uuid === ready?.order_uuid);
  return [
    ...customers.slice(0, 16),
    { id: "staff:waiter", role: "waiter" as const, state: ready ? "serving" : "welcoming", tableId: delivery?.table_uuid ?? undefined },
    { id: "staff:chef", role: "chef" as const, state: preparing ? "preparing" : "ready" },
    { id: "staff:cashier", role: "cashier" as const, state: session.orders.some((order) => order.payments.length && order.status === "open") ? "billing" : "reviewing" },
  ];
}
