"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { TFunction } from "i18next";
import type {
  SaveSetChildOptionInput,
  SetChildOption,
} from "@/services/set-child-option";
import type { SaveSizeForStatusInput } from "@/services/size";
import type { ToastInput } from "@/stores/toast-store";
import type { DetailRow, SizeSelectOption, StatusSortFk } from "./product-form-types";
import {
  findSizeUuidByName,
  setChildOptionName,
  setChildOptionUuid,
  sizeName,
  sizeUuid
} from "./product-form-utils";

interface ProductSetOptionsWorkflowOptions {
  createSetChildOption: (input: SaveSetChildOptionInput) => Promise<SetChildOption>;
  createSizeForStatus: (input: SaveSizeForStatusInput) => Promise<SizeSelectOption>;
  deleteSetChildOption: (uuid: string) => Promise<void>;
  deleteSizeForStatus: (uuid: string) => Promise<void>;
  language: string;
  loadSizesByStatus: (storeUuid: string, statusSort: number, language?: string) => Promise<SizeSelectOption[]>;
  loadSetChildOptions: (language: string, storeUuid: string) => Promise<SetChildOption[]>;
  productSizesByStatus: SizeSelectOption[];
  setChildOptions: SetChildOption[];
  setDetails: Dispatch<SetStateAction<DetailRow[]>>;
  showToast: (toast: ToastInput) => void;
  statusSortFk: StatusSortFk;
  storeUuid: string;
  t: TFunction;
  updateDetail: (id: string, patch: Partial<DetailRow>) => void;
}

