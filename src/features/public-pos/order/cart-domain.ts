import type { TFunction } from "i18next";
import { Ban, CheckCircle2, ChefHat, Clock3, Send } from "lucide-react";
import type {
  CartItem,
  CartOrder,
  FetchCartStatusRule,
  ProdItem,
} from "@/services/pos";
import type { PublicAddToCartPayload } from "@/features/public-pos/order/types";
import { numeric } from "./numeric";

export function getConfirmableOrderPayload(
  cart: CartOrder[],
  statusRule: FetchCartStatusRule | null,
) {
  const order = cart.find((cartOrder) =>
    (cartOrder.items ?? []).some((item) =>
      isConfirmableCartItem(item, statusRule),
    ),
  );
  if (!order?.order_uuid) return null;

  const orderItemUuids = (order.items ?? [])
    .filter((item) => isConfirmableCartItem(item, statusRule))
    .map(getOrderItemUuid)
    .filter(Boolean);

  return orderItemUuids.length
    ? { orderUuid: order.order_uuid, orderItemUuids }
    : null;
}

export function findExistingCartItem(
  cart: CartOrder[],
  product: ProdItem,
  payload: PublicAddToCartPayload,
  statusRule: FetchCartStatusRule | null,
) {
  const detailUuid = payload.detail.pro_detail_uuid;
  const toppingIds = payload.toppings
    .map((selected) =>
      selected.topping.prod_topping_uuid
        ? `${selected.topping.prod_topping_uuid}:${selected.qty}`
        : "",
    )
    .filter(Boolean)
    .sort();
  const toppingNames = payload.toppings
    .map((selected) =>
      selected.topping.topping_name
        ? `${selected.topping.topping_name}:${selected.qty}`
        : "",
    )
    .filter(Boolean)
    .sort();

  for (const order of cart) {
    for (const item of order.items ?? []) {
      if (!isEditableCartItem(item, statusRule)) continue;
      if ((item.detail?.order_it_note || "") !== (payload.note || "")) continue;

      const itemDetailUuid = String(
        item.pro_detail_uuid_fk ??
          item.pro_detail_uuid ??
          item.detail?.pro_detail_uuid ??
          "",
      );
      const itemProductUuid = String(item.prod_uuid_fk ?? item.prod_uuid ?? "");
      const matchesProduct =
        itemDetailUuid === detailUuid ||
        itemProductUuid === product.prod_uuid ||
        cartItemTitle(item).includes(product.prod_name);

      if (!matchesProduct) continue;

      const existingIds = (item.toppings ?? [])
        .map((topping) => {
          const uuid = String(
            topping.prod_topping_uuid_fk ?? topping.prod_topping_uuid ?? "",
          );
          const qty = Math.max(1, numeric(topping.topping_qty));
          return uuid ? `${uuid}:${qty}` : "";
        })
        .filter(Boolean)
        .sort();
      const existingNames = (item.toppings ?? [])
        .map((topping) => {
          const name = topping.topping_name ?? "";
          const qty = Math.max(1, numeric(topping.topping_qty));
          return name ? `${name}:${qty}` : "";
        })
        .filter(Boolean)
        .sort();
      const idsMatch =
        existingIds.length === toppingIds.length &&
        existingIds.every((id, index) => id === toppingIds[index]);
      const namesMatch =
        existingNames.length === toppingNames.length &&
        existingNames.every((name, index) => name === toppingNames[index]);

      if (
        idsMatch ||
        namesMatch ||
        (!existingIds.length &&
          !existingNames.length &&
          !toppingIds.length &&
          !toppingNames.length)
      ) {
        return item;
      }
    }
  }

  return null;
}

export function totalCartQty(cart: CartOrder[]) {
  return cart.reduce(
    (sum, order) =>
      sum +
      (order.items ?? []).reduce(
        (itemSum, item) => itemSum + getCartItemQty(item),
        0,
      ),
    0,
  );
}

export function getCartItemStatusCode(item: CartItem) {
  const status = Number(
    item.detail?.order_it_status ?? item.order_it_status ?? 0,
  );
  return Number.isFinite(status) ? status : 0;
}

export function getCartItemApiStatusText(item: CartItem) {
  return String(item.detail?.order_it_status_text ?? "").trim();
}

export function cartGroupTitle(items: CartItem[], fallback: string) {
  const apiLabels = items.map(getCartItemApiStatusText).filter(Boolean);
  if (!apiLabels.length) return fallback;

  const [firstLabel] = apiLabels;
  return apiLabels.every((label) => label === firstLabel)
    ? firstLabel
    : fallback;
}

export function normalizedStatusText(item: CartItem) {
  return getCartItemApiStatusText(item).toLowerCase();
}

