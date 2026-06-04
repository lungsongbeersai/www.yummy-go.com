import { money } from "@/lib/format";
import type { CustomerDisplayPayload } from "@/features/customer-display/shared/customer-display-sync";
import {
  ProductImageStatus,
  TableStatus,
  type CartItem,
  type CartOrder,
  type DiscountTypeCode,
  type MoveTableItem,
  type MoveTableZone,
  type PosTable,
  type PosZone,
} from "@/services/pos";
import type {
  DiscountDraft,
  NormalizedTableActionZone,
  TableActionMode,
  TableActionTable,
  TableStatusFilter,
} from "./types";

const HEX_COLOR_PATTERN =
  /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export type CartItemMedia =
  | { type: "image"; src: string }
  | { type: "color"; color: string }
  | { type: "empty" };

export function tableStatus(table: PosTable) {
  return Number(table.table_status) === TableStatus.OCCUPIED ? "busy" : "free";
}

export function tableSeatCount(table: PosTable) {
  const value =
    table.number_of_seats ??
    table.table_qty ??
    table.qty ??
    table.seat_qty ??
    table.seats ??
    0;
  return Number(value || 0);
}

export function optionalNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

export function optionalString(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

export function optionalBoolean(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const text = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "y"].includes(text)) return true;
    if (["0", "false", "no", "n"].includes(text)) return false;
  }
  return null;
}

export function tableActionTableUuid(table: MoveTableItem | PosTable) {
  return optionalString(
    table.table_uuid,
    table.table_uuid_fk,
    table.uuid,
    table.id,
  );
}

export function tableActionTableName(table: MoveTableItem | PosTable) {
  return (
    optionalString(
      table.table_name,
      table.table_name_la,
      table.table_name_eng,
      table.name,
      table.title,
    ) ?? "-"
  );
}

export function tableActionHasOrder(table: MoveTableItem | PosTable) {
  if (
    optionalBoolean(
      table.customer_order_state,
      table.has_order,
      table.hasOrder,
      table.in_use,
      table.is_occupied,
    )
  )
    return true;
  if (
    optionalString(
      table.order_uuid,
      table.order_uuid_fk,
      table.order_invoice,
      table.invoice,
      table.invoice_no,
      table.bill_uuid,
    )
  )
    return true;

  const orderCount = optionalNumber(
    table.order_count,
    table.orders_count,
    table.order_qty,
    table.item_count,
    table.items_count,
    table.total_order,
    table.total_orders,
  );
  if (orderCount !== null && orderCount > 0) return true;

  const orders = table.orders;
  const items = table.items;
  return (
    (Array.isArray(orders) && orders.length > 0) ||
    (Array.isArray(items) && items.length > 0)
  );
}

export function tableActionTableStatus(
  table: MoveTableItem | PosTable,
): "free" | "busy" {
  if (tableActionHasOrder(table)) return "busy";

  const status = optionalNumber(
    table.table_status,
    table.status,
    table.table_status_fk,
  );
  if (status === TableStatus.OCCUPIED) return "busy";
  if (status === TableStatus.AVAILABLE) return "free";

  const statusText = optionalString(
    table.table_status_text,
    table.status_text,
    table.status_name,
    table.status,
  )?.toLowerCase();
  if (
    statusText &&
    ["busy", "occupied", "reserved", "unavailable"].some((text) =>
      statusText.includes(text),
    )
  )
    return "busy";

  return "free";
}

