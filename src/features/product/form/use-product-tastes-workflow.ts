"use client";

import { useMemo, useState } from "react";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import type { TFunction } from "i18next";
import type { Product } from "@/services/product";
import type { SaveTasteInput, Taste } from "@/services/taste";
import type { ToastInput } from "@/stores/toast-store";
import type { TasteSelection } from "./product-form-types";
import {
  TASTE_NAME_KEYS,
  findTasteUuidByName,
  normalizedText,
  productTasteName,
  productTastesFromRows,
  selectedTasteBadges as buildSelectedTasteBadges,
  tasteUuid,
  textValues,
} from "./product-form-utils";

interface ProductTastesWorkflowOptions {
  createTasteRow: (input: SaveTasteInput) => Promise<Taste>;
  deleteTasteRow: (uuid: string) => Promise<void>;
  editing: Product | null;
  editingHydrationKey: string;
  language: string;
  loadTastes: (language: string, storeUuid: string) => Promise<Taste[]>;
  showToast: (toast: ToastInput) => void;
  storeUuid: string;
  t: TFunction;
  tastes: Taste[];
}

export function useProductTastesWorkflow({
  createTasteRow,
  deleteTasteRow,
  editing,
  editingHydrationKey,
  language,
  loadTastes,
  showToast,
  storeUuid,
  t,
  tastes,
}: ProductTastesWorkflowOptions) {
  const [prodTasteMaxSelect, setProdTasteMaxSelect] = useState("0");
  const [selectedTastes, setSelectedTastes] = useState<TasteSelection[]>([]);
  const [tasteDialogOpen, setTasteDialogOpen] = useState(false);
  const [tasteSearch, setTasteSearch] = useState("");
  const [newTasteNameLa, setNewTasteNameLa] = useState("");
  const [newTasteNameEng, setNewTasteNameEng] = useState("");
  const [editingTasteUuid, setEditingTasteUuid] = useState("");
  const [deletingTasteUuid, setDeletingTasteUuid] = useState("");
  const [hiddenTasteUuids, setHiddenTasteUuids] = useState<string[]>([]);

  const selectedTasteUuids = useMemo(
    () => new Set(selectedTastes.map((row) => row.taste_uuid)),
    [selectedTastes],
  );
  const tasteOptions = useMemo(() => {
    const hidden = new Set(hiddenTasteUuids);
    const rows = tastes.filter((taste) => {
      const uuid = tasteUuid(taste);
      return uuid && !hidden.has(uuid);
    });
    const seen = new Set(rows.map(tasteUuid));
    const missing =
      editing?.tastes?.filter((taste) => {
        const uuid = tasteUuid(taste);
        return uuid && !seen.has(uuid) && !hidden.has(uuid);
      }) ?? [];
    return missing.length ? [...rows, ...(missing as Taste[])] : rows;
  }, [editing?.tastes, hiddenTasteUuids, tastes]);
  const filteredTasteOptions = useMemo(() => {
    const query = normalizedText(tasteSearch);
    if (!query) return tasteOptions;
    return tasteOptions.filter((taste) =>
      textValues(taste, TASTE_NAME_KEYS).some((value) => value.includes(query)),
    );
  }, [tasteOptions, tasteSearch]);
  const selectedTasteBadges = useMemo(
    () => buildSelectedTasteBadges(selectedTastes, tasteOptions, language),
    [language, selectedTastes, tasteOptions],
  );

  useResetOnDeps([editing, editingHydrationKey, tastes], () => {
    if (!editing) return;
    setProdTasteMaxSelect(String(editing.prod_taste_max_select ?? 0));
    setSelectedTastes(productTastesFromRows(editing.tastes, tastes));
  }, { runOnMount: true });

  useResetOnDeps([editing, tasteOptions], () => {
    if (!editing?.tastes?.length || !tasteOptions.length) return;
    const resolved = productTastesFromRows(editing.tastes, tasteOptions);
    if (!resolved.length) return;
    setSelectedTastes((current) => {
      const selectedIds = new Set(current.map((row) => row.taste_uuid));
      const missing = resolved.filter((row) => !selectedIds.has(row.taste_uuid));
      return current.length ? (missing.length ? [...current, ...missing] : current) : resolved;
    });
  }, { runOnMount: true });

  function toggleTaste(uuid: string, checked: boolean) {
    setSelectedTastes((current) => {
      if (!checked) {
        return current
          .filter((row) => row.taste_uuid !== uuid)
          .map((row, index) => ({ ...row, taste_sort: index + 1 }));
      }
      if (current.some((row) => row.taste_uuid === uuid)) return current;
      return [...current, { taste_uuid: uuid, taste_sort: current.length + 1 }];
    });
  }

  function resetNewTasteForm() {
    setEditingTasteUuid("");
    setNewTasteNameLa("");
    setNewTasteNameEng("");
  }

  function resetTasteSelection() {
    setProdTasteMaxSelect("0");
    setSelectedTastes([]);
    setTasteSearch("");
    setTasteDialogOpen(false);
    resetNewTasteForm();
  }

  function editTaste(taste: Taste) {
    const uuid = tasteUuid(taste);
    if (!uuid) return;
    setEditingTasteUuid(uuid);
    setNewTasteNameLa(String(taste.taste_name_la ?? productTasteName(taste) ?? ""));
    setNewTasteNameEng(String(taste.taste_name_eng ?? ""));
  }

  async function saveTasteFromDialog() {
    const nameLa = newTasteNameLa.trim();
    const nameEng = newTasteNameEng.trim() || nameLa;
    if (!storeUuid || !nameLa) {
      showToast({
        title: t("settings.saveFailed"),
        description: !storeUuid ? t("settings.storeRequired") : t("fields.nameLa"),
        tone: "error",
      });
      return;
    }
    try {
      const saved = await createTasteRow({
        ...(editingTasteUuid ? { taste_uuid: editingTasteUuid } : {}),
        store_uuid_fk: storeUuid,
        taste_name_la: nameLa,
        taste_name_eng: nameEng,
        taste_status: 1,
        taste_sort: editingTasteUuid
          ? Number(tasteOptions.find((row) => tasteUuid(row) === editingTasteUuid)?.taste_sort ?? 0)
          : tasteOptions.length + 1,
      });
      const refreshed = await loadTastes(language, storeUuid);
      const savedUuid =
        editingTasteUuid || tasteUuid(saved) || findTasteUuidByName(refreshed, nameLa, nameEng);
      setHiddenTasteUuids((current) => current.filter((uuid) => uuid !== savedUuid));
      if (!editingTasteUuid && savedUuid) toggleTaste(savedUuid, true);
      showToast({ title: t("settings.saved"), tone: "success" });
      resetNewTasteForm();
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error",
      });
    }
  }

  async function deleteTasteFromDialog(uuid: string) {
    if (!uuid) return;
    try {
      await deleteTasteRow(uuid);
      setHiddenTasteUuids((current) => current.includes(uuid) ? current : [...current, uuid]);
      toggleTaste(uuid, false);
      if (editingTasteUuid === uuid) resetNewTasteForm();
      if (storeUuid) await loadTastes(language, storeUuid);
      showToast({ title: t("settings.deleted"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error",
      });
    } finally {
      setDeletingTasteUuid("");
    }
  }

  return {
    deletingTasteUuid,
    editingTasteUuid,
    editTaste,
    filteredTasteOptions,
    newTasteNameEng,
    newTasteNameLa,
    prodTasteMaxSelect,
    resetNewTasteForm,
    resetTasteSelection,
    saveTasteFromDialog,
    selectedTasteBadges,
    selectedTastes,
    selectedTasteUuids,
    setDeletingTasteUuid,
    setNewTasteNameEng,
    setNewTasteNameLa,
    setProdTasteMaxSelect,
    setTasteDialogOpen,
    setTasteSearch,
    tasteDialogOpen,
    tasteOptions,
    tasteSearch,
    toggleTaste,
    deleteTasteFromDialog,
  };
}
