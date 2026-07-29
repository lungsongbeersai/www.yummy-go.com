import type {
  BillingCycle,
  PackageBillingGroup,
  PackageItem,
  PackageMethod,
  PackagePlan,
  PackagePlanGroup,
} from "@/services/package";

export interface ActivePackageNavigation {
  billingCycles: BillingCycle[];
  planGroups: PackagePlanGroup[];
  cycleId: string;
  planId: string;
}

export function activePackageNavigation(
  cycles: BillingCycle[],
  groups: PackagePlanGroup[],
  selectedCycleId: string,
  selectedPlanId: string,
): ActivePackageNavigation {
  const billingCycles = cycles.filter((cycle) => cycle.status === 1);
  if (!billingCycles.length) {
    return { billingCycles: [], planGroups: [], cycleId: "", planId: "" };
  }

  const activeCycleIds = new Set(billingCycles.map((cycle) => cycle.id));
  const planGroups = groups.flatMap((group) => {
    if (group.status !== 1 || !activeCycleIds.has(group.billingCycleId)) {
      return [];
    }

    return [
      {
        ...group,
        plans: group.plans.filter(
          (plan) =>
            plan.billingCycleId === group.billingCycleId &&
            plan.status === 1 &&
            plan.methodStatus === 1,
        ),
      },
    ];
  });
  const cycleId = activeCycleIds.has(selectedCycleId)
    ? selectedCycleId
    : billingCycles[0].id;
  const group =
    planGroups.find((item) => item.billingCycleId === cycleId) ?? null;
  const selectedPlanIsValid = Boolean(
    group?.plans.some((plan) => plan.id === selectedPlanId),
  );
  const planId = selectedPlanIsValid
    ? selectedPlanId
    : (group?.plans[0]?.id ?? "");

  return { billingCycles, planGroups, cycleId, planId };
}

export function planById(
  groups: PackagePlanGroup[],
  planId: string,
): PackagePlan | null {
  if (!planId) return null;
  return (
    groups
      .flatMap((group) => group.plans)
      .find((plan) => plan.id === planId) ?? null
  );
}

export function packagesForPlan(
  groups: PackageBillingGroup[],
  planId: string,
): PackageItem[] {
  if (!planId) return [];
  return groups
    .flatMap((group) => group.methods)
    .flatMap((method) => method.packages)
    .filter((item) => item.planId === planId);
}

export function availableMethods(
  methods: PackageMethod[],
  group: PackagePlanGroup | null,
): PackageMethod[] {
  if (!group) return methods;
  const connectedMethodIds = new Set(
    group.plans.flatMap((plan) => (plan.methodId ? [plan.methodId] : [])),
  );
  return methods.filter((method) => !connectedMethodIds.has(method.id));
}

export function validatePlanDraft(draft: {
  billingCycleId: string;
  methodId: string;
}): "billingCycle" | "method" | null {
  if (!draft.billingCycleId.trim()) return "billingCycle";
  if (!draft.methodId.trim()) return "method";
  return null;
}

export function validatePackageDraft(draft: {
  planId: string;
  nameLa: string;
  nameEn: string;
  price: string;
  details: Array<{ nameLa: string; nameEn: string }>;
}):
  | "plan"
  | "nameLa"
  | "nameEn"
  | "price"
  | "details"
  | "detailNameLa"
  | "detailNameEn"
  | null {
  if (!draft.planId.trim()) return "plan";
  if (!draft.nameLa.trim()) return "nameLa";
  if (!draft.nameEn.trim()) return "nameEn";

  const price = draft.price.trim();
  if (!price || !Number.isFinite(Number(price)) || Number(price) < 0) {
    return "price";
  }
  if (!draft.details.length) return "details";

  for (const detail of draft.details) {
    if (!detail.nameLa.trim()) return "detailNameLa";
    if (!detail.nameEn.trim()) return "detailNameEn";
  }

  return null;
}

export function monthlyEquivalentPrice(price: number, months: number): number {
  if (months <= 1) return price;
  return Math.round(price / months);
}

// เทียบราคาต่อรอบกับการจ่ายรายเดือนตลอดช่วงเดียวกัน คืน null เมื่อเทียบไม่ได้
// หรือไม่ได้ประหยัด เพื่อให้ฝั่ง UI ซ่อน badge ไปเลยแทนที่จะโชว์ 0%
export function cycleSavingsPercent(
  monthlyPrice: number,
  cyclePrice: number,
  months: number,
): number | null {
  if (monthlyPrice <= 0 || cyclePrice <= 0 || months <= 1) return null;

  const monthlyTotal = monthlyPrice * months;
  const savings = Math.round(((monthlyTotal - cyclePrice) / monthlyTotal) * 100);
  return savings > 0 ? savings : null;
}

export function orderedPlanColumns(
  group: PackagePlanGroup | null,
): PackagePlan[] {
  if (!group) return [];
  return [...group.plans].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.id.localeCompare(right.id),
  );
}
