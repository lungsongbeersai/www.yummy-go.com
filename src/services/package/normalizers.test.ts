import { describe, expect, it } from "vitest";
import {
  normalizeBillingCycles,
  normalizePackageMethods,
  normalizePackagePage,
  normalizePackagePlanGroups
} from "@/services/package/normalizers";

describe("package normalizers", () => {
  it("sorts copied billing cycles and parses numeric fields", () => {
    const raw = [
      {
        billing_cycle_uuid: "cycle-annual",
        billing_cycle_name: "Annual",
        billing_cycle_months: "12",
        billing_cycle_status: "2",
        sort_order: "2"
      },
      {
        billing_cycle_uuid: "cycle-monthly",
        billing_cycle_name: "Monthly",
        billing_cycle_months: "1",
        billing_cycle_status: "1",
        sort_order: "1"
      }
    ];

    expect(normalizeBillingCycles(raw)).toEqual([
      { id: "cycle-monthly", name: "Monthly", months: 1, status: 1, sortOrder: 1 },
      { id: "cycle-annual", name: "Annual", months: 12, status: 2, sortOrder: 2 }
    ]);
    expect(raw[0]?.sort_order).toBe("2");
  });

  it("normalizes package methods and defaults invalid status and sort order", () => {
    expect(
      normalizePackageMethods({
        data: [
          { package_method_uuid: "method-2", package_method_name: "Transfer", sort_order: "2" },
          {
            package_method_uuid: "method-1",
            package_method_name: "Cash",
            package_method_status: "invalid",
            sort_order: "invalid"
          }
        ]
      })
    ).toEqual([
      { id: "method-1", name: "Cash", status: 1, sortOrder: 0 },
      { id: "method-2", name: "Transfer", status: 1, sortOrder: 2 }
    ]);
  });

  it("normalizes plan groups with missing plan arrays as empty lists", () => {
    expect(
      normalizePackagePlanGroups({
        data: [
          {
            billing_cycle_uuid: "cycle-annual",
            billing_cycle_name: "Annual",
            billing_cycle_months: "12",
            billing_cycle_status: "2",
            sort_order: "2"
          },
          {
            billing_cycle_uuid: "cycle-monthly",
            billing_cycle_name: "Monthly",
            billing_cycle_months: "1",
            sort_order: "1",
            package_plans: [
              {
                package_plan_uuid: "plan-2",
                package_method_uuid_fk: "method-2",
                package_method_name: "Transfer",
                package_method_status: "2",
                package_plan_status: "2",
                package_plan_sort_order: "2"
              },
              {
                package_plan_uuid: "plan-1",
                package_method_uuid_fk: "method-1",
                package_method_name: "Cash",
                package_plan_status: "1",
                package_plan_sort_order: "1"
              }
            ]
          }
        ]
      })
    ).toEqual([
      {
        billingCycleId: "cycle-monthly",
        billingCycleName: "Monthly",
        months: 1,
        status: 1,
        sortOrder: 1,
        plans: [
          {
            id: "plan-1",
            billingCycleId: "cycle-monthly",
            methodId: "method-1",
            methodName: "Cash",
            methodStatus: 1,
            status: 1,
            sortOrder: 1
          },
          {
            id: "plan-2",
            billingCycleId: "cycle-monthly",
            methodId: "method-2",
            methodName: "Transfer",
            methodStatus: 2,
            status: 2,
            sortOrder: 2
          }
        ]
      },
      {
        billingCycleId: "cycle-annual",
        billingCycleName: "Annual",
        months: 12,
        status: 2,
        sortOrder: 2,
        plans: []
      }
    ]);
  });

  it("normalizes nested package groups using plan and detail API order", () => {
    const result = normalizePackagePage({
      page: "2",
      limit: "10",
      total: "21",
      total_pages: "3",
      data: [
        {
          billing_cycle_uuid: "cycle-1",
          billing_cycle_name: "Monthly",
          billing_cycle_name_la: "ລາຍເດືອນ",
          billing_cycle_name_eng: "Monthly",
          billing_cycle_months: "1",
          sort_order: "1",
          package_methods: [
            {
              package_plan_uuid: "plan-2",
              package_plan_sort_order: "3",
              sort_order: "1",
              package_method_uuid_fk: "method-2",
              package_method_name: "Transfer",
              package_method_name_la: "ໂອນເງິນ",
              package_method_name_eng: "Transfer",
              package_method_status: "2",
              packages: []
            },
            {
              package_plan_uuid: "plan-1",
              package_plan_sort_order: "2",
              package_method_master_sort_order: "1",
              package_method_uuid_fk: "method-1",
              package_method_name: "Cash",
              package_method_name_la: "ເງິນສົດ",
              package_method_name_eng: "Cash",
              packages: [
                {
                  package_uuid: "package-2",
                  package_name: "Premium",
                  package_price: "800000",
                  sort_order: "2"
                },
                {
                  package_uuid: "package-1",
                  package_name: "Starter",
                  package_name_la: "ເລີ່ມຕົ້ນ",
                  package_name_eng: "Starter",
                  package_price: "400000",
                  sort_order: "1",
                  details: [
                    { package_price_detail_uuid: "detail-2", sort_order: "2" },
                    { package_price_detail_uuid: "detail-1", sort_order: "1" }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    expect(result).toMatchObject({ page: 2, limit: 10, total: 21, totalPages: 3 });
    expect(result.groups[0]?.methods.map((method) => method.id)).toEqual(["plan-1", "plan-2"]);
    expect(result.groups[0]?.methods[0]?.sortOrder).toBe(2);
    expect(result.groups[0]?.methods[0]?.packages.map((item) => item.id)).toEqual([
      "package-1",
      "package-2"
    ]);
    expect(result.groups[0]?.methods[0]?.packages[0]?.details.map((detail) => detail.id)).toEqual([
      "detail-1",
      "detail-2"
    ]);
  });

  it("uses safe page metadata defaults for invalid values", () => {
    expect(normalizePackagePage({ page: "invalid", limit: 0, total: -1, total_pages: 0 })).toMatchObject({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
      totalBillingCycles: 0,
      totalPackageMethods: 0,
      groups: []
    });
  });
});
