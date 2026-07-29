import type {
  BillingCycle,
  PackageBillingGroup,
  PackageDetail,
  PackagePlan,
  PackagePlanGroup
} from "@/services/package";

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  ) {
    return items;
  }

  const reordered = [...items];
  const movedItems = reordered.splice(from, 1);
  reordered.splice(to, 0, ...movedItems);
  return reordered;
}

export function withCycleOrder(cycles: BillingCycle[]): BillingCycle[] {
  return cycles.map((cycle, index) => ({ ...cycle, sortOrder: index + 1 }));
}

export function replacePlanGroupOrder(
  groups: PackagePlanGroup[],
  cycleId: string,
  plans: PackagePlan[]
): PackagePlanGroup[] {
  const groupIndex = groups.findIndex((group) => group.billingCycleId === cycleId);
  if (groupIndex < 0) return groups;

  const orderedPlans = plans.map((plan, index) => ({
    ...plan,
    sortOrder: index + 1
  }));

  return groups.map((group, index) =>
    index === groupIndex ? { ...group, plans: orderedPlans } : group
  );
}

export function replacePackageDetailOrder(
  groups: PackageBillingGroup[],
  packageId: string,
  details: PackageDetail[]
): PackageBillingGroup[] {
  const groupIndex = groups.findIndex((group) =>
    group.methods.some((method) => method.packages.some((item) => item.id === packageId))
  );
  if (groupIndex < 0) return groups;

  const methodIndex = groups[groupIndex]?.methods.findIndex((method) =>
    method.packages.some((item) => item.id === packageId)
  );
  if (methodIndex === undefined || methodIndex < 0) return groups;

  const orderedDetails = details.map((detail, index) => ({
    ...detail,
    sortOrder: index + 1
  }));

  return groups.map((group, currentGroupIndex) => {
    if (currentGroupIndex !== groupIndex) return group;

    return {
      ...group,
      methods: group.methods.map((method, currentMethodIndex) => {
        if (currentMethodIndex !== methodIndex) return method;

        return {
          ...method,
          packages: method.packages.map((item) =>
            item.id === packageId ? { ...item, details: orderedDetails } : item
          )
        };
      })
    };
  });
}
