import { ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { numberValue } from "@/services/shared/normalize";
import { requiredItems, requiredText, requiredUuid } from "@/services/shared/validators";
import type {
  BillingCycle,
  CreatePackagePlanInput,
  PackageDetail,
  PackagePlan,
  SavePackageDetailInput,
  SavePackageInput
} from "@/services/package/types";

interface CreatePackagePlanPayload {
  billing_cycle_uuid_fk: string;
  package_method_uuid_fk: string;
  package_plan_status: number;
  sort_order: number;
}

interface SavePackagePayload {
  package_uuid: string;
  package_plan_uuid_fk: string;
  package_name_la: string;
  package_name_eng: string;
  package_price: number;
  package_status: number;
  lang: "la" | "eng";
  details: Array<{
    package_price_detail_uuid: string;
    detail_name_la: string;
    detail_name_eng: string;
    detail_status: number;
  }>;
}

function normalizedStatus(value: unknown): number {
  return Number(value) === 1 ? 1 : 2;
}

function optionalUuid(value: unknown, field: string): string {
  if (value === undefined || value === null || String(value).trim() === "") return "";
  return requiredUuid(value, field);
}

function validPrice(value: unknown): number {
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) {
    throw new ServiceError("price must be a finite non-negative number", 400);
  }
  return price;
}

function buildDetailPayload(input: SavePackageDetailInput) {
  return {
    package_price_detail_uuid: optionalUuid(input.id, "detail id"),
    detail_name_la: requiredText(input.nameLa, "detail name la"),
    detail_name_eng: requiredText(input.nameEn, "detail name eng"),
    detail_status: normalizedStatus(input.status)
  };
}

export function buildCreatePackagePlanPayload(input: CreatePackagePlanInput): CreatePackagePlanPayload {
  return {
    billing_cycle_uuid_fk: requiredUuid(input.billingCycleId, "billing cycle id"),
    package_method_uuid_fk: requiredUuid(input.methodId, "package method id"),
    package_plan_status: normalizedStatus(input.status),
    sort_order: numberValue(input.sortOrder)
  };
}

export function buildSavePackagePayload(input: SavePackageInput): SavePackagePayload {
  return {
    package_uuid: optionalUuid(input.id, "package id"),
    package_plan_uuid_fk: requiredUuid(input.planId, "package plan id"),
    package_name_la: requiredText(input.nameLa, "package name la"),
    package_name_eng: requiredText(input.nameEn, "package name eng"),
    package_price: validPrice(input.price),
    package_status: normalizedStatus(input.status),
    lang: toApiLanguage(input.language),
    details: requiredItems(input.details, "details").map(buildDetailPayload)
  };
}

export function buildBillingCycleReorderPayload(cycles: Pick<BillingCycle, "id">[]): {
  items: Array<{ billing_cycle_uuid: string; sort_order: number }>;
} {
  return {
    items: requiredItems(cycles, "billing cycles").map((cycle, index) => ({
      billing_cycle_uuid: requiredUuid(cycle.id, "billing cycle id"),
      sort_order: index + 1
    }))
  };
}

export function buildPlanReorderPayload(cycleId: string, plans: Pick<PackagePlan, "id">[]): {
  billing_cycle_uuid_fk: string;
  items: Array<{ package_plan_uuid: string; sort_order: number }>;
} {
  return {
    billing_cycle_uuid_fk: requiredUuid(cycleId, "billing cycle id"),
    items: requiredItems(plans, "plans").map((plan, index) => ({
      package_plan_uuid: requiredUuid(plan.id, "package plan id"),
      sort_order: index + 1
    }))
  };
}

export function buildDetailReorderPayload(packageId: string, details: Pick<PackageDetail, "id">[]): {
  package_uuid_fk: string;
  items: Array<{ package_price_detail_uuid: string; sort_order: number }>;
} {
  return {
    package_uuid_fk: requiredUuid(packageId, "package id"),
    items: requiredItems(details, "details").map((detail, index) => ({
      package_price_detail_uuid: requiredUuid(detail.id, "detail id"),
      sort_order: index + 1
    }))
  };
}