export function normalizeTableActionZones(
  zones: Array<MoveTableZone | PosZone>,
) {
  return zones
    .map((zone, zoneIndex) => {
      const zoneName =
        optionalString(zone.zone_name, zone.name, zone.title) ?? "-";
      const tables = ((zone.tables ?? []) as Array<MoveTableItem | PosTable>)
        .map((table) => {
          const uuid = tableActionTableUuid(table);
          if (!uuid) return null;

          return {
            customerOrderState: tableActionHasOrder(table),
            name: tableActionTableName(table),
            seats: optionalNumber(
              table.number_of_seats,
              table.table_qty,
              table.qty,
              table.seat_qty,
              table.seats,
            ),
            status: tableActionTableStatus(table),
            uuid,
            zoneName,
          } satisfies TableActionTable;
        })
        .filter((table): table is TableActionTable => Boolean(table));

      return {
        name: zoneName,
        tables,
        uuid:
          optionalString(zone.zone_uuid, zone.uuid, zone.id) ??
          `zone-${zoneIndex}`,
      } satisfies NormalizedTableActionZone;
    })
    .filter((zone) => zone.tables.length > 0);
}

export function filterTableActionZones(
  zones: NormalizedTableActionZone[],
  currentTableUuid: string,
  mode: TableActionMode,
  search: string,
) {
  const query = search.trim().toLowerCase();

  return zones
    .map((zone) => ({
      ...zone,
      tables: zone.tables.filter((table) => {
        if (table.uuid === currentTableUuid) return false;
        if (mode === "move" && table.status !== "free") return false;
        if (mode === "join" && table.status !== "busy") return false;
        return (
          !query ||
          table.name.toLowerCase().includes(query) ||
          zone.name.toLowerCase().includes(query)
        );
      }),
    }))
    .filter((zone) => zone.tables.length > 0);
}

export function tableActionFlatTables(zones: NormalizedTableActionZone[]) {
  return zones.flatMap((zone) => zone.tables);
}

export function formatQuantityValue(...values: unknown[]) {
  const value = optionalNumber(...values);
  return value === null ? null : String(value);
}

export function positiveNumber(...values: unknown[]) {
  const value = optionalNumber(...values);
  return value !== null && value > 0 ? value : null;
}

export function formatPositiveMoneyValue(...values: unknown[]) {
  const value = positiveNumber(...values);
  return value === null ? null : money(value);
}

export function formatPlainValue(...values: unknown[]) {
  const numberValue = optionalNumber(...values);
  if (numberValue !== null) return String(numberValue);
  return optionalString(...values);
}

export function differentNumber(left: number | null, right: number | null) {
  return left !== null && right !== null && left !== right;
}

export function cartOrders(cart: CartOrder | CartOrder[] | null) {
  if (!cart) return [];
  return Array.isArray(cart) ? cart : [cart];
}

export function cartItemName(item: CartItem) {
  return String(
    item.prod_name ?? item.title ?? item.product_name ?? item.name ?? "-",
  );
}

export function cartItemDisplayName(title: string, sizeName: string | null) {
  if (!sizeName) return title.trim();

  const trimmedTitle = title.trim();
  const trimmedSize = sizeName.trim();
  const sizeSuffixes = [
    `(${trimmedSize})`,
    `（${trimmedSize}）`,
    `[${trimmedSize}]`,
  ];

  if (sizeSuffixes.some((suffix) => trimmedTitle.endsWith(suffix)))
    return trimmedTitle;

  return `${trimmedTitle} (${trimmedSize})`;
}

function isHexColor(value: string) {
  return HEX_COLOR_PATTERN.test(value.trim());
}

export function cartItemMedia(item: CartItem): CartItemMedia {
  const mediaValue = optionalString(
    item.prod_image,
    item.product_image,
    item.image,
  );
  if (!mediaValue) return { type: "empty" };

  const imageStatus = optionalNumber(
    item.prod_status_imge,
    item.prod_status_image,
    item.product_image_status,
    item.image_status,
  );
  const isColor =
    imageStatus === ProductImageStatus.COLOR || isHexColor(mediaValue);

  if (isColor) {
    return isHexColor(mediaValue)
      ? { type: "color", color: mediaValue }
      : { type: "empty" };
  }

  return { type: "image", src: mediaValue };
}

