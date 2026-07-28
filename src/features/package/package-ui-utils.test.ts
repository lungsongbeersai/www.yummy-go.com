import { describe, expect, it } from "vitest";
import type {
  PackageBillingGroup,
  PackageMethod,
  PackagePlan,
  PackagePlanGroup,
} from "@/services/package";
import {
  availableMethods,
  firstPlanId,
  packageRange,
  packagesForPlan,
  planById,
} from "./package-ui-utils";

const monthlyPlan: PackagePlan = {
  id: "plan-monthly-starter",
  billingCycleId: "cycle-monthly",
  methodId: "method-starter",
  methodName: "Starter",
  methodStatus: 1,
  status: 1,
  sortOrder: 1,
};

const yearlyPlan: PackagePlan = {
  id: "plan-yearly-professional",
  billingCycleId: "cycle-yearly",
  methodId: "method-professional",
  methodName: "Professional",
  methodStatus: 1,
  status: 1,
  sortOrder: 1,
};

const planGroups: PackagePlanGroup[] = [
  {
    billingCycleId: "cycle-monthly",
    billingCycleName: "Monthly",
    months: 1,
    status: 1,
    sortOrder: 1,
    plans: [monthlyPlan],
  },
  {
    billingCycleId: "cycle-yearly",
    billingCycleName: "Yearly",
    months: 12,
    status: 1,
    sortOrder: 2,
    plans: [yearlyPlan],
  },
];

const methods: PackageMethod[] = [
  {
    id: "method-starter",
    name: "Starter",
    status: 1,
    sortOrder: 1,
  },
  {
    id: "method-professional",
    name: "Professional",
    status: 1,
    sortOrder: 2,
  },
];

const packageGroups: PackageBillingGroup[] = [
  {
    id: "cycle-monthly",
    title: "Monthly",
    billingCycleId: "cycle-monthly",
    billingCycleName: "Monthly",
    billingCycleNameLa: "Monthly",
    billingCycleNameEn: "Monthly",
    months: 1,
    status: 1,
    sortOrder: 1,
    methods: [
      {
        id: "method-starter",
        title: "Starter",
        methodId: "method-starter",
        methodName: "Starter",
        methodNameLa: "Starter",
        methodNameEn: "Starter",
        methodStatus: 1,
        methodMasterSortOrder: 1,
        planId: "plan-monthly-starter",
        planStatus: 1,
        sortOrder: 1,
        packages: [
          {
            id: "package-basic",
            planId: "plan-monthly-starter",
            name: "Basic",
            nameLa: "Basic",
            nameEn: "Basic",
            price: 400_000,
            status: 1,
            sortOrder: 1,
            details: [],
          },
        ],
      },
      {
        id: "method-professional",
        title: "Professional",
        methodId: "method-professional",
        methodName: "Professional",
        methodNameLa: "Professional",
        methodNameEn: "Professional",
        methodStatus: 1,
        methodMasterSortOrder: 2,
        planId: "plan-monthly-professional",
        planStatus: 1,
        sortOrder: 2,
        packages: [
          {
            id: "package-pro",
            planId: "plan-monthly-professional",
            name: "Pro",
            nameLa: "Pro",
            nameEn: "Pro",
            price: 800_000,
            status: 1,
            sortOrder: 1,
            details: [],
          },
        ],
      },
    ],
  },
];

describe("package UI helpers", () => {
  it("selects the first plan from normalized sorted plan groups", () => {
    expect(firstPlanId(planGroups)).toBe("plan-monthly-starter");
    expect(firstPlanId([])).toBe("");
  });

  it("finds a plan across billing-cycle groups", () => {
    expect(planById(planGroups, "plan-yearly-professional")).toEqual(yearlyPlan);
    expect(planById(planGroups, "missing-plan")).toBeNull();
  });

  it("flattens only packages belonging to the selected plan", () => {
    expect(packagesForPlan(packageGroups, "plan-monthly-professional")).toEqual([
      expect.objectContaining({ id: "package-pro" }),
    ]);
    expect(packagesForPlan(packageGroups, "missing-plan")).toEqual([]);
  });

  it("calculates the visible range from backend pagination metadata", () => {
    expect(packageRange(2, 10, 24, 10)).toEqual({ start: 11, end: 20 });
    expect(packageRange(3, 10, 24, 4)).toEqual({ start: 21, end: 24 });
    expect(packageRange(1, 10, 0, 0)).toEqual({ start: 0, end: 0 });
  });

  it("excludes methods already connected to the selected billing cycle", () => {
    expect(availableMethods(methods, planGroups[0])).toEqual([
      methods[1],
    ]);
    expect(availableMethods(methods, null)).toEqual(methods);
  });
});
