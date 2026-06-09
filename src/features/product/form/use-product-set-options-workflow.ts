"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { TFunction } from "i18next";
import type { SaveSizeForStatusInput } from "@/services/size";
import type { ToastInput } from "@/stores/toast-store";
import type { DetailRow, SizeSelectOption, StatusSortFk } from "./product-form-types";
import {
  filterSizeOptionsByText,
  findSizeUuidByName,
  sizeName,
  sizeUuid
} from "./product-form-utils";

interface ProductSetOptionsWorkflowOptions {
  createSizeForStatus: (input: SaveSizeForStatusInput) => Promise<SizeSelectOption>;
  deleteSizeForStatus: (uuid: string) => Promise<void>;
  language: string;
  loadSizesByStatus: (storeUuid: string, statusSort: number, language?: string) => Promise<SizeSelectOption[]>;
  productSizesByStatus: SizeSelectOption[];
  setDetails: Dispatch<SetStateAction<DetailRow[]>>;
  showToast: (toast: ToastInput) => void;
  statusSortFk: StatusSortFk;
  storeUuid: string;
  t: TFunction;
  updateDetail: (id: string, patch: Partial<DetailRow>) => void;
}

export function useProductSetOptionsWorkflow({
  createSizeForStatus,
  deleteSizeForStatus,
  language,
  loadSizesByStatus,
  productSizesByStatus,
  setDetails,
  showToast,
  statusSortFk,
  storeUuid,
  t,
  updateDetail
}: ProductSetOptionsWorkflowOptions) {
  const [setOptionDialogOpen, setSetOptionDialogOpen] = useState(false);
  const [setOptionDetailId, setSetOptionDetailId] = useState("");
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
  const filteredSetOptionOptions = useMemo(
    () => filterSizeOptionsByText(setOptionOptions, setOptionSearch),
    [setOptionOptions, setOptionSearch]
  );

  function resetSetOptionForm() {
    setEditingSetOptionUuid("");
    setSetOptionNameLa("");
    setSetOptionNameEng("");
  }

  function handleSetOptionDialogOpen(open: boolean) {
    setSetOptionDialogOpen(open);
    if (!open) {
      setSetOptionDetailId("");
      setSetOptionSearch("");
      setDeletingSetOptionUuid("");
      resetSetOptionForm();
    }
  }

  function openSetOptionDialog(detailId: string) {
    setSetOptionDetailId(detailId);
    resetSetOptionForm();
    setSetOptionDialogOpen(true);
    if (storeUuid) {
      void loadSizesByStatus(storeUuid, 2, language).catch((error) => {
        showToast({
          title: t("settings.loadFailed", { title: t("settings.modules.size.title") }),
          description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
          tone: "error"
        });
      });
    }
  }

  function editSetOption(size: SizeSelectOption) {
    const uuid = sizeUuid(size);
    if (!uuid) return;
    setEditingSetOptionUuid(uuid);
    setSetOptionNameLa(String(size.size_name_la ?? sizeName(size) ?? ""));
    setSetOptionNameEng(String(size.size_name_eng ?? ""));
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
      const saved = await createSizeForStatus({
        size_uuid: editingSetOptionUuid,
        size_name_la: nameLa,
        size_name_eng: nameEng,
        store_uuid_fk: storeUuid,
        status_sort_fk: 2
      });
      const refreshed = await loadSizesByStatus(storeUuid, 2, language);
      const savedUuid = editingSetOptionUuid || sizeUuid(saved) || findSizeUuidByName(refreshed, nameLa, nameEng);

      if (!savedUuid) {
        throw new Error(t("toasts.pleaseTryAgain"));
      }

      if (!editingSetOptionUuid) updateDetail(setOptionDetailId, { size_uuid_fk: savedUuid });
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
      await deleteSizeForStatus(uuid);
      setDetails((current) =>
        current.map((row) => (row.size_uuid_fk === uuid ? { ...row, size_uuid_fk: "" } : row))
      );
      if (editingSetOptionUuid === uuid) resetSetOptionForm();
      await loadSizesByStatus(storeUuid, 2, language);
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
