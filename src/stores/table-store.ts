"use client";

import {
  deleteTable,
  getTables,
  saveTable,
  type FetchTablesParams,
  type SaveTableInput,
  type TableListRow
} from "@/services/table";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useTableStore = createCrudListStore<
  TableListRow,
  SaveTableInput,
  FetchTablesParams
>({
  idKey: "table_uuid",
  list: getTables,
  save: saveTable,
  remove: deleteTable
});