export function useProductSetOptionsWorkflow({
  createSetChildOption,
  createSizeForStatus,
  deleteSetChildOption,
  deleteSizeForStatus,
  language,
  loadSizesByStatus,
  loadSetChildOptions,
  productSizesByStatus,
  setChildOptions,
  setDetails,
  showToast,
  statusSortFk,
  storeUuid,
  t,
  updateDetail
}: ProductSetOptionsWorkflowOptions) {
  const [setOptionDialogOpen, setSetOptionDialogOpen] = useState(false);
  const [setOptionDetailId, setSetOptionDetailId] = useState("");
  const [setOptionChildId, setSetOptionChildId] = useState("");
  const [setOptionNameLa, setSetOptionNameLa] = useState("");
  const [setOptionNameEng, setSetOptionNameEng] = useState("");
  const [setOptionSearch, setSetOptionSearch] = useState("");
  const [editingSetOptionUuid, setEditingSetOptionUuid] = useState("");
  const [deletingSetOptionUuid, setDeletingSetOptionUuid] = useState("");
  const [setOptionSaving, setSetOptionSaving] = useState(false);

  const setOptionOptions = useMemo<SizeSelectOption[]>(
    () => productSizesByStatus.filter((size) => sizeUuid(size)),
    [productSizesByStatus]
  );
  const setChildOptionOptions = useMemo(
    () => setChildOptions.filter((option) => setChildOptionUuid(option)),
    [setChildOptions],
  );
  const isSetChildOptionDialog = Boolean(setOptionChildId);
  const setOptionDialogOptions = useMemo(() => (
    isSetChildOptionDialog
      ? setChildOptionOptions.map((option) => ({
          uuid: setChildOptionUuid(option),
          name: setChildOptionName(option),
          nameLa: String(option.set_child_option_name_la ?? setChildOptionName(option)),
          nameEng: String(option.set_child_option_name_eng ?? ""),
        }))
      : setOptionOptions.map((option) => ({
          uuid: sizeUuid(option),
          name: sizeName(option),
          nameLa: String(option.size_name_la ?? sizeName(option)),
          nameEng: String(option.size_name_eng ?? ""),
        }))
  ), [isSetChildOptionDialog, setChildOptionOptions, setOptionOptions]);
  const filteredSetOptionOptions = useMemo(() => {
    const query = setOptionSearch.trim().toLocaleLowerCase();
    if (!query) return setOptionDialogOptions;
    return setOptionDialogOptions.filter((option) =>
      [option.name, option.nameLa, option.nameEng].some((value) =>
        value.toLocaleLowerCase().includes(query),
      ),
    );
  }, [setOptionDialogOptions, setOptionSearch]);

  function resetSetOptionForm() {
    setEditingSetOptionUuid("");
    setSetOptionNameLa("");
    setSetOptionNameEng("");
  }

  function handleSetOptionDialogOpen(open: boolean) {
    setSetOptionDialogOpen(open);
    if (!open) {
      setSetOptionDetailId("");
      setSetOptionChildId("");
      setSetOptionSearch("");
      setDeletingSetOptionUuid("");
      resetSetOptionForm();
    }
  }

  function openSetOptionDialog(detailId: string, childId = "") {
    setSetOptionDetailId(detailId);
    setSetOptionChildId(childId);
    resetSetOptionForm();
    setSetOptionDialogOpen(true);
    if (storeUuid) {
      const reload = childId
        ? loadSetChildOptions(language, storeUuid)
        : loadSizesByStatus(storeUuid, 2, language);
      void reload.catch((error) => {
        showToast({
          title: t("settings.loadFailed", { title: t("settings.modules.size.title") }),
          description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
          tone: "error"
        });
      });
    }
  }

  function editSetOption(option: {
    uuid: string;
    name: string;
    nameLa: string;
    nameEng: string;
  }) {
    const uuid = option.uuid;
    if (!uuid) return;
    setEditingSetOptionUuid(uuid);
    setSetOptionNameLa(option.nameLa || option.name);
    setSetOptionNameEng(option.nameEng);
  }

  async function saveSetOptionFromDialog() {
    const nameLa = setOptionNameLa.trim();
    const nameEng = setOptionNameEng.trim() || nameLa;

    if (!storeUuid) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.branchRequired"), tone: "error" });
      return;
    }

    if (statusSortFk !== "2" || !setOptionDetailId) {
      showToast({ title: t("settings.saveFailed"), description: t("toasts.pleaseTryAgain"), tone: "error" });
      return;
    }

    if (!nameLa) {
      showToast({ title: t("settings.saveFailed"), description: t("fields.nameLa"), tone: "error" });
      return;
    }

    setSetOptionSaving(true);
    try {
      const savedUuid = isSetChildOptionDialog
        ? await (async () => {
            const saved = await createSetChildOption({
              ...(editingSetOptionUuid
                ? { set_child_option_uuid: editingSetOptionUuid }
                : {}),
              set_child_option_name_la: nameLa,
              set_child_option_name_eng: nameEng,
              store_uuid_fk: storeUuid,
              set_child_option_status: 1,
              set_child_option_sort: editingSetOptionUuid
                ? Number(
                    setChildOptionOptions.find(
                      (option) => setChildOptionUuid(option) === editingSetOptionUuid,
                    )?.set_child_option_sort ?? 0,
                  )
                : setChildOptionOptions.length + 1,
            });
            const refreshed = await loadSetChildOptions(language, storeUuid);
            const matched = refreshed.find((option) =>
              String(option.set_child_option_name_la ?? "").trim().toLocaleLowerCase() ===
              nameLa.toLocaleLowerCase(),
            );
            return editingSetOptionUuid || setChildOptionUuid(saved) ||
              String(matched?.set_child_option_uuid ?? "");
          })()
        : await (async () => {
            const saved = await createSizeForStatus({
              size_uuid: editingSetOptionUuid,
              size_name_la: nameLa,
              size_name_eng: nameEng,
              store_uuid_fk: storeUuid,
              status_sort_fk: 2,
            });
            const refreshed = await loadSizesByStatus(storeUuid, 2, language);
            return editingSetOptionUuid || sizeUuid(saved) ||
              findSizeUuidByName(refreshed, nameLa, nameEng);
          })();

      if (!savedUuid) {
        throw new Error(t("toasts.pleaseTryAgain"));
      }

      if (!editingSetOptionUuid) {
        if (setOptionChildId) {
          setDetails((current) => current.map((row) =>
            row.id === setOptionDetailId
              ? {
                  ...row,
                  set_option_groups: row.set_option_groups.map((group) =>
                    group.id === setOptionChildId
                      ? { ...group, set_child_option_uuid_fk: savedUuid }
                      : group,
                  ),
                }
              : row,
          ));
        } else {
          updateDetail(setOptionDetailId, { size_uuid_fk: savedUuid });
        }
      }
      showToast({
        title: editingSetOptionUuid ? t("settings.saved") : t("product.setProductOptionSaved"),
        tone: "success"
      });
      resetSetOptionForm();
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    } finally {
      setSetOptionSaving(false);
    }
  }

  async function deleteSetOptionFromDialog(uuid: string) {
    if (!uuid || !storeUuid) return;

    setSetOptionSaving(true);
    try {
      if (isSetChildOptionDialog) {
        await deleteSetChildOption(uuid);
        setDetails((current) =>
          current.map((row) => ({
            ...row,
            set_option_groups: row.set_option_groups.map((group) =>
              group.set_child_option_uuid_fk === uuid
                ? { ...group, set_child_option_uuid_fk: "" }
                : group,
            ),
          })),
        );
      } else {
        await deleteSizeForStatus(uuid);
        setDetails((current) =>
          current.map((row) => ({
            ...row,
            size_uuid_fk: row.size_uuid_fk === uuid ? "" : row.size_uuid_fk,
          })),
        );
      }
      if (editingSetOptionUuid === uuid) resetSetOptionForm();
      if (isSetChildOptionDialog) {
        await loadSetChildOptions(language, storeUuid);
      } else {
        await loadSizesByStatus(storeUuid, 2, language);
      }
      showToast({ title: t("settings.deleted"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    } finally {
      setDeletingSetOptionUuid("");
      setSetOptionSaving(false);
    }
  }

  return {
    deletingSetOptionUuid,
    editingSetOptionUuid,
    filteredSetOptionOptions,
    handleSetOptionDialogOpen,
    openSetOptionDialog,
    resetSetOptionForm,
    setDeletingSetOptionUuid,
    setOptionDialogOpen,
    setOptionNameEng,
    setOptionNameLa,
    setOptionOptions,
    setChildOptionOptions,
    isSetChildOptionDialog,
    setOptionSaving,
    setOptionSearch,
    setSetOptionNameEng,
    setSetOptionNameLa,
    setSetOptionSearch,
    editSetOption,
    saveSetOptionFromDialog,
    deleteSetOptionFromDialog
  };
}
