import type { AuthUser } from "@/stores/auth-store";
import type { FetchParams } from "@/services/shared/types";
import * as branch from "@/services/branch";
import * as category from "@/services/category";
import * as color from "@/services/color";
import * as currency from "@/services/currency";
import * as customer from "@/services/customer";
import * as district from "@/services/district";
import * as exchange from "@/services/exchange";
import * as group from "@/services/group";
import * as province from "@/services/province";
import * as size from "@/services/size";
import * as store from "@/services/store";
import * as table from "@/services/table";
import * as topping from "@/services/topping";
import * as unite from "@/services/unit";
import * as user from "@/services/user";
import * as zone from "@/services/zone";

export type FieldType = "text" | "number" | "email" | "password" | "textarea";

export interface SettingField {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
}

export interface SettingConfig {
  slug: string;
  title: string;
  description: string;
  idKey: string;
  columns: Array<{ key: string; label: string }>;
  fields: SettingField[];
  list: (params: FetchParams) => Promise<{ data: Record<string, unknown>[]; total?: number; totalPages?: number; total_page?: number }>;
  save: (input: Record<string, unknown>) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  scope?: (user: AuthUser | null) => Record<string, unknown>;
}

const branchScope = (u: AuthUser | null) => ({ branch_uuid_fk: u?.branch_uuid ?? "" });
const storeScope = (u: AuthUser | null) => ({ store_uuid_fk: u?.store_uuid || u?.store_uuid_fk || "" });
const loginScope = (u: AuthUser | null) => ({ login_uuid_fk: u?.uuid ?? "" });

