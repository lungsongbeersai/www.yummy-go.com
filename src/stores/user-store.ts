"use client";

import {
  deleteUser,
  getUsers,
  saveUser,
  type FetchUsersParams,
  type SaveUserInput,
  type User
} from "@/services/user";
import { createCrudListStore } from "@/stores/crud-list-store";

export const useUserStore = createCrudListStore<
  User,
  SaveUserInput,
  FetchUsersParams
>({
  idKey: "login_uuid",
  list: getUsers,
  save: saveUser,
  remove: deleteUser
});
