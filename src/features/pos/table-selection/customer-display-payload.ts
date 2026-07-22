import { optionalNumber, optionalString } from "@/lib/values";
import type { CustomerDisplayPayload } from "@/features/customer-display/shared/customer-display-sync";
import type { CartOrder, PosTable } from "@/services/pos";
import {
  cartItemDisplayName,
  cartItemMedia,
  cartItemName,
  cartItemQty,
  cartItemTotal,
  cartOrderInvoice,
  cartOrders,
  cartSummary,
  positiveNumber,
  visibleCartItems,
} from "./cart-readers";

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
