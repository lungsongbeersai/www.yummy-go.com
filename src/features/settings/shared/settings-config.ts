import type { AuthUser } from "@/stores/auth-store";

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
  scope?: (user: AuthUser | null) => Record<string, unknown>;
}

const storeScope = (u: AuthUser | null) => ({ store_uuid_fk: u?.store_uuid || u?.store_uuid_fk || "" });

// Modules shown as cards on the settings index; each slug also carries the
// i18n keys settings.modules.<slug>.{title,description} and its own route
// (static folder for most, /setting/[entity] for the SETTINGS entries below).
export const SETTINGS_MODULE_SLUGS = [
  "store",
  "branch",
  "province",
  "district",
  "topping",
  "group",
  "category",
  "unit",
  "size",
  "color",
  "zone",
  "table",
  "currency",
  "exchange",
  "customer",
  "user"
] as const;

export type SettingsModuleSlug = (typeof SETTINGS_MODULE_SLUGS)[number];

// Only the entities still served by the /setting/[entity] dynamic route.
// Every other module has a dedicated static route + per-domain store.
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
    ]
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
    scope: storeScope
  },
  province: {
    slug: "province",
    title: "Provinces",
    description: "Province master data.",
    idKey: "province_uuid",
    columns: [{ key: "province_name", label: "Name" }, { key: "province_name_la", label: "LA" }, { key: "province_name_eng", label: "EN" }],
    fields: [{ name: "province_name_la", label: "Name LA", required: true }, { name: "province_name_eng", label: "Name EN" }]
  },
  district: {
    slug: "district",
    title: "Districts",
    description: "District master data.",
    idKey: "district_uuid",
    columns: [{ key: "district_name", label: "Name" }, { key: "province_uuid_fk", label: "Province" }],
    fields: [{ name: "province_uuid_fk", label: "Province", required: true }, { name: "district_name_la", label: "Name LA", required: true }, { name: "district_name_eng", label: "Name EN" }]
  }
};
