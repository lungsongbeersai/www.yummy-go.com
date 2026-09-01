"use client";

import {
  deleteTable,
  deleteTables,
  getTables,
  saveTable,
  type FetchTablesParams,
  type SaveTableInput,
  type TableListRow
} from "@/services/table";
import { createCrudListStore } from "@/stores/crud-list-store";
import { errorMessage } from "@/stores/store-utils";

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

export async function removeTables(table_uuids: string[]) {
  useTableStore.setState({ saving: true, error: null });
  try {
    await deleteTables(table_uuids);
    useTableStore.setState({ saving: false });
  } catch (error) {
    useTableStore.setState({ error: errorMessage(error), saving: false });
    throw error;
  }
}