export function cartItemQty(item: CartItem) {
  return (
    optionalNumber(
      item.detail?.order_it_qty,
      item.detail?.total_receive_qty,
      item.qty,
      item.quantity,
      item.item_qty,
    ) ?? 1
  );
}

export function cartItemTotal(item: CartItem) {
  const explicitTotal = optionalNumber(
    item.detail?.net_total,
    item.detail?.gross_total,
    item.total,
    item.amount,
    item.line_total,
    item.subtotal,
  );
  if (explicitTotal !== null) return explicitTotal;
  const price =
    optionalNumber(
      item.detail?.unit_price,
      item.price,
      item.prod_price,
      item.product_price,
      item.pro_detail_sprice,
    ) ?? 0;
  return price * cartItemQty(item);
}

export function cartItemDiscountMaxAmount(item: CartItem) {
  const grossTotal = optionalNumber(item.detail?.gross_total);
  if (grossTotal !== null) return Math.max(0, grossTotal);

  const baseLineTotal = optionalNumber(item.detail?.base_line_total);
  const toppingLineTotal = optionalNumber(item.detail?.topping_line_total);
  if (baseLineTotal !== null || toppingLineTotal !== null) {
    return Math.max(0, (baseLineTotal ?? 0) + (toppingLineTotal ?? 0));
  }

  return Math.max(0, cartItemTotal(item));
}

export function cartItemUuid(item: CartItem) {
  return optionalString(item.order_it_uuid, item.order_item_uuid);
}

export function cartItemActionUuid(item: CartItem) {
  return optionalString(item.order_it_uuid);
}

export function cartItemStatus(item: CartItem) {
  return optionalNumber(
    item.detail?.order_it_status,
    item.order_it_status,
    item.status,
    item.order_status,
  );
}

export function isVisibleCartItem(item: CartItem) {
  return cartItemStatus(item) !== 0;
}

export function isNewOrderCartItem(item: CartItem) {
  return cartItemStatus(item) === 1;
}

export function isOrderHistoryCartItem(item: CartItem) {
  const status = cartItemStatus(item);
  return status === null || (status !== 0 && status !== 1);
}

export function isServedCartItem(item: CartItem) {
  const statusText = optionalString(
    item.detail?.order_it_status_text,
  )?.toLowerCase();
  return cartItemStatus(item) === 4 || statusText === "served";
}

export function cartItems(cart: CartOrder | CartOrder[] | null) {
  return cartOrders(cart).flatMap((order) => order.items ?? []);
}

export function visibleCartItems(cart: CartOrder | CartOrder[] | null) {
  return cartItems(cart).filter(isVisibleCartItem);
}

export function cartOrderInvoice(orders: CartOrder[]) {
  for (const order of orders) {
    const invoice = optionalString(order.order_invoice);
    if (invoice) return invoice;
  }
  return null;
}

export function newOrderConfirmGroups(orders: CartOrder[]) {
  return orders
    .map((order) => ({
      orderUuid: optionalString(order.order_uuid),
      itemUuids: (order.items ?? [])
        .filter(isNewOrderCartItem)
        .map(cartItemUuid)
        .filter((uuid): uuid is string => Boolean(uuid)),
    }))
    .filter(
      (group) => Boolean(group.orderUuid) && group.itemUuids.length > 0,
    ) as {
    orderUuid: string;
    itemUuids: string[];
  }[];
}

export function cartItemsTotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + cartItemTotal(item), 0);
}

export function sumOrderValue(
  orders: CartOrder[],
  selector: (order: CartOrder) => number | null,
) {
  let hasValue = false;
  const total = orders.reduce((sum, order) => {
    const value = selector(order);
    if (value === null) return sum;
    hasValue = true;
    return sum + value;
  }, 0);
  return hasValue ? total : null;
}

export function firstOrderValue(
  orders: CartOrder[],
  selector: (order: CartOrder) => number | null,
) {
  for (const order of orders) {
    const value = selector(order);
    if (value !== null) return value;
  }
  return null;
}

