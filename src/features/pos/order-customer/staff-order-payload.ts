import {
  OrderChannelEnum,
  OrderSourceEnum,
} from "@/config/pos-constants";
import {
  type CreateOrderInput,
  type CreateOrderItem,
  type CreateOrderTaste,
  type CreateOrderTopping,
  type ProdDetail,
  type ProdItem,
  type ProdTaste,
} from "@/services/pos";
import { optionalNumber, optionalString } from "@/lib/values";
import { createMutationUuid } from "@/lib/pos/mutation-identity";
import type { ProductModalMode } from "./menu-structure";
import { defaultOrderQty } from "./quantity-rules";
import { getOrderSelectionIssue } from "./order-selection-validation";
import {
  resolveSetOrderDetails,
  selectedSetChoiceGroupUuidsForDetail,
} from "./set-choice-selection";
import { toppingUuid, type SelectedTopping } from "./topping-selection";
import { tasteUuid } from "./taste-selection";

function buildStaffOrderTastes(tastes: ProdTaste[]) {
  return tastes
    .map((taste) => {
      const uuid = tasteUuid(taste);
      return uuid ? ({ taste_uuid_fk: uuid } satisfies CreateOrderTaste) : null;
    })
    .filter((taste): taste is CreateOrderTaste => Boolean(taste));
}

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
  selectedSetChoiceUuids = {},
  selectedSetChoiceTasteUuids = {},
  setInstanceUuid,
  tastes = [],
  toppings,
}: {
  detail: ProdDetail;
  mode?: ProductModalMode;
  noteText: string;
  product?: ProdItem | null;
  quantity: number;
  selectedSetChoiceUuids?: Record<string, string[]>;
  selectedSetChoiceTasteUuids?: Record<string, string[]>;
  setInstanceUuid?: string;
  tastes?: ProdTaste[];
  toppings: SelectedTopping[];
}) {
  const issue = getOrderSelectionIssue({
    detail,
    mode,
    product,
    quantity,
    tastes,
    toppings,
  });
  if (issue) throw new Error(`Invalid order selection: ${issue}`);

  const details =
    mode === "set" ? resolveSetOrderDetails(product, selectedSetChoiceUuids) : [detail];
  if (!details.length) throw new Error("pro_detail_uuid is required");

  const note = noteText.trim() || undefined;
  const orderToppings = buildStaffOrderToppings(toppings);
  const orderTastes = buildStaffOrderTastes(tastes);
  const hasNestedSetTastes = mode === "set" && details.some(
    (itemDetail) => (optionalNumber(itemDetail.setTasteMaxSelect) ?? 0) > 0,
  );
  const resolvedSetInstanceUuid = mode === "set"
    ? setInstanceUuid ?? createMutationUuid()
    : undefined;

  return details.map((itemDetail, index) => {
    const detailId = optionalString(itemDetail.proDetailUuid);
    if (!detailId) throw new Error("pro_detail_uuid is required");

    const item: CreateOrderItem = {
      prod_detail_uuid_fk: detailId,
      ...(resolvedSetInstanceUuid
        ? {
            set_instance_uuid: resolvedSetInstanceUuid,
            set_choice_group_uuid_fks: selectedSetChoiceGroupUuidsForDetail(
              product,
              selectedSetChoiceUuids,
              detailId,
            ),
          }
        : {}),
      order_it_qty:
        mode === "set" ? defaultOrderQty(itemDetail) * quantity : quantity,
      order_it_status: 1,
      order_it_note: note,
    };

    if (mode === "set" && hasNestedSetTastes) {
      const rawSelectedTasteUuids = selectedSetChoiceTasteUuids[detailId] ?? [];
      const selectedTasteUuids = new Set(rawSelectedTasteUuids);
      const tasteLimit = optionalNumber(itemDetail.setTasteMaxSelect) ?? 0;
      const allowedTasteUuids = new Set(
        (itemDetail.setTastes ?? []).map(tasteUuid).filter(Boolean),
      );
      if (
        selectedTasteUuids.size !== rawSelectedTasteUuids.length ||
        selectedTasteUuids.size > tasteLimit ||
        [...selectedTasteUuids].some((uuid) => !allowedTasteUuids.has(uuid))
      ) {
        throw new Error("Invalid SET taste selection");
      }
      const detailTastes = (itemDetail.setTastes ?? []).filter((taste) =>
        selectedTasteUuids.has(tasteUuid(taste)),
      );
      const selectedDetailTastes = buildStaffOrderTastes(detailTastes);
      if (selectedDetailTastes.length) item.tastes = selectedDetailTastes;
    }

    if (index === 0) {
      if ((!resolvedSetInstanceUuid || !hasNestedSetTastes) && orderTastes.length) {
        item.tastes = orderTastes;
      }
      item.toppings = orderToppings;
    }
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
  selectedSetChoiceUuids = {},
  selectedSetChoiceTasteUuids = {},
  tableUuid,
  tastes = [],
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
  selectedSetChoiceUuids?: Record<string, string[]>;
  selectedSetChoiceTasteUuids?: Record<string, string[]>;
  tableUuid: string;
  tastes?: ProdTaste[];
  toppings: SelectedTopping[];
  userUuid: string;
}): CreateOrderInput {
  if (!branchUuid) throw new Error("branch_uuid_fk is required");
  if (!userUuid) throw new Error("order_created_by is required");

  return {
    ...(tableUuid ? { table_uuid_fk: tableUuid } : {}),
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
      selectedSetChoiceUuids,
      selectedSetChoiceTasteUuids,
      tastes,
      toppings,
    }),
  };
}
