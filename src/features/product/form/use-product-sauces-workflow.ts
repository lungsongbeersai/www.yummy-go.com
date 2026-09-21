"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type { TFunction } from "i18next";
import type { SaveSauceInput, Sauce } from "@/services/sauce";
import type { ToastInput } from "@/stores/toast-store";
import type { DetailRow } from "./product-form-types";

interface ProductSaucesWorkflowOptions {
  createSauceRow: (input: SaveSauceInput) => Promise<Sauce>;
  deleteSauceRow: (uuid: string) => Promise<void>;
  language: string;
  loadSauces: (language: string, storeUuid: string) => Promise<Sauce[]>;
  sauces: Sauce[];
  showToast: (toast: ToastInput) => void;
  setDetails: Dispatch<SetStateAction<DetailRow[]>>;
  storeUuid: string;
  t: TFunction;
}

export function useProductSaucesWorkflow({
  createSauceRow,
  deleteSauceRow,
  language,
  loadSauces,
  sauces,
  showToast,
  setDetails,
  storeUuid,
  t,
}: ProductSaucesWorkflowOptions) {
  const [sauceDialogOpen, setSauceDialogOpen] = useState(false);
  const [newSauceNameLa, setNewSauceNameLa] = useState("");
  const [newSauceNameEng, setNewSauceNameEng] = useState("");
  const [editingSauceUuid, setEditingSauceUuid] = useState("");
  const [deletingSauceUuid, setDeletingSauceUuid] = useState("");

  function resetSauceForm() {
    setEditingSauceUuid("");
    setNewSauceNameLa("");
    setNewSauceNameEng("");
  }

  function editSauce(sauce: Sauce) {
    setEditingSauceUuid(sauce.sauce_uuid);
    setNewSauceNameLa(String(sauce.sauce_name_la ?? sauce.sauce_name ?? ""));
    setNewSauceNameEng(String(sauce.sauce_name_eng ?? ""));
    setSauceDialogOpen(true);
  }

  async function saveSauceFromDialog() {
    const nameLa = newSauceNameLa.trim();
    const nameEng = newSauceNameEng.trim() || nameLa;
    if (!storeUuid || !nameLa) {
      showToast({
        title: t("settings.saveFailed"),
        description: !storeUuid ? t("settings.storeRequired") : t("fields.nameLa"),
        tone: "error",
      });
      return;
    }
    try {
      await createSauceRow({
        ...(editingSauceUuid ? { sauce_uuid: editingSauceUuid } : {}),
        store_uuid_fk: storeUuid,
        sauce_name_la: nameLa,
        sauce_name_eng: nameEng,
        sauce_status: 1,
        sauce_sort: editingSauceUuid
          ? Number(sauces.find((row) => row.sauce_uuid === editingSauceUuid)?.sauce_sort ?? 0)
          : sauces.length + 1,
      });
      await loadSauces(language, storeUuid);
      showToast({ title: t("settings.saved"), tone: "success" });
      resetSauceForm();
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error",
      });
    }
  }

  async function deleteSauceFromDialog(uuid: string) {
    if (!uuid) return;
    try {
      await deleteSauceRow(uuid);
      if (storeUuid) await loadSauces(language, storeUuid);
      setDetails((current) => current.map((detail) => ({
        ...detail,
        set_option_groups: detail.set_option_groups.map((group) => ({
          ...group,
          sauce_uuid_fks: group.sauce_uuid_fks.filter(
            (sauceUuid) => sauceUuid !== uuid,
          ),
        })),
      })));
      if (editingSauceUuid === uuid) resetSauceForm();
      showToast({ title: t("settings.deleted"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error",
      });
    } finally {
      setDeletingSauceUuid("");
    }
  }

  return {
    sauceOptions: sauces,
    sauceDialogOpen,
    setSauceDialogOpen,
    newSauceNameLa,
    setNewSauceNameLa,
    newSauceNameEng,
    setNewSauceNameEng,
    editingSauceUuid,
    deletingSauceUuid,
    setDeletingSauceUuid,
    resetSauceForm,
    editSauce,
    saveSauceFromDialog,
    deleteSauceFromDialog,
  };
}
