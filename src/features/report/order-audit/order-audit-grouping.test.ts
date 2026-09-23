import { describe, expect, it } from "vitest";
import type { OrderAuditRow } from "@/services/report";
import {
  dominantAuditAction,
  groupEntityLabelsPreview,
  groupOrderAuditRows,
  groupRowsByEntity,
} from "./order-audit-grouping";

function row(overrides: Partial<OrderAuditRow>): OrderAuditRow {
  return {
    audit_id: "1",
    transaction_id: "tx-1",
    request_id: null,
    store_uuid_fk: "store-1",
    branch_uuid_fk: "branch-1",
    order_uuid_fk: "order-1",
    order_invoice: "210926-0002",
    related_order_uuid_fk: null,
    related_order_invoice: "",
    entity_type: "ITEM",
    entity_uuid: "entity-1",
    entity_label_la: "ກະແລ້ມ",
    entity_label_eng: "Ice cream",
    operation: "UPDATE",
    action: "UPDATE",
    actor_uuid: "actor-1",
    actor_name: "cashier@example.com",
    actor_type: "USER",
    route: "/posAll/confirm_to_kitchen_batch",
    reason: "",
    before_data: null,
    after_data: null,
    changed_fields: [],
    recorded_at: "2026-09-21T09:23:19.000000+00:00",
    ...overrides,
  };
}

describe("groupOrderAuditRows", () => {
  it("groups rows sharing a transaction_id into one event, preserving order", () => {
    const rows = [
      row({ audit_id: "3", transaction_id: "tx-2", action: "CREATE", recorded_at: "2026-09-21T09:23:18.000000+00:00" }),
      row({ audit_id: "2", transaction_id: "tx-1", action: "UPDATE", entity_uuid: "entity-1" }),
      row({ audit_id: "1", transaction_id: "tx-1", action: "DISCOUNT", entity_uuid: "entity-1" }),
    ];

    const groups = groupOrderAuditRows(rows);

    expect(groups).toHaveLength(2);
    expect(groups[0].id).toBe("tx-2");
    expect(groups[1].id).toBe("tx-1");
    expect(groups[1].rows.map((r) => r.audit_id)).toEqual(["2", "1"]);
    expect(groups[1].actions).toEqual(["UPDATE", "DISCOUNT"]);
    expect(groups[1].entityCount).toBe(1);
  });

  it("falls back to audit_id as the group key when transaction_id is missing", () => {
    const rows = [row({ audit_id: "1", transaction_id: "" }), row({ audit_id: "2", transaction_id: "" })];

    const groups = groupOrderAuditRows(rows);

    expect(groups).toHaveLength(2);
  });

  it("counts distinct entities touched in a transaction", () => {
    const rows = [
      row({ audit_id: "1", entity_uuid: "entity-a" }),
      row({ audit_id: "2", entity_uuid: "entity-b" }),
      row({ audit_id: "3", entity_uuid: "entity-a" }),
    ];

    const [group] = groupOrderAuditRows(rows);

    expect(group.entityCount).toBe(2);
  });
});

describe("dominantAuditAction", () => {
  it("picks the most severe action from a mixed set", () => {
    expect(dominantAuditAction(["UPDATE", "DISCOUNT"])).toBe("DISCOUNT");
    expect(dominantAuditAction(["CREATE", "CANCEL", "UPDATE"])).toBe("CANCEL");
    expect(dominantAuditAction(["PAYMENT", "CREATE"])).toBe("PAYMENT");
  });
});

describe("groupEntityLabelsPreview", () => {
  it("joins distinct entity labels and truncates with a count", () => {
    const rows = [
      row({ audit_id: "1", entity_uuid: "a", entity_label_la: "VIENT", entity_label_eng: "" }),
      row({ audit_id: "2", entity_uuid: "b", entity_label_la: "BIOS", entity_label_eng: "" }),
      row({ audit_id: "3", entity_uuid: "c", entity_label_la: "ເບຍອິນເດຍ", entity_label_eng: "" }),
    ];
    const [group] = groupOrderAuditRows(rows);

    expect(groupEntityLabelsPreview(group, "la")).toBe("VIENT, BIOS +1");
  });

  it("returns an empty string when no row has a label", () => {
    const [group] = groupOrderAuditRows([row({ entity_label_la: "", entity_label_eng: "" })]);

    expect(groupEntityLabelsPreview(group, "la")).toBe("");
  });
});

describe("groupRowsByEntity", () => {
  it("clusters a group's rows by entity_uuid without merging changed fields", () => {
    const rows = [
      row({ audit_id: "1", entity_uuid: "a", action: "DISCOUNT", changed_fields: ["order_it_discount_amount"] }),
      row({ audit_id: "2", entity_uuid: "a", action: "UPDATE", changed_fields: ["order_it_status"] }),
      row({ audit_id: "3", entity_uuid: "b", action: "UPDATE", changed_fields: ["order_it_status"] }),
    ];
    const [group] = groupOrderAuditRows(rows);

    const clusters = groupRowsByEntity(group);

    expect(clusters).toHaveLength(2);
    expect(clusters[0].map((r) => r.audit_id)).toEqual(["1", "2"]);
    expect(clusters[1].map((r) => r.audit_id)).toEqual(["3"]);
  });
});
