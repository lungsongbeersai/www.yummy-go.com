"use client";

import {
  deleteCurrency,
  getCurrencies,
  saveCurrency,
  type Currency,
  type FetchCurrenciesParams,
  type SaveCurrencyInput
} from "@/services/currency";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useCurrencyStore = createCrudListStore<
  Currency,
  SaveCurrencyInput,
  FetchCurrenciesParams
>({
  idKey: "currency_uuid",
  list: getCurrencies,
  save: saveCurrency,
  remove: deleteCurrency
});
