import * as branch from "@/services/branch";
import * as category from "@/services/category";
import * as color from "@/services/color";
import * as currency from "@/services/currency";
import * as customer from "@/services/customer";
import * as district from "@/services/district";
import * as exchange from "@/services/exchange";
import * as group from "@/services/group";
import * as province from "@/services/province";
import type { ApiListResponse, FetchParams } from "@/services/shared/types";
import * as size from "@/services/size";
import * as store from "@/services/store";
import * as table from "@/services/table";
import * as topping from "@/services/topping";
import * as unite from "@/services/unit";
import * as user from "@/services/user";
import * as zone from "@/services/zone";

type SettingsRowsResponse = ApiListResponse<Record<string, unknown>>;

export interface SettingsStoreAdapter {
  list: (params?: FetchParams) => Promise<SettingsRowsResponse>;
  save: (input: Record<string, unknown>) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}

function adapter({
  list,
  remove,
  save
}: {
  list: (params?: FetchParams) => Promise<unknown>;
  save: (input: Record<string, unknown>) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
}): SettingsStoreAdapter {
  return {
    list: list as SettingsStoreAdapter["list"],
    save,
    remove
  };
}

const SETTINGS_STORE_ADAPTERS = {
  store: adapter({ list: store.getStores, save: store.saveStore, remove: store.deleteStore }),
  branch: adapter({ list: branch.getBranches, save: branch.saveBranch, remove: branch.deleteBranch }),
  province: adapter({ list: province.getProvinces, save: province.saveProvince, remove: province.deleteProvince }),
  district: adapter({ list: district.getDistricts, save: district.saveDistrict, remove: district.deleteDistrict }),
  topping: adapter({ list: topping.getToppings, save: topping.saveTopping, remove: topping.deleteTopping }),
  group: adapter({ list: group.getGroups, save: group.saveGroup, remove: group.deleteGroup }),
  category: adapter({ list: category.getCategories, save: category.saveCategory, remove: category.deleteCategory }),
  unit: adapter({ list: unite.getUnits, save: unite.saveUnit, remove: unite.deleteUnit }),
  size: adapter({ list: size.getSizes, save: size.saveSize, remove: size.deleteSize }),
  color: adapter({ list: color.getColors, save: color.saveColor, remove: color.deleteColor }),
  zone: adapter({ list: zone.getZones, save: zone.saveZone, remove: zone.deleteZone }),
  table: adapter({ list: table.getTables, save: table.saveTable, remove: table.deleteTable }),
  currency: adapter({ list: currency.getCurrencies, save: currency.saveCurrency, remove: currency.deleteCurrency }),
  exchange: adapter({ list: exchange.getExchanges, save: exchange.saveExchange, remove: exchange.deleteExchange }),
  customer: adapter({ list: customer.getCustomers, save: customer.saveCustomer, remove: customer.deleteCustomer }),
  user: adapter({ list: user.getUsers, save: user.saveUser, remove: user.deleteUser })
} satisfies Record<string, SettingsStoreAdapter>;

export function settingsStoreAdapterKey(slug: string) {
  return slug === "unite" ? "unit" : slug;
}

export function hasSettingsStoreAdapter(slug: string) {
  return settingsStoreAdapterKey(slug) in SETTINGS_STORE_ADAPTERS;
}

export function getSettingsStoreAdapter(slug: string): SettingsStoreAdapter {
  const key = settingsStoreAdapterKey(slug);
  const adapter = SETTINGS_STORE_ADAPTERS[key as keyof typeof SETTINGS_STORE_ADAPTERS];
  if (!adapter) throw new Error(`Missing settings store adapter for "${slug}"`);
  return adapter;
}
