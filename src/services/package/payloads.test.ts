import { describe, expect, it } from "vitest";
import {
  buildBillingCycleReorderPayload,
  buildCreatePackagePlanPayload,
  buildDetailReorderPayload,
  buildPlanReorderPayload,
  buildSavePackagePayload
} from "@/services/package/payloads";

describe("package payload builders", () => {
  it("builds the exact create package plan payload", () => {
    expect(
      buildCreatePackagePlanPayload({
        billingCycleId: "cycle-1",
        methodId: "method-1",
        status: 1,
        sortOrder: 4
      })
    ).toEqual({
      billing_cycle_uuid_fk: "cycle-1",
      package_method_uuid_fk: "method-1",
      package_plan_status: 1,
      sort_order: 4
    });
  });

  it("builds an exact create package payload with empty new UUIDs", () => {
    expect(
      buildSavePackagePayload({
        planId: "plan-1",
        nameLa: "ພື້ນຖານ",
        nameEn: "Basic",
        price: 400000,
        status: 1,
        language: "la",
        details: [{ nameLa: "ລາຍລະອຽດ", nameEn: "Details", status: 2 }]
      })
    ).toEqual({
      package_uuid: "",
      package_plan_uuid_fk: "plan-1",
      package_name_la: "ພື້ນຖານ",
      package_name_eng: "Basic",
      package_price: 400000,
      package_status: 1,
      lang: "la",
      details: [
        {
          package_price_detail_uuid: "",
          detail_name_la: "ລາຍລະອຽດ",
          detail_name_eng: "Details",
          detail_status: 2
        }
      ]
    });
  });

  it("preserves package and detail UUIDs when building an update payload", () => {
    expect(
      buildSavePackagePayload({
        id: "package-1",
        planId: "plan-1",
        nameLa: "ປັບປຸງ",
        nameEn: "Updated",
        price: 0,
        status: 0,
        language: "EN",
        details: [
          { id: "detail-1", nameLa: "ລາຍລະອຽດເກົ່າ", nameEn: "Existing detail", status: 1 },
          { nameLa: "ລາຍລະອຽດໃໝ່", nameEn: "New detail", status: 0 }
        ]
      })
    ).toEqual({
      package_uuid: "package-1",
      package_plan_uuid_fk: "plan-1",
      package_name_la: "ປັບປຸງ",
      package_name_eng: "Updated",
      package_price: 0,
      package_status: 2,
      lang: "eng",
      details: [
        {
          package_price_detail_uuid: "detail-1",
          detail_name_la: "ລາຍລະອຽດເກົ່າ",
          detail_name_eng: "Existing detail",
          detail_status: 1
        },
        {
          package_price_detail_uuid: "",
          detail_name_la: "ລາຍລະອຽດໃໝ່",
          detail_name_eng: "New detail",
          detail_status: 2
        }
      ]
    });
  });

  it("builds all exact reorder payloads with one-based sort orders", () => {
    expect(buildBillingCycleReorderPayload([{ id: "cycle-2" }, { id: "cycle-1" }])).toEqual({
      items: [
        { billing_cycle_uuid: "cycle-2", sort_order: 1 },
        { billing_cycle_uuid: "cycle-1", sort_order: 2 }
      ]
    });
    expect(buildPlanReorderPayload("cycle-1", [{ id: "plan-2" }, { id: "plan-1" }])).toEqual({
      billing_cycle_uuid_fk: "cycle-1",
      items: [
        { package_plan_uuid: "plan-2", sort_order: 1 },
        { package_plan_uuid: "plan-1", sort_order: 2 }
      ]
    });
    expect(buildDetailReorderPayload("package-1", [{ id: "detail-2" }, { id: "detail-1" }])).toEqual({
      package_uuid_fk: "package-1",
      items: [
        { package_price_detail_uuid: "detail-2", sort_order: 1 },
        { package_price_detail_uuid: "detail-1", sort_order: 2 }
      ]
    });
  });

  it("rejects blank translations, missing IDs, invalid prices, and empty detail lists", () => {
    expect(() =>
      buildSavePackagePayload({
        planId: "",
        nameLa: "",
        nameEn: "Basic",
        price: Number.NaN,
        status: 1,
        details: []
      })
    ).toThrow();
  });
});