export function cartSummary(cart: CartOrder | CartOrder[] | null) {
  const orders = cartOrders(cart);
  const visibleItemsTotal = cartItemsTotal(visibleCartItems(cart));
  const detailTotal = sumOrderValue(orders, (order) =>
    optionalNumber(order.sum_detail_total),
  );
  const toppingTotal = sumOrderValue(orders, (order) =>
    optionalNumber(order.sum_topping_total),
  );
  const discountTotal = sumOrderValue(orders, (order) =>
    optionalNumber(order.sum_discount_total),
  );
  const orderService = sumOrderValue(orders, (order) =>
    optionalNumber(order.totals?.order_service_amount),
  );
  const serviceTotal =
    orderService ??
    sumOrderValue(orders, (order) => optionalNumber(order.sum_service_total)) ??
    sumOrderValue(orders, (order) =>
      optionalNumber(order.service_charge_amount),
    );
  const vatTotal = sumOrderValue(orders, (order) =>
    optionalNumber(order.sum_vat_total, order.vat_amount),
  );
  const sumGrandTotal = sumOrderValue(orders, (order) =>
    optionalNumber(order.sum_grand_total),
  );
  const orderQty = sumOrderValue(orders, (order) =>
    optionalNumber(order.totals?.order_qty),
  );
  const orderTotal = sumOrderValue(orders, (order) =>
    optionalNumber(order.totals?.order_total),
  );
  const orderDiscount = sumOrderValue(orders, (order) =>
    optionalNumber(order.totals?.order_discount_amount),
  );
  const itemDiscount = sumOrderValue(orders, (order) =>
    optionalNumber(order.totals?.order_item_discount_amount),
  );
  const orderVat = sumOrderValue(orders, (order) =>
    optionalNumber(order.totals?.order_vat_amount),
  );
  const orderGrandTotal = sumOrderValue(orders, (order) =>
    optionalNumber(order.totals?.order_grand_total),
  );
  const subtotal =
    sumOrderValue(orders, (order) =>
      optionalNumber(
        order.totals?.order_subtotal,
        order.totals?.subtotal,
        order.subtotal,
      ),
    ) ?? visibleItemsTotal;
  const tax = orderVat ?? vatTotal ?? 0;
  const grandTotal =
    orderGrandTotal ??
    sumGrandTotal ??
    sumOrderValue(orders, (order) =>
      optionalNumber(order.totals?.total, order.total),
    ) ??
    subtotal + tax;
  const taxRate = firstOrderValue(orders, (order) =>
    optionalNumber(order.vat_rate, order.totals?.vat_rate, order.vat_name),
  );
  const serviceRate = firstOrderValue(orders, (order) =>
    optionalNumber(order.service_charge_rate, order.charge_name),
  );

  return {
    detailTotal,
    discountTotal,
    grandTotal,
    itemDiscount,
    orderDiscount,
    orderGrandTotal,
    orderQty,
    orderService,
    orderTotal,
    orderVat,
    serviceTotal,
    serviceRate,
    subtotal,
    sumGrandTotal,
    tax,
    taxRate,
    toppingTotal,
    vatTotal,
  };
}

