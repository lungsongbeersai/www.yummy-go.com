import { describe, expect, it } from "vitest";
import type {
  BillingCycle,
  PackageBillingGroup,
  PackageMethod,
  PackagePlan,
  PackagePlanGroup,
} from "@/services/package";
import {
  activePackageNavigation,
  availableMethods,
  cycleSavingsPercent,
  monthlyEquivalentPrice,
  orderedPlanColumns,
  packagesForPlan,
  planById,
  validatePackageDraft,
  validatePlanDraft,
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

const billingCycles: BillingCycle[] = [
  {
    id: "cycle-inactive",
    name: "Inactive",
    months: 0,
    status: 2,
    sortOrder: 0,
  },
  {
    id: "cycle-monthly",
    name: "Monthly",
    months: 1,
    status: 1,
    sortOrder: 1,
  },
  {
    id: "cycle-yearly",
    name: "Yearly",
    months: 12,
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
  it("selects the first active cycle without skipping to a later cycle that has an active plan", () => {
    const inactivePlan: PackagePlan = {
      ...monthlyPlan,
      id: "plan-monthly-inactive",
      status: 2,
    };
    const inactiveMethodPlan: PackagePlan = {
      ...monthlyPlan,
      id: "plan-monthly-inactive-method",
      methodStatus: 2,
    };
    const navigation = activePackageNavigation(
      billingCycles,
      [
        {
          ...planGroups[0],
          plans: [inactivePlan, inactiveMethodPlan],
        },
        planGroups[1],
        {
          ...planGroups[1],
          billingCycleId: "cycle-inactive",
          status: 2,
        },
      ],
      "",
      "",
    );

    expect(navigation.billingCycles.map((cycle) => cycle.id)).toEqual([
      "cycle-monthly",
      "cycle-yearly",
    ]);
    expect(navigation.planGroups.map((group) => group.billingCycleId)).toEqual([
      "cycle-monthly",
      "cycle-yearly",
    ]);
    expect(navigation.planGroups[0]?.plans).toEqual([]);
    expect(navigation.cycleId).toBe("cycle-monthly");
    expect(navigation.planId).toBe("");
  });

  it("keeps a valid active user selection when it is not first in catalog order", () => {
    const navigation = activePackageNavigation(
      [billingCycles[1], billingCycles[2]],
      [planGroups[0], planGroups[1]],
      "cycle-yearly",
      "plan-yearly-professional",
    );

    expect(navigation.cycleId).toBe("cycle-yearly");
    expect(navigation.planId).toBe("plan-yearly-professional");
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

  it("excludes methods already connected to the selected billing cycle", () => {
    expect(availableMethods(methods, planGroups[0])).toEqual([
      methods[1],
    ]);
    expect(availableMethods(methods, null)).toEqual(methods);
  });

  it("excludes a method connected by an inactive plan", () => {
    const groupWithInactivePlan: PackagePlanGroup = {
      ...planGroups[0],
      plans: [
        monthlyPlan,
        {
          ...monthlyPlan,
          id: "plan-monthly-professional-inactive",
          methodId: "method-professional",
          methodName: "Professional",
          status: 2,
          sortOrder: 2,
        },
      ],
    };

    expect(availableMethods(methods, groupWithInactivePlan)).toEqual([]);
  });
});

describe("package form validation", () => {
  it("returns the first missing plan draft field", () => {
    expect(
      validatePlanDraft({ billingCycleId: "", methodId: "" }),
    ).toBe("billingCycle");
    expect(
      validatePlanDraft({
        billingCycleId: "cycle-monthly",
        methodId: "",
      }),
    ).toBe("method");
    expect(
      validatePlanDraft({
        billingCycleId: "cycle-monthly",
        methodId: "method-starter",
      }),
    ).toBeNull();
  });

  it.each([
    {
      draft: {
        planId: "",
        nameLa: "ແພັກເກດ",
        nameEn: "Package",
        price: "100",
        details: [{ nameLa: "ລາຍລະອຽດ", nameEn: "Detail" }],
      },
      expected: "plan",
    },
    {
      draft: {
        planId: "plan-1",
        nameLa: "   ",
        nameEn: "Package",
        price: "100",
        details: [{ nameLa: "ລາຍລະອຽດ", nameEn: "Detail" }],
      },
      expected: "nameLa",
    },
    {
      draft: {
        planId: "plan-1",
        nameLa: "ແພັກເກດ",
        nameEn: "   ",
        price: "100",
        details: [{ nameLa: "ລາຍລະອຽດ", nameEn: "Detail" }],
      },
      expected: "nameEn",
    },
    {
      draft: {
        planId: "plan-1",
        nameLa: "ແພັກເກດ",
        nameEn: "Package",
        price: "-1",
        details: [{ nameLa: "ລາຍລະອຽດ", nameEn: "Detail" }],
      },
      expected: "price",
    },
    {
      draft: {
        planId: "plan-1",
        nameLa: "ແພັກເກດ",
        nameEn: "Package",
        price: "Infinity",
        details: [{ nameLa: "ລາຍລະອຽດ", nameEn: "Detail" }],
      },
      expected: "price",
    },
    {
      draft: {
        planId: "plan-1",
        nameLa: "ແພັກເກດ",
        nameEn: "Package",
        price: "100",
        details: [],
      },
      expected: "details",
    },
    {
      draft: {
        planId: "plan-1",
        nameLa: "ແພັກເກດ",
        nameEn: "Package",
        price: "100",
        details: [{ nameLa: "   ", nameEn: "Detail" }],
      },
      expected: "detailNameLa",
    },
    {
      draft: {
        planId: "plan-1",
        nameLa: "ແພັກເກດ",
        nameEn: "Package",
        price: "100",
        details: [{ nameLa: "ລາຍລະອຽດ", nameEn: "   " }],
      },
      expected: "detailNameEn",
    },
  ])(
    "returns $expected for the first invalid package field",
    ({ draft, expected }) => {
      expect(validatePackageDraft(draft)).toBe(expected);
    },
  );

  it("accepts a complete package draft with a zero price", () => {
    expect(
      validatePackageDraft({
        planId: "plan-1",
        nameLa: " ແພັກເກດ ",
        nameEn: " Package ",
        price: "0",
        details: [
          {
            nameLa: " ລາຍລະອຽດ ",
            nameEn: " Detail ",
          },
        ],
      }),
    ).toBeNull();
  });
});

describe("monthlyEquivalentPrice", () => {
  it("divides a cycle price across its months", () => {
    expect(monthlyEquivalentPrice(1_200_000, 12)).toBe(100_000);
  });

  it("returns the price unchanged for a one-month cycle", () => {
    expect(monthlyEquivalentPrice(400_000, 1)).toBe(400_000);
  });

  it("falls back to the price when months is zero or negative", () => {
    expect(monthlyEquivalentPrice(400_000, 0)).toBe(400_000);
    expect(monthlyEquivalentPrice(400_000, -3)).toBe(400_000);
  });

  it("rounds to a whole kip", () => {
    expect(monthlyEquivalentPrice(1_000_000, 3)).toBe(333_333);
  });
});

describe("cycleSavingsPercent", () => {
  it("returns the discount against paying monthly for the same span", () => {
    expect(cycleSavingsPercent(100_000, 1_020_000, 12)).toBe(15);
  });

  it("returns null when the cycle price matches the monthly total", () => {
    expect(cycleSavingsPercent(400_000, 400_000, 1)).toBeNull();
  });

  it("returns null when the cycle costs more than paying monthly", () => {
    expect(cycleSavingsPercent(100_000, 1_400_000, 12)).toBeNull();
  });

  it("returns null when either price is missing or months is invalid", () => {
    expect(cycleSavingsPercent(0, 1_020_000, 12)).toBeNull();
    expect(cycleSavingsPercent(100_000, 0, 12)).toBeNull();
    expect(cycleSavingsPercent(100_000, 1_020_000, 0)).toBeNull();
  });
});

describe("orderedPlanColumns", () => {
  it("returns an empty list for a missing group", () => {
    expect(orderedPlanColumns(null)).toEqual([]);
  });

  it("orders plans by sort order", () => {
    const group = {
      billingCycleId: "cycle-1",
      billingCycleName: "Monthly",
      months: 1,
      status: 1,
      sortOrder: 1,
      plans: [
        { id: "plan-b", billingCycleId: "cycle-1", methodId: "m-b", methodName: "B", methodStatus: 1, status: 1, sortOrder: 2 },
        { id: "plan-a", billingCycleId: "cycle-1", methodId: "m-a", methodName: "A", methodStatus: 1, status: 1, sortOrder: 1 }
      ]
    };

    expect(orderedPlanColumns(group).map((plan) => plan.id)).toEqual([
      "plan-a",
      "plan-b"
    ]);
  });

  it("breaks sort-order ties by id so equal values never reshuffle", () => {
    const group = {
      billingCycleId: "cycle-1",
      billingCycleName: "Monthly",
      months: 1,
      status: 1,
      sortOrder: 1,
      plans: [
        { id: "plan-z", billingCycleId: "cycle-1", methodId: "m-z", methodName: "Z", methodStatus: 1, status: 1, sortOrder: 1 },
        { id: "plan-a", billingCycleId: "cycle-1", methodId: "m-a", methodName: "A", methodStatus: 1, status: 1, sortOrder: 1 }
      ]
    };

    expect(orderedPlanColumns(group).map((plan) => plan.id)).toEqual([
      "plan-a",
      "plan-z"
    ]);
  });
});