export function statusTextIncludes(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

export function isCanceledCartItem(item: CartItem) {
  const text = normalizedStatusText(item);
  return (
    getCartItemStatusCode(item) === 9 ||
    statusTextIncludes(text, [
      "cancel",
      "canceled",
      "cancelled",
      "ຍົກເລີກ",
    ])
  );
}

export function isServedCartItem(item: CartItem) {
  const text = normalizedStatusText(item);
  return (
    getCartItemStatusCode(item) === 4 ||
    statusTextIncludes(text, ["served", "ເສີບ"])
  );
}

export function isConfirmableCartItem(
  item: CartItem,
  statusRule: FetchCartStatusRule | null,
) {
  const ruleStatus = Number(statusRule?.not_confirmed_status);
  const status = getCartItemStatusCode(item);

  if (
    Number.isFinite(ruleStatus) &&
    ruleStatus !== 0 &&
    status === ruleStatus
  ) {
    return false;
  }

  return isCustomerDraftCartItem(item);
}

export function isEditableCartItem(
  item: CartItem,
  statusRule: FetchCartStatusRule | null,
) {
  return (
    isConfirmableCartItem(item, statusRule) && Boolean(getOrderItemUuid(item))
  );
}

export function isCustomerDraftCartItem(item: CartItem) {
  return (
    getCartItemStatusCode(item) === 0 &&
    !isCanceledCartItem(item) &&
    !isServedCartItem(item)
  );
}

export function isWaitingStaffConfirmCartItem(item: CartItem) {
  return (
    getCartItemStatusCode(item) === 1 &&
    !isCanceledCartItem(item) &&
    !isServedCartItem(item)
  );
}

export function isOpenCartItemForStock(item: CartItem) {
  return isCustomerDraftCartItem(item) || isWaitingStaffConfirmCartItem(item);
}

export function getCartItemStatus(item: CartItem, t: TFunction) {
  const status = getCartItemStatusCode(item);
  const apiLabel = getCartItemApiStatusText(item);

  if (status === 9 || isCanceledCartItem(item)) {
    return {
      label: apiLabel || t("pos.cartStatusCanceled"),
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-500/35 dark:bg-red-950/35 dark:text-red-200",
      Icon: Ban,
    };
  }

  if (status === 0) {
    return {
      label: apiLabel || t("pos.cartStatusWaiting"),
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/35 dark:bg-amber-950/35 dark:text-amber-200",
      Icon: Clock3,
    };
  }

  if (status === 1) {
    return {
      label: apiLabel || t("pos.cartStatusWaitingConfirm"),
      className:
        "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/35 dark:bg-sky-950/35 dark:text-sky-200",
      Icon: Clock3,
    };
  }

  if (status === 2) {
    return {
      label: apiLabel || t("pos.cartStatusSentKitchen"),
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-950/35 dark:text-emerald-200",
      Icon: ChefHat,
    };
  }

  if (status === 4) {
    return {
      label: apiLabel || t("pos.cartStatusServed"),
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-950/35 dark:text-emerald-200",
      Icon: CheckCircle2,
    };
  }

  return {
    label: apiLabel || t("pos.cartStatusCooking"),
    className:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/35 dark:bg-sky-950/35 dark:text-sky-200",
    Icon: Send,
  };
}

export function getOrderItemUuid(item: CartItem) {
  return String(
    item.order_it_uuid ?? item.order_item_uuid ?? item.id ?? "",
  ).trim();
}

export function getCartItemQty(item: CartItem) {
  const qty = Number(
    item.detail?.order_it_qty ?? item.qty ?? item.quantity ?? 0,
  );
  return Number.isFinite(qty) ? qty : 0;
}

export function getCartItemTotal(item: CartItem) {
  return numeric(item.detail?.net_total ?? item.total ?? item.price);
}

export function getOrderGrandTotal(order: CartOrder) {
  return numeric(
    order.sum_grand_total ??
      order.totals?.order_grand_total ??
      order.totals?.total ??
      order.totals?.subtotal ??
      order.sum_detail_total,
  );
}

export function getCartReceiptTotals(cart: CartOrder[]) {
  return cart.reduce(
    (totals, order) => {
      const itemDiscount = numeric(
        order.totals?.order_item_discount_amount ??
          (order.items ?? []).reduce(
            (sum, item) => sum + numeric(item.detail?.order_it_discount_amount),
            0,
          ),
      );
      const orderDiscount =
        order.totals?.order_discount_amount !== undefined
          ? numeric(order.totals.order_discount_amount)
          : numeric(order.sum_discount_total) - itemDiscount;

      totals.subtotal += numeric(
        order.totals?.order_subtotal ??
          order.totals?.order_total ??
          (order.items ?? []).reduce(
            (sum, item) =>
              sum +
              numeric(
                item.detail?.gross_total ??
                  item.detail?.net_total ??
                  item.total,
              ),
            0,
          ),
      );
      totals.itemDiscount += Math.max(0, itemDiscount);
      totals.orderDiscount += Math.max(0, orderDiscount);
      totals.service += numeric(
        order.totals?.order_service_amount ??
          order.service_charge_amount ??
          order.sum_service_total,
      );
      totals.vat += numeric(
        order.totals?.order_vat_amount ??
          order.vat_amount ??
          order.sum_vat_total,
      );
      return totals;
    },
    { subtotal: 0, itemDiscount: 0, orderDiscount: 0, service: 0, vat: 0 },
  );
}

export function cartItemTitle(item: CartItem) {
  return item.title || item.prod_name || "";
}