export function formatRate(value: number | null) {
  if (value === null) return null;
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function normalizeDiscountType(value: unknown): DiscountTypeCode {
  return String(value).toUpperCase() === "AMT" ? "AMT" : "PCT";
}

export function discountDraftValue(
  draft: DiscountDraft,
  maxAmount: number | null = null,
) {
  const value = optionalNumber(draft.value);
  if (value === null || value < 0) return null;
  if (draft.type === "PCT" && value > 100) return null;
  if (draft.type === "AMT" && maxAmount !== null && value > maxAmount)
    return null;
  return value;
}

export function normalizeCalculatorValue(value: string) {
  const sanitized = value.replace(/[^\d.]/g, "");
  const [integer = "", ...decimalParts] = sanitized.split(".");
  const normalizedInteger = integer.replace(/^0+(?=\d)/, "");
  const decimal = decimalParts.join("");
  return sanitized.includes(".")
    ? `${normalizedInteger || "0"}.${decimal}`
    : normalizedInteger;
}

export function appendCalculatorInput(currentValue: string, input: string) {
  if (input === "clear") return "0";
  if (input === "delete") return currentValue.slice(0, -1);
  if (input === "." && currentValue.includes(".")) return currentValue;
  return normalizeCalculatorValue(`${currentValue}${input}`);
}

export function firstCartOrderUuid(orders: CartOrder[]) {
  for (const order of orders) {
    const orderUuid = optionalString(order.order_uuid);
    if (orderUuid) return orderUuid;
  }
  return null;
}

export function cartOrderUuidForItem(orders: CartOrder[], item: CartItem) {
  const itemUuid = cartItemActionUuid(item);
  if (!itemUuid) return null;

  for (const order of orders) {
    const orderUuid = optionalString(order.order_uuid);
    if (!orderUuid) continue;

    const hasItem = (order.items ?? []).some(
      (orderItem) => cartItemActionUuid(orderItem) === itemUuid,
    );
    if (hasItem) return orderUuid;
  }

  return null;
}

export function billDiscountButtonValue(order: CartOrder | undefined) {
  const value = optionalNumber(order?.order_discount_value);
  if (value === null || value <= 0) return null;

  if (normalizeDiscountType(order?.order_discount_type) === "PCT") {
    const rate = formatRate(value);
    return rate ? `${rate}%` : null;
  }

  return money(value);
}

export function isSplitPaymentEligibleItem(item: CartItem) {
  const status = cartItemStatus(item);
  return Boolean(cartItemActionUuid(item) && status !== 1 && status !== 9);
}

export function splitItemGrossTotal(item: CartItem) {
  const grossTotal = optionalNumber(item.detail?.gross_total);
  if (grossTotal !== null) return grossTotal;

  const baseLineTotal = optionalNumber(item.detail?.base_line_total);
  const toppingLineTotal = optionalNumber(item.detail?.topping_line_total);
  if (baseLineTotal !== null || toppingLineTotal !== null) {
    return (baseLineTotal ?? 0) + (toppingLineTotal ?? 0);
  }

  return cartItemTotal(item);
}

export function splitPaymentSelection(
  orders: CartOrder[],
  selectedItemUuids: Set<string>,
) {
  if (!selectedItemUuids.size) return null;

  for (const order of orders) {
    const selectedItems = (order.items ?? []).filter((item) => {
      const itemUuid = cartItemActionUuid(item);
      return Boolean(itemUuid && selectedItemUuids.has(itemUuid));
    });
    const orderUuid = optionalString(order.order_uuid);
    if (!orderUuid || selectedItems.length === 0) continue;

    const subtotal = selectedItems.reduce(
      (sum, item) => sum + splitItemGrossTotal(item),
      0,
    );
    const totalDiscount = selectedItems.reduce(
      (sum, item) =>
        sum + (optionalNumber(item.detail?.order_it_discount_amount) ?? 0),
      0,
    );
    const netTotal = subtotal - totalDiscount;
    const serviceRate =
      optionalNumber(order.service_charge_rate, order.charge_name) ?? 0;
    const taxRate =
      optionalNumber(order.vat_rate, order.totals?.vat_rate, order.vat_name) ??
      0;
    const serviceTotal = optionalBoolean(order.service_enabled)
      ? netTotal * (serviceRate / 100)
      : 0;
    const tax = optionalBoolean(order.vat_enabled)
      ? (netTotal + serviceTotal) * (taxRate / 100)
      : 0;
    const grandTotal = netTotal + serviceTotal + tax;
    const orderQty = selectedItems.reduce(
      (sum, item) => sum + cartItemQty(item),
      0,
    );
    const itemUuids = selectedItems
      .map(cartItemActionUuid)
      .filter((uuid): uuid is string => Boolean(uuid));
    const selectedOrder: CartOrder = {
      ...order,
      items: selectedItems,
      sum_detail_total: subtotal,
      sum_discount_total: totalDiscount,
      sum_grand_total: grandTotal,
      sum_service_total: serviceTotal,
      sum_vat_total: tax,
      totals: {
        ...order.totals,
        order_discount_amount: 0,
        order_grand_total: grandTotal,
        order_item_discount_amount: totalDiscount,
        order_qty: orderQty,
        order_service_amount: serviceTotal,
        order_subtotal: subtotal,
        order_total: subtotal,
        order_vat_amount: tax,
      },
    };
    const summary: ReturnType<typeof cartSummary> = {
      detailTotal: subtotal,
      discountTotal: totalDiscount,
      grandTotal,
      itemDiscount: totalDiscount,
      orderDiscount: 0,
      orderGrandTotal: grandTotal,
      orderQty,
      orderService: serviceTotal,
      orderTotal: subtotal,
      orderVat: tax,
      serviceRate,
      serviceTotal,
      subtotal,
      sumGrandTotal: grandTotal,
      tax,
      taxRate,
      toppingTotal: null,
      vatTotal: tax,
    };

    return {
      itemUuids,
      orderUuid,
      orders: [selectedOrder],
      summary,
    };
  }

  return null;
}

export function buildCustomerDisplayPayload({
  cart,
  now = new Date(),
  summary,
  table,
}: {
  cart: CartOrder | CartOrder[] | null;
  now?: Date;
  summary: ReturnType<typeof cartSummary>;
  table: PosTable;
}): CustomerDisplayPayload {
  const invoice = cartOrderInvoice(cartOrders(cart));
  const discountTotal = positiveNumber(summary.orderDiscount) ?? 0;

  return {
    discount: discountTotal,
    grand_total: summary.grandTotal,
    invoice,
    items: visibleCartItems(cart).map((item) => {
      const name = cartItemName(item);
      const sizeName = optionalString(item.detail?.size_name);
      const media = cartItemMedia(item);

      return {
        image: media.type === "image" ? media.src : null,
        imageColor: media.type === "color" ? media.color : null,
        name: cartItemDisplayName(name, sizeName),
        note: optionalString(item.detail?.order_it_note),
        price: optionalNumber(
          item.detail?.unit_price,
          item.price,
          item.prod_price,
          item.product_price,
        ),
        qty: cartItemQty(item),
        status: optionalString(item.detail?.order_it_status_text),
        total: cartItemTotal(item),
      };
    }),
    service: summary.serviceTotal ?? 0,
    subtotal: summary.subtotal,
    table_name: table.table_name,
    total: summary.grandTotal,
    updated_at: now.toISOString(),
    vat: summary.tax,
  };
}

export function filterZones(
  zones: PosZone[],
  search: string,
  statusFilter: TableStatusFilter,
) {
  const query = search.trim().toLowerCase();

  return zones
    .map((zone) => ({
      ...zone,
      tables: (zone.tables ?? []).filter((table) => {
        const matchesSearch =
          !query || table.table_name.toLowerCase().includes(query);
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "free" && tableStatus(table) === "free") ||
          (statusFilter === "busy" && tableStatus(table) === "busy") ||
          (statusFilter === "update" && Boolean(table.customer_order_state));
        return matchesSearch && matchesStatus;
      }),
    }))
    .filter((zone) => (zone.tables ?? []).length > 0);
}

export function tableCount(zones: PosZone[]) {
  return zones.reduce((total, zone) => total + (zone.tables ?? []).length, 0);
}

export function formatClock(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    hour12: true,
    minute: "2-digit",
    second: "2-digit",
  });
}
