import {
  OrderChannelEnum,
  OrderSourceEnum,
} from "@/config/pos-constants";
import {
  type CreateOrderInput,
  type CreateOrderItem,
  type CreateOrderTopping,
  type ProdDetail,
  type ProdItem,
} from "@/services/pos";
import { optionalString } from "@/lib/values";
import type { ProductModalMode } from "./menu-structure";
import { enabledProductDetails } from "./product-availability";
import { defaultOrderQty } from "./quantity-rules";
import { getOrderSelectionIssue } from "./order-selection-validation";
import { toppingUuid, type SelectedTopping } from "./topping-selection";

function buildStaffOrderToppings(toppings: SelectedTopping[]) {
  return toppings
    .map((selected) => {
      const uuid = toppingUuid(selected.topping);
      if (!uuid) return null;
      return {
        prod_topping_uuid_fk: uuid,
        topping_qty: selected.qty,
      } satisfies CreateOrderTopping;
    })
    .filter((topping): topping is CreateOrderTopping => Boolean(topping));
}

export function buildStaffOrderItems({
  detail,
  mode = "normal",
  noteText,
  product,
  quantity,
  toppings,
}: {
  detail: ProdDetail;
  mode?: ProductModalMode;
  noteText: string;
  product?: ProdItem | null;
  quantity: number;
  toppings: SelectedTopping[];
}) {
  const issue = getOrderSelectionIssue({
    detail,
    mode,
    product,
    quantity,
    toppings,
  });
  if (issue) throw new Error(`Invalid order selection: ${issue}`);

  const details = mode === "set" ? enabledProductDetails(product) : [detail];
  if (!details.length) throw new Error("pro_detail_uuid is required");

  const note = noteText.trim() || undefined;
  const orderToppings = buildStaffOrderToppings(toppings);

  return details.map((itemDetail, index) => {
    const detailId = optionalString(itemDetail.pro_detail_uuid);
    if (!detailId) throw new Error("pro_detail_uuid is required");

    const item: CreateOrderItem = {
      prod_detail_uuid_fk: detailId,
      order_it_qty:
        mode === "set" ? defaultOrderQty(itemDetail) * quantity : quantity,
      order_it_status: 1,
      order_it_note: note,
    };

    if (index === 0) item.toppings = orderToppings;
    return item;
  });
}

export function buildStaffOrderInput({
  branchUuid,
  detail,
  lang,
  mode = "normal",
  noteText,
  product,
  quantity,
  tableUuid,
  toppings,
  userUuid,
}: {
  branchUuid: string;
  detail: ProdDetail;
  lang: string;
  mode?: ProductModalMode;
  noteText: string;
  product?: ProdItem | null;
  quantity: number;
  tableUuid: string;
  toppings: SelectedTopping[];
  userUuid: string;
}): CreateOrderInput {
  if (!branchUuid) throw new Error("branch_uuid_fk is required");
  if (!userUuid) throw new Error("order_created_by is required");

  return {
    table_uuid_fk: tableUuid,
    branch_uuid_fk: branchUuid,
    lang,
    order_created_by: userUuid,
    order_source: OrderSourceEnum.POS,
    order_channel: OrderChannelEnum.DINE_IN,
    order_service_rate: 0,
    order_vat_rate: 0,
    items: buildStaffOrderItems({
      detail,
      mode,
      noteText,
      product,
      quantity,
      toppings,
    }),
  };
}
