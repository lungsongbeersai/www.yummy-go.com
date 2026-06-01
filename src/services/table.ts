import { createCrud } from "@/services/shared/crud";
import type { ApiEntity, ApiListResponse, FetchParams } from "@/services/shared/types";

export interface Table extends ApiEntity {
  table_uuid: string;
  table_name?: string;
  table_name_la?: string;
  table_name_eng?: string;
  zone_uuid_fk?: string;
  zone_name?: string;
  zone_name_la?: string;
  zone_name_eng?: string;
  branch_uuid_fk?: string;
  table_qty?: number | string;
  number_of_seats?: number | string;
  table_status?: number;
  table_date_in?: string;
  table_time_in?: string;
  charge_status?: number;
}
export interface ZoneGroup extends ApiEntity {
  zone_uuid: string;
  zone_name?: string;
  zone_name_la?: string;
  zone_name_eng?: string;
  total_tables?: number;
  tables: Table[];
}
export type TableListRow = Table | ZoneGroup;
export type TableResponse = ApiListResponse<TableListRow>;
export interface SaveTableInput extends ApiEntity {
  table_uuid?: string;
  branch_uuid_fk?: string;
  zone_uuid_fk?: string | FormDataEntryValue;
  table_name?: string | FormDataEntryValue;
  table_name_la?: string | FormDataEntryValue;
  table_name_eng?: string | FormDataEntryValue;
  table_qty?: number | string;
  number_of_seats?: number | string;
  charge_status?: number | string;
}
export interface FetchTablesParams extends FetchParams {}

const crud = createCrud<Table>(
  {
    fetch: "/api/v1/table/fetch_limit",
    fetchAll: "/api/v1/table/fetch_all",
    create: "/api/v1/table/create",
    delete: "/api/v1/table/delete"
  },
  "table_uuid"
);

export const getTables = (params: FetchTablesParams = {}) => crud.list(params) as unknown as Promise<TableResponse>;
export const getTableOptions = (lang = "la") => crud.options({ lang }) as unknown as Promise<ZoneGroup[]>;
export const saveTable = (input: SaveTableInput) => {
  const qty = input.table_qty ?? input.number_of_seats;
  const chargeStatus = input.charge_status === "" || input.charge_status === undefined || input.charge_status === null ? 2 : input.charge_status;
  const payload: SaveTableInput = {
    branch_uuid_fk: input.branch_uuid_fk,
    zone_uuid_fk: input.zone_uuid_fk,
    table_uuid: input.table_uuid ?? "",
    table_name_la: input.table_name_la,
    table_name_eng: input.table_name_eng,
    charge_status: Number(chargeStatus)
  };

  if (qty !== undefined && qty !== null && qty !== "") payload.table_qty = Number(qty);

  return crud.save(payload);
};
export const deleteTable = (table_uuid: string) => crud.delete(table_uuid);
