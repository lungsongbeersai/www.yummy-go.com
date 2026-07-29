import { apiRequest } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import {
  normalizeBillingCycles,
  normalizePackageMethods,
  normalizePackagePage,
  normalizePackagePlanGroups
} from "@/services/package/normalizers";
import {
  buildBillingCycleReorderPayload,
  buildCreatePackagePlanPayload,
  buildDetailReorderPayload,
  buildPlanReorderPayload,
  buildSavePackagePayload
} from "@/services/package/payloads";
import type { ApiListResponse, ApiMessageResponse } from "@/services/shared/types";
import type {
  BillingCycle,
  CreatePackagePlanInput,
  PackageDetail,
  PackageMethod,
  PackagePageResult,
  PackagePlan,
  PackagePlanGroup,
  RawBillingCycleDto,
  RawPackageMethodDto,
  SavePackageInput
} from "@/services/package/types";

interface FetchPackagePageParams {
  language?: string;
  status?: "all" | 1 | 2;
  search?: string;
  page?: number;
  limit?: number;
  orderBy?: "asc" | "desc";
}

interface PackagePageResponse extends ApiListResponse<RawBillingCycleDto> {
  total_pages?: number;
  total_billing_cycles?: number;
  total_package_methods?: number;
}

export async function fetchBillingCycles(language?: string): Promise<BillingCycle[]> {
  const result = await apiRequest<ApiListResponse<RawBillingCycleDto>>(
    "get",
    "/api/v1/packages/billing_cycles",
    { params: { lang: toApiLanguage(language), billing_cycle_status: 1 } }
  );

  return normalizeBillingCycles(result.data);
}

export async function fetchPackageMethods(language?: string): Promise<PackageMethod[]> {
  const result = await apiRequest<ApiListResponse<RawPackageMethodDto>>(
    "get",
    "/api/v1/packages/methods",
    { params: { lang: toApiLanguage(language), pk_method_status: 1 } }
  );

  return normalizePackageMethods(result.data);
}

export async function fetchPackagePlanGroups(language?: string): Promise<PackagePlanGroup[]> {
  const result = await apiRequest<ApiListResponse<RawBillingCycleDto>>(
    "get",
    "/api/v1/packages/plans/fetch",
    { params: { lang: toApiLanguage(language), package_plan_status: "all" } }
  );

  return normalizePackagePlanGroups(result.data);
}

export async function fetchPackagePage(params: FetchPackagePageParams): Promise<PackagePageResult> {
  const result = await apiRequest<PackagePageResponse>("get", "/api/v1/packages/fetch_limit", {
    params: {
      lang: toApiLanguage(params.language),
      package_status: params.status ?? "all",
      search: params.search ?? "",
      page: params.page ?? 1,
      limit: params.limit ?? 10,
      orderBy: params.orderBy ?? "asc"
    }
  });

  return normalizePackagePage(result);
}

export async function createPackagePlan(input: CreatePackagePlanInput): Promise<void> {
  await apiRequest<ApiMessageResponse>("post", "/api/v1/packages/plans/create", {
    data: buildCreatePackagePlanPayload(input)
  });
}

export async function savePackage(input: SavePackageInput): Promise<void> {
  await apiRequest<ApiMessageResponse>("post", "/api/v1/packages/create", {
    data: buildSavePackagePayload(input)
  });
}

export async function reorderBillingCycles(cycles: Pick<BillingCycle, "id">[]): Promise<void> {
  await apiRequest<ApiMessageResponse>("patch", "/api/v1/packages/billing_cycles/reorder", {
    data: buildBillingCycleReorderPayload(cycles)
  });
}

export async function reorderPackagePlans(
  cycleId: string,
  plans: Pick<PackagePlan, "id">[]
): Promise<void> {
  await apiRequest<ApiMessageResponse>("patch", "/api/v1/packages/plans/reorder", {
    data: buildPlanReorderPayload(cycleId, plans)
  });
}

export async function reorderPackageDetails(
  packageId: string,
  details: Pick<PackageDetail, "id">[]
): Promise<void> {
  await apiRequest<ApiMessageResponse>("patch", "/api/v1/packages/price-details/reorder", {
    data: buildDetailReorderPayload(packageId, details)
  });
}
