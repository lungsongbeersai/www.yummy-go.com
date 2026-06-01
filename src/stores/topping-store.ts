"use client";

import {
  deleteTopping,
  getToppings,
  saveTopping,
  type FetchToppingsParams,
  type SaveToppingInput,
  type Topping
} from "@/services/topping";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useToppingStore = createCrudListStore<
  Topping,
  SaveToppingInput,
  FetchToppingsParams
>({
  idKey: "topping_uuid",
  list: getToppings,
  save: saveTopping,
  remove: deleteTopping
});
