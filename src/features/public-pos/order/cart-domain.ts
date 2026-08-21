import type { TFunction } from "i18next";
import { Ban, CheckCircle2, ChefHat, Clock3, Send } from "lucide-react";
import {
  isCanceledCartStatus,
  isServedCartStatusFlexible,
} from "@/lib/pos/cart-status";
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
  const detailUuid = payload.detail.proDetailUuid;
  const toppingIds = payload.toppings
    .map((selected) =>
      selected.topping.prodToppingUuid
        ? `${selected.topping.prodToppingUuid}:${selected.qty}`
        : "",
    )
    .filter(Boolean)
    .sort();
  const toppingNames = payload.toppings
    .map((selected) =>
      selected.topping.toppingName
        ? `${selected.topping.toppingName}:${selected.qty}`
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
        itemProductUuid === product.prodUuid ||
        cartItemTitle(item).includes(product.prodName);

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

// P3.3: the "code 9 or these words" / "code 4 or these words" decisions are
// now shared with pos/table-selection/cart-readers.ts in
// src/lib/pos/cart-status.ts (isCanceledCartItem's decision is
// byte-identical between the two trees; isServedCartItem's genuinely
// diverges — the public menu also matches the Lao word "ເສີບ" as a
// substring, table-selection doesn't — so it's kept as a distinctly-named
// "flexible" rule). This file keeps its own status-code/text extraction
// unchanged.
export function isCanceledCartItem(item: CartItem) {
  return isCanceledCartStatus(
    getCartItemStatusCode(item),
    normalizedStatusText(item),
  );
}

export function isServedCartItem(item: CartItem) {
  return isServedCartStatusFlexible(
    getCartItemStatusCode(item),
    normalizedStatusText(item),
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
      className: "border-destructive/30 bg-destructive/10 text-destructive",
      Icon: Ban,
    };
  }

  if (status === 0) {
    return {
      label: apiLabel || t("pos.cartStatusWaiting"),
      className: "border-warning/30 bg-warning/10 text-warning",
      Icon: Clock3,
    };
  }

  if (status === 1) {
    return {
      label: apiLabel || t("pos.cartStatusWaitingConfirm"),
      className: "border-info/30 bg-info/10 text-info",
      Icon: Clock3,
    };
  }

  if (status === 2) {
    return {
      label: apiLabel || t("pos.cartStatusSentKitchen"),
      className: "border-success/30 bg-success/10 text-success",
      Icon: ChefHat,
    };
  }

  if (status === 4) {
    return {
      label: apiLabel || t("pos.cartStatusServed"),
      className: "border-success/30 bg-success/10 text-success",
      Icon: CheckCircle2,
    };
  }

  return {
    label: apiLabel || t("pos.cartStatusCooking"),
    className: "border-info/30 bg-info/10 text-info",
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
