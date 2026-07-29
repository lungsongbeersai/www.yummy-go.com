export interface BillingCycle {
  id: string;
  name: string;
  months: number;
  status: number;
  sortOrder: number;
}

export interface PackageMethod {
  id: string;
  name: string;
  status: number;
  sortOrder: number;
}

export interface PackagePlan {
  id: string;
  billingCycleId: string;
  methodId: string;
  methodName: string;
  methodStatus: number;
  status: number;
  sortOrder: number;
}

export interface PackagePlanGroup {
  billingCycleId: string;
  billingCycleName: string;
  months: number;
  status: number;
  sortOrder: number;
  plans: PackagePlan[];
}

export interface PackageDetail {
  id: string;
  packageId: string;
  name: string;
  nameLa: string;
  nameEn: string;
  status: number;
  sortOrder: number;
}

export interface PackageItem {
  id: string;
  planId: string;
  name: string;
  nameLa: string;
  nameEn: string;
  price: number;
  status: number;
  sortOrder: number;
  details: PackageDetail[];
}

export interface PackageMethodGroup {
  id: string;
  title: string;
  methodId: string;
  methodName: string;
  methodNameLa: string;
  methodNameEn: string;
  methodStatus: number;
  methodMasterSortOrder: number;
  planId: string;
  planStatus: number;
  sortOrder: number;
  packages: PackageItem[];
}

export interface PackageBillingGroup {
  id: string;
  title: string;
  billingCycleId: string;
  billingCycleName: string;
  billingCycleNameLa: string;
  billingCycleNameEn: string;
  months: number;
  status: number;
  sortOrder: number;
  methods: PackageMethodGroup[];
}

export interface PackagePageResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  totalBillingCycles: number;
  totalPackageMethods: number;
  groups: PackageBillingGroup[];
}

export interface CreatePackagePlanInput {
  billingCycleId: string;
  methodId: string;
  status: number;
  sortOrder: number;
}

export interface SavePackageDetailInput {
  id?: string;
  nameLa: string;
  nameEn: string;
  status: number;
}

export interface SavePackageInput {
  id?: string;
  planId: string;
  nameLa: string;
  nameEn: string;
  price: number;
  status: number;
  language?: string;
  details: SavePackageDetailInput[];
}

export interface RawBillingCycleDto {
  billing_cycle_uuid?: unknown;
  // /packages/plans/fetch คืน id ของรอบบิลเป็น *_fk ส่วน /packages/fetch_limit คืนเป็น *_uuid
  billing_cycle_uuid_fk?: unknown;
  billing_cycle_name?: unknown;
  billing_cycle_name_la?: unknown;
  billing_cycle_name_eng?: unknown;
  billing_cycle_months?: unknown;
  billing_cycle_status?: unknown;
  status?: unknown;
  sort_order?: unknown;
  package_plans?: unknown;
  plans?: unknown;
  package_methods?: unknown;
}

export interface RawPackageMethodDto {
  package_method_uuid?: unknown;
  package_method_name?: unknown;
  package_method_status?: unknown;
  status?: unknown;
  sort_order?: unknown;
}

export interface RawPackagePlanDto {
  package_plan_uuid?: unknown;
  billing_cycle_uuid_fk?: unknown;
  package_method_uuid_fk?: unknown;
  package_method_uuid?: unknown;
  package_method_name?: unknown;
  package_method_status?: unknown;
  package_plan_status?: unknown;
  package_plan_sort_order?: unknown;
  sort_order?: unknown;
}

export interface RawPackageGroupDto extends RawPackagePlanDto {
  package_method_name_la?: unknown;
  package_method_name_eng?: unknown;
  package_method_master_sort_order?: unknown;
  packages?: unknown;
}

export interface RawPackageDto {
  package_uuid?: unknown;
  package_plan_uuid_fk?: unknown;
  package_name?: unknown;
  package_name_la?: unknown;
  package_name_eng?: unknown;
  package_price?: unknown;
  package_status?: unknown;
  status?: unknown;
  sort_order?: unknown;
  details?: unknown;
}

export interface RawPackageDetailDto {
  package_price_detail_uuid?: unknown;
  package_uuid_fk?: unknown;
  package_detail_name?: unknown;
  detail_name?: unknown;
  detail_name_la?: unknown;
  detail_name_eng?: unknown;
  detail_status?: unknown;
  status?: unknown;
  sort_order?: unknown;
}
