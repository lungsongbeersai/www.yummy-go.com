import { asRecords } from "@/services/shared/validators";
import { numberValue, text } from "@/services/shared/normalizers";
import type {
  BillingCycle,
  PackageBillingGroup,
  PackageDetail,
  PackageItem,
  PackageMethod,
  PackageMethodGroup,
  PackagePageResult,
  PackagePlan,
  PackagePlanGroup,
  RawBillingCycleDto,
  RawPackageDetailDto,
  RawPackageDto,
  RawPackageGroupDto,
  RawPackageMethodDto,
  RawPackagePlanDto
} from "@/services/package/types";

type RawRecord = Record<string, unknown>;

function recordsFrom(raw: unknown): RawRecord[] {
  if (Array.isArray(raw)) return asRecords<RawRecord>(raw);
  if (!raw || typeof raw !== "object") return [];
  return asRecords<RawRecord>((raw as RawRecord).data);
}

function nestedRecords(raw: RawRecord, ...keys: string[]): RawRecord[] {
  for (const key of keys) {
    const values = asRecords<RawRecord>(raw[key]);
    if (values.length || Array.isArray(raw[key])) return values;
  }
  return [];
}

function statusValue(value: unknown): number {
  const status = Number(value);
  return status === 1 || status === 2 ? status : 1;
}

function nonNegativeNumber(value: unknown, fallback = 0): number {
  const next = numberValue(value, fallback);
  return next >= 0 ? next : fallback;
}

function sortByOrder<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder);
}

function normalizePlan(raw: RawPackagePlanDto, billingCycleId: string): PackagePlan {
  return {
    id: text(raw.package_plan_uuid),
    billingCycleId: text(raw.billing_cycle_uuid_fk, billingCycleId),
    methodId: text(raw.package_method_uuid_fk ?? raw.package_method_uuid),
    methodName: text(raw.package_method_name),
    methodStatus: statusValue(raw.package_method_status),
    status: statusValue(raw.package_plan_status),
    sortOrder: nonNegativeNumber(raw.package_plan_sort_order ?? raw.sort_order)
  };
}

function normalizeDetail(raw: RawPackageDetailDto, packageId: string): PackageDetail {
  const nameLa = text(raw.detail_name_la);
  const nameEn = text(raw.detail_name_eng);

  return {
    id: text(raw.package_price_detail_uuid),
    packageId: text(raw.package_uuid_fk, packageId),
    name: text(raw.package_detail_name ?? raw.detail_name, nameLa || nameEn),
    nameLa,
    nameEn,
    status: statusValue(raw.detail_status ?? raw.status),
    sortOrder: nonNegativeNumber(raw.sort_order)
  };
}

function normalizePackage(raw: RawPackageDto, planId: string): PackageItem {
  const id = text(raw.package_uuid);
  const nameLa = text(raw.package_name_la);
  const nameEn = text(raw.package_name_eng);
  const details = nestedRecords(raw as RawRecord, "details").map((detail) =>
    normalizeDetail(detail as RawPackageDetailDto, id)
  );

  return {
    id,
    planId: text(raw.package_plan_uuid_fk, planId),
    name: text(raw.package_name, nameLa || nameEn),
    nameLa,
    nameEn,
    price: nonNegativeNumber(raw.package_price),
    status: statusValue(raw.package_status ?? raw.status),
    sortOrder: nonNegativeNumber(raw.sort_order),
    details: sortByOrder(details)
  };
}

function normalizeMethodGroup(raw: RawPackageGroupDto): PackageMethodGroup {
  const planId = text(raw.package_plan_uuid);
  const methodName = text(raw.package_method_name);
  const packages = nestedRecords(raw as RawRecord, "packages").map((item) =>
    normalizePackage(item as RawPackageDto, planId)
  );

  return {
    id: planId,
    title: methodName,
    methodId: text(raw.package_method_uuid_fk ?? raw.package_method_uuid),
    methodName,
    methodNameLa: text(raw.package_method_name_la),
    methodNameEn: text(raw.package_method_name_eng),
    methodStatus: statusValue(raw.package_method_status),
    methodMasterSortOrder: nonNegativeNumber(raw.package_method_master_sort_order),
    planId,
    planStatus: statusValue(raw.package_plan_status),
    sortOrder: nonNegativeNumber(raw.package_plan_sort_order ?? raw.sort_order),
    packages: sortByOrder(packages)
  };
}

