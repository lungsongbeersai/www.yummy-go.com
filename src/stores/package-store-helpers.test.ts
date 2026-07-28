import { describe, expect, it } from "vitest";
import type {
  BillingCycle,
  PackageBillingGroup,
  PackageDetail,
  PackageMethodGroup,
  PackagePlan,
  PackagePlanGroup
} from "@/services/package";
import {
  moveItem,
  replacePackageDetailOrder,
  replacePlanGroupOrder,
  withCycleOrder
} from "@/stores/package-store-helpers";

function plan(id: string, billingCycleId: string, sortOrder: number): PackagePlan {
  return {
    id,
    billingCycleId,
    methodId: `method-${id}`,
    methodName: id,
    methodStatus: 1,
    status: 1,
    sortOrder
  };
}

function detail(id: string, packageId: string, sortOrder: number): PackageDetail {
  return {
    id,
    packageId,
    name: id,
    nameLa: id,
    nameEn: id,
    status: 1,
    sortOrder
  };
}

function methodGroup(
  id: string,
  packageId: string,
  details: PackageDetail[]
): PackageMethodGroup {
  return {
    id,
    title: id,
    methodId: `method-${id}`,
    methodName: id,
    methodNameLa: id,
    methodNameEn: id,
    methodStatus: 1,
    methodMasterSortOrder: 1,
    planId: id,
    planStatus: 1,
    sortOrder: 1,
    packages: [
      {
        id: packageId,
        planId: id,
        name: packageId,
        nameLa: packageId,
        nameEn: packageId,
        price: 100,
        status: 1,
        sortOrder: 1,
        details
      }
    ]
  };
}

function billingGroup(
  id: string,
  methods: PackageMethodGroup[]
): PackageBillingGroup {
  return {
    id,
    title: id,
    billingCycleId: id,
    billingCycleName: id,
    billingCycleNameLa: id,
    billingCycleNameEn: id,
    months: 1,
    status: 1,
    sortOrder: 1,
    methods
  };
}

describe("package store helpers", () => {
  it("moves an item without mutating the input array", () => {
    const source = ["monthly", "quarterly", "annual"];

    const result = moveItem(source, 0, 2);

    expect(result).toEqual(["quarterly", "annual", "monthly"]);
    expect(result).not.toBe(source);
    expect(source).toEqual(["monthly", "quarterly", "annual"]);
  });

  it("assigns sequential cycle order using copied cycle objects", () => {
    const cycles: BillingCycle[] = [
      { id: "annual", name: "Annual", months: 12, status: 1, sortOrder: 8 },
      { id: "monthly", name: "Monthly", months: 1, status: 1, sortOrder: 4 }
    ];

    const result = withCycleOrder(cycles);

    expect(result.map((cycle) => cycle.sortOrder)).toEqual([1, 2]);
    expect(result).not.toBe(cycles);
    expect(result[0]).not.toBe(cycles[0]);
    expect(cycles.map((cycle) => cycle.sortOrder)).toEqual([8, 4]);
  });

  it("replaces and orders plans only in the selected cycle", () => {
    const selectedPlans = [plan("plan-a", "cycle-a", 9), plan("plan-b", "cycle-a", 4)];
    const unrelatedGroup: PackagePlanGroup = {
      billingCycleId: "cycle-b",
      billingCycleName: "Cycle B",
      months: 12,
      status: 1,
      sortOrder: 2,
      plans: [plan("plan-c", "cycle-b", 1)]
    };
    const groups: PackagePlanGroup[] = [
      {
        billingCycleId: "cycle-a",
        billingCycleName: "Cycle A",
        months: 1,
        status: 1,
        sortOrder: 1,
        plans: []
      },
      unrelatedGroup
    ];

    const result = replacePlanGroupOrder(groups, "cycle-a", selectedPlans);

    expect(result).not.toBe(groups);
    expect(result[0]).not.toBe(groups[0]);
    expect(result[0]?.plans.map((item) => [item.id, item.sortOrder])).toEqual([
      ["plan-a", 1],
      ["plan-b", 2]
    ]);
    expect(result[0]?.plans[0]).not.toBe(selectedPlans[0]);
    expect(result[1]).toBe(unrelatedGroup);
    expect(selectedPlans.map((item) => item.sortOrder)).toEqual([9, 4]);
    expect(replacePlanGroupOrder(groups, "missing", selectedPlans)).toBe(groups);
  });

  it("replaces and orders details only in the selected package", () => {
    const orderedDetails = [
      detail("detail-b", "package-a", 7),
      detail("detail-a", "package-a", 3)
    ];
    const unrelatedMethod = methodGroup(
      "plan-b",
      "package-b",
      [detail("detail-c", "package-b", 1)]
    );
    const unrelatedGroup = billingGroup("cycle-b", [
      methodGroup("plan-c", "package-c", [detail("detail-d", "package-c", 1)])
    ]);
    const groups = [
      billingGroup("cycle-a", [
        methodGroup("plan-a", "package-a", []),
        unrelatedMethod
      ]),
      unrelatedGroup
    ];

    const result = replacePackageDetailOrder(groups, "package-a", orderedDetails);

    expect(result).not.toBe(groups);
    expect(result[0]).not.toBe(groups[0]);
    expect(result[0]?.methods).not.toBe(groups[0]?.methods);
    expect(result[0]?.methods[0]).not.toBe(groups[0]?.methods[0]);
    expect(result[0]?.methods[0]?.packages).not.toBe(groups[0]?.methods[0]?.packages);
    expect(result[0]?.methods[0]?.packages[0]).not.toBe(
      groups[0]?.methods[0]?.packages[0]
    );
    expect(
      result[0]?.methods[0]?.packages[0]?.details.map((item) => [
        item.id,
        item.sortOrder
      ])
    ).toEqual([
      ["detail-b", 1],
      ["detail-a", 2]
    ]);
    expect(result[0]?.methods[0]?.packages[0]?.details[0]).not.toBe(orderedDetails[0]);
    expect(result[0]?.methods[1]).toBe(unrelatedMethod);
    expect(result[1]).toBe(unrelatedGroup);
    expect(orderedDetails.map((item) => item.sortOrder)).toEqual([7, 3]);
    expect(replacePackageDetailOrder(groups, "missing", orderedDetails)).toBe(groups);
  });
});
