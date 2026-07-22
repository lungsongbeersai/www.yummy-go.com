"use client";

import {
  deleteExchange,
  getExchanges,
  saveExchange,
  type Exchange,
  type FetchExchangesParams,
  type SaveExchangeInput
} from "@/services/exchange";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useExchangeStore = createCrudListStore<
  Exchange,
  SaveExchangeInput,
  FetchExchangesParams
>({
  idKey: "ex_uuid",
  list: getExchanges,
  save: saveExchange,
  remove: deleteExchange
});