function normalizeBillingGroup(raw: RawBillingCycleDto): PackageBillingGroup {
  const billingCycleId = text(raw.billing_cycle_uuid);
  const billingCycleName = text(raw.billing_cycle_name);
  const methods = nestedRecords(raw as RawRecord, "package_methods").map((method) =>
    normalizeMethodGroup(method as RawPackageGroupDto)
  );

  return {
    id: billingCycleId,
    title: billingCycleName,
    billingCycleId,
    billingCycleName,
    billingCycleNameLa: text(raw.billing_cycle_name_la),
    billingCycleNameEn: text(raw.billing_cycle_name_eng),
    months: nonNegativeNumber(raw.billing_cycle_months),
    status: statusValue(raw.billing_cycle_status ?? raw.status),
    sortOrder: nonNegativeNumber(raw.sort_order),
    methods: sortByOrder(methods)
  };
}

function positiveInteger(value: unknown, fallback: number): number {
  const next = numberValue(value, fallback);
  return Number.isInteger(next) && next > 0 ? next : fallback;
}

export function normalizeBillingCycles(raw: unknown): BillingCycle[] {
  const cycles = recordsFrom(raw).map((item) => {
    const cycle = item as RawBillingCycleDto;
    return {
      id: text(cycle.billing_cycle_uuid),
      name: text(cycle.billing_cycle_name),
      months: nonNegativeNumber(cycle.billing_cycle_months),
      status: statusValue(cycle.billing_cycle_status ?? cycle.status),
      sortOrder: nonNegativeNumber(cycle.sort_order)
    };
  });

  return sortByOrder(cycles);
}

export function normalizePackageMethods(raw: unknown): PackageMethod[] {
  const methods = recordsFrom(raw).map((item) => {
    const method = item as RawPackageMethodDto;
    return {
      id: text(method.package_method_uuid),
      name: text(method.package_method_name),
      status: statusValue(method.package_method_status ?? method.status),
      sortOrder: nonNegativeNumber(method.sort_order)
    };
  });

  return sortByOrder(methods);
}

export function normalizePackagePlanGroups(raw: unknown): PackagePlanGroup[] {
  const groups = recordsFrom(raw).map((item) => {
    const cycle = item as RawBillingCycleDto;
    // /packages/plans/fetch ห่อ plan ไว้ใน package_methods และเรียก id ของรอบบิลว่า *_fk
    // (ต่างจาก /packages/fetch_limit ที่ใช้ billing_cycle_uuid) — อ่านผิดคีย์แล้วกลุ่มจะว่างทั้งหมด
    const billingCycleId = text(cycle.billing_cycle_uuid_fk ?? cycle.billing_cycle_uuid);
    const plans = nestedRecords(item, "package_methods", "package_plans", "plans").map((plan) =>
      normalizePlan(plan as RawPackagePlanDto, billingCycleId)
    );

    return {
      billingCycleId,
      billingCycleName: text(cycle.billing_cycle_name),
      months: nonNegativeNumber(cycle.billing_cycle_months),
      status: statusValue(cycle.billing_cycle_status ?? cycle.status),
      sortOrder: nonNegativeNumber(cycle.sort_order),
      plans: sortByOrder(plans)
    };
  });

  return sortByOrder(groups);
}

export function normalizePackagePage(raw: unknown): PackagePageResult {
  const record = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as RawRecord) : {};
  const groups = recordsFrom(raw).map((item) => normalizeBillingGroup(item as RawBillingCycleDto));

  return {
    page: positiveInteger(record.page, 1),
    limit: positiveInteger(record.limit, 10),
    total: nonNegativeNumber(record.total),
    totalPages: positiveInteger(record.total_pages, 1),
    totalBillingCycles: nonNegativeNumber(record.total_billing_cycles),
    totalPackageMethods: nonNegativeNumber(record.total_package_methods),
    groups: sortByOrder(groups)
  };
}