export const SETTINGS: Record<string, SettingConfig> = {
  store: {
    slug: "store",
    title: "Stores",
    description: "Store profiles and account status.",
    idKey: "store_uuid",
    columns: [{ key: "store_name", label: "Name" }, { key: "store_email", label: "Email" }, { key: "store_status", label: "Status" }],
    fields: [
      { name: "store_name_la", label: "Name LA", required: true },
      { name: "store_name_eng", label: "Name EN" },
      { name: "store_email", label: "Email", type: "email", required: true },
      { name: "store_status", label: "Status", type: "number" },
      { name: "store_active", label: "Active", type: "number" }
    ],
    list: store.getStores,
    save: store.saveStore,
    remove: store.deleteStore
  },
  branch: {
    slug: "branch",
    title: "Branches",
    description: "Restaurant branch details.",
    idKey: "branch_uuid",
    columns: [{ key: "branch_name", label: "Name" }, { key: "branch_tel", label: "Phone" }, { key: "branch_address", label: "Address" }],
    fields: [
      { name: "branch_name", label: "Name", required: true },
      { name: "branch_tel", label: "Phone" },
      { name: "branch_address", label: "Address", type: "textarea" }
    ],
    list: branch.getBranches,
    save: branch.saveBranch,
    remove: branch.deleteBranch,
    scope: storeScope
  },
  province: {
    slug: "province",
    title: "Provinces",
    description: "Province master data.",
    idKey: "province_uuid",
    columns: [{ key: "province_name", label: "Name" }, { key: "province_name_la", label: "LA" }, { key: "province_name_eng", label: "EN" }],
    fields: [{ name: "province_name_la", label: "Name LA", required: true }, { name: "province_name_eng", label: "Name EN" }],
    list: province.getProvinces,
    save: province.saveProvince,
    remove: province.deleteProvince
  },
  district: {
    slug: "district",
    title: "Districts",
    description: "District master data.",
    idKey: "district_uuid",
    columns: [{ key: "district_name", label: "Name" }, { key: "province_uuid_fk", label: "Province" }],
    fields: [{ name: "province_uuid_fk", label: "Province", required: true }, { name: "district_name_la", label: "Name LA", required: true }, { name: "district_name_eng", label: "Name EN" }],
    list: district.getDistricts,
    save: district.saveDistrict,
    remove: district.deleteDistrict
  },
  topping: {
    slug: "topping",
    title: "Toppings",
    description: "Extra item options.",
    idKey: "topping_uuid",
    columns: [{ key: "topping_name", label: "Name" }],
    fields: [{ name: "topping_name_la", label: "Name LA", required: true }, { name: "topping_name_eng", label: "Name EN" }],
    list: topping.getToppings,
    save: topping.saveTopping,
    remove: topping.deleteTopping,
    scope: storeScope
  },
  group: {
    slug: "group",
    title: "Food groups",
    description: "Top-level food grouping.",
    idKey: "group_uuid",
    columns: [{ key: "group_name", label: "Name" }, { key: "group_name_la", label: "LA" }],
    fields: [{ name: "group_name_la", label: "Name LA", required: true }, { name: "group_name_eng", label: "Name EN" }],
    list: group.getGroups,
    save: group.saveGroup,
    remove: group.deleteGroup,
    scope: storeScope
  },
  category: {
    slug: "category",
    title: "Categories",
    description: "Menu categories.",
    idKey: "cate_uuid",
    columns: [{ key: "cate_name", label: "Name" }, { key: "group_uuid_fk", label: "Group" }],
    fields: [{ name: "group_uuid_fk", label: "Group" }, { name: "cate_name_la", label: "Name LA", required: true }, { name: "cate_name_eng", label: "Name EN" }, { name: "cate_icon", label: "Icon" }],
    list: category.getCategories,
    save: category.saveCategory,
    remove: category.deleteCategory,
    scope: storeScope
  },
  unit: {
    slug: "unit",
    title: "Units",
    description: "Product units.",
    idKey: "unite_uuid",
    columns: [{ key: "unite_name", label: "Name" }, { key: "unite_name_la", label: "LA" }],
    fields: [{ name: "unite_name_la", label: "Name LA", required: true }, { name: "unite_name_eng", label: "Name EN" }],
    list: unite.getUnits,
    save: unite.saveUnit,
    remove: unite.deleteUnit,
    scope: storeScope
  },
  unite: {
    slug: "unit",
    title: "Units",
    description: "Product units.",
    idKey: "unite_uuid",
    columns: [{ key: "unite_name", label: "Name" }],
    fields: [{ name: "unite_name_la", label: "Name LA", required: true }, { name: "unite_name_eng", label: "Name EN" }],
    list: unite.getUnits,
    save: unite.saveUnit,
    remove: unite.deleteUnit,
    scope: storeScope
  },
  size: {
    slug: "size",
    title: "Sizes",
    description: "Product size options.",
    idKey: "size_uuid",
    columns: [{ key: "size_name", label: "Name" }, { key: "size_name_la", label: "LA" }],
    fields: [{ name: "size_name_la", label: "Name LA", required: true }, { name: "size_name_eng", label: "Name EN" }],
    list: size.getSizes,
    save: size.saveSize,
    remove: size.deleteSize,
    scope: storeScope
  },
  color: {
    slug: "color",
    title: "Colors",
    description: "Product color swatches.",
    idKey: "color_uuid",
    columns: [{ key: "color_code", label: "Code" }],
    fields: [{ name: "color_code", label: "Color code", required: true }],
    list: color.getColors,
    save: color.saveColor,
    remove: color.deleteColor
  },
  zone: {
    slug: "zone",
    title: "Zones",
    description: "Dining zones and table areas.",
    idKey: "zone_uuid",
    columns: [{ key: "zone_name", label: "Name" }, { key: "zone_name_la", label: "LA" }],
    fields: [{ name: "zone_name_la", label: "Name LA", required: true }, { name: "zone_name_eng", label: "Name EN" }],
    list: zone.getZones,
    save: zone.saveZone,
    remove: zone.deleteZone,
    scope: branchScope
  },
  table: {
    slug: "table",
    title: "Tables",
    description: "Dining table setup.",
    idKey: "table_uuid",
    columns: [{ key: "table_name", label: "Name" }, { key: "zone_uuid_fk", label: "Zone" }, { key: "table_qty", label: "Seats" }, { key: "charge_status", label: "Service charge" }],
    fields: [
      { name: "zone_uuid_fk", label: "Zone", required: true },
      { name: "table_name_la", label: "Name LA", required: true },
      { name: "table_name_eng", label: "Name EN" },
      { name: "table_qty", label: "Seats", type: "number" },
      { name: "charge_status", label: "Service charge", type: "number" }
    ],
    list: table.getTables,
    save: table.saveTable,
    remove: table.deleteTable,
    scope: branchScope
  },
  currency: {
    slug: "currency",
    title: "Currencies",
    description: "Accepted currencies.",
    idKey: "currency_uuid",
    columns: [{ key: "currency_name", label: "Name" }, { key: "currency_icon", label: "Icon" }, { key: "currency_status", label: "Status" }],
    fields: [{ name: "currency_name", label: "Name", required: true }, { name: "currency_icon", label: "Icon" }, { name: "currency_status", label: "Status", type: "number" }],
    list: currency.getCurrencies,
    save: currency.saveCurrency,
    remove: currency.deleteCurrency
  },
  exchange: {
    slug: "exchange",
    title: "Exchange rates",
    description: "Currency exchange rates.",
    idKey: "ex_uuid",
    columns: [{ key: "currency_uuid_fk", label: "Currency" }, { key: "ex_price", label: "Rate" }, { key: "ex_status", label: "Status" }],
    fields: [{ name: "currency_uuid_fk", label: "Currency", required: true }, { name: "ex_price", label: "Rate", type: "number", required: true }, { name: "ex_status", label: "Status", type: "number" }],
    list: exchange.getExchanges,
    save: exchange.saveExchange,
    remove: exchange.deleteExchange,
    scope: storeScope
  },
  customer: {
    slug: "customer",
    title: "Customers",
    description: "Customer records.",
    idKey: "customer_uuid",
    columns: [
      { key: "member_code", label: "Member code" },
      { key: "customer_name", label: "Name" },
      { key: "customer_phone", label: "Phone" },
      { key: "customer_status", label: "Status" }
    ],
    fields: [
      { name: "member_code", label: "Member code" },
      { name: "customer_name", label: "Name", required: true },
      { name: "customer_phone", label: "Phone" },
      { name: "customer_status", label: "Status", type: "number" },
      { name: "customer_address", label: "Address", type: "textarea" }
    ],
    list: customer.getCustomers,
    save: customer.saveCustomer,
    remove: customer.deleteCustomer,
    scope: storeScope
  },
  user: {
    slug: "user",
    title: "Users",
    description: "Staff user accounts.",
    idKey: "login_uuid",
    columns: [
      { key: "login_email", label: "Email" },
      { key: "roles_name", label: "Role" },
      { key: "branch_name", label: "Branch" },
      { key: "login_active", label: "Active" }
    ],
    fields: [
      { name: "login_email", label: "Email", type: "email", required: true },
      { name: "login_password", label: "Password", type: "password" },
      { name: "roles_id_fk", label: "Role", type: "number" },
      { name: "login_active", label: "Active", type: "number" }
    ],
    list: user.getUsers,
    save: user.saveUser,
    remove: user.deleteUser,
    scope: (u) => ({ ...storeScope(u), ...branchScope(u), ...loginScope(u) })
  }
};
