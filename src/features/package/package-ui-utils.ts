import type {
  PackageBillingGroup,
  PackageItem,
  PackageMethod,
  PackagePlan,
  PackagePlanGroup,
} from "@/services/package";

export function firstPlanId(groups: PackagePlanGroup[]): string {
  if (!groups.length) return "";
  return groups.flatMap((group) => group.plans)[0]?.id ?? "";
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

export function packageRange(
  page: number,
  limit: number,
  total: number,
  rowCount: number,
): { start: number; end: number } {
  if (total <= 0 || rowCount <= 0) return { start: 0, end: 0 };
  const start = (Math.max(1, page) - 1) * Math.max(1, limit) + 1;
  return {
    start,
    end: Math.min(total, start + rowCount - 1),
  };
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
