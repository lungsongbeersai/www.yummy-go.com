"use client";

import { useEffect, useMemo, useState } from "react";
import type { TFunction } from "i18next";
import type { Product } from "@/services/product";
import type { SaveToppingInput, Topping } from "@/services/topping";
import type { ToastInput } from "@/stores/toast-store";
import type { BinaryFlag, ToppingSelection } from "./product-form-types";
import {
  TOPPING_HAS,
  TOPPING_NAME_KEYS,
  TOPPING_NONE,
  findToppingUuidByName,
  normalizedText,
  productHasToppings,
  productToppingName,
  productToppingUuid,
  productToppingsFromRows,
  productFormToppingDefaultPrice,
  selectedToppingBadges as buildSelectedToppingBadges,
  textValues,
  toppingUuid
} from "./product-form-utils";

interface ProductToppingsWorkflowOptions {
  createToppingRow: (input: SaveToppingInput) => Promise<Topping>;
  defaultToppingPrices: Record<string, string>;
  deleteToppingRow: (uuid: string) => Promise<void>;
  editing: Product | null;
  editingHydrationKey: string;
  language: string;
  loadToppings: (language: string, storeUuid: string) => Promise<Topping[]>;
  showToast: (toast: ToastInput) => void;
  storeUuid: string;
  t: TFunction;
  toppings: Topping[];
}

export function useProductToppingsWorkflow({
  createToppingRow,
  defaultToppingPrices,
  deleteToppingRow,
  editing,
  editingHydrationKey,
  language,
  loadToppings,
  showToast,
  storeUuid,
  t,
  toppings
}: ProductToppingsWorkflowOptions) {
  const [prodToppingStatus, setProdToppingStatus] = useState<BinaryFlag>(TOPPING_NONE);
  const [selectedToppings, setSelectedToppings] = useState<ToppingSelection[]>([]);
  const [toppingDialogOpen, setToppingDialogOpen] = useState(false);
  const [newToppingNameLa, setNewToppingNameLa] = useState("");
  const [newToppingNameEng, setNewToppingNameEng] = useState("");
  const [newToppingPrice, setNewToppingPrice] = useState("0");
  const [toppingSearch, setToppingSearch] = useState("");
  const [editingToppingUuid, setEditingToppingUuid] = useState("");
  const [deletingToppingUuid, setDeletingToppingUuid] = useState("");
  const [hiddenToppingUuids, setHiddenToppingUuids] = useState<string[]>([]);

  const selectedToppingMap = useMemo(
    () => new Map(selectedToppings.map((row) => [row.topping_uuid_fk, row])),
    [selectedToppings]
  );
  const toppingOptions = useMemo(() => {
    const hidden = new Set(hiddenToppingUuids);
    const rows = toppings.filter((topping) => {
      const uuid = toppingUuid(topping);
      return uuid && !hidden.has(uuid);
    });
    const seen = new Set(rows.map((topping) => toppingUuid(topping)));
    const missing =
      editing?.toppings?.filter((topping) => {
        const uuid = productToppingUuid(topping, rows);
        return uuid && !seen.has(uuid) && !hidden.has(uuid);
      }) ?? [];

    return missing.length ? [...rows, ...(missing as Topping[])] : rows;
  }, [editing?.toppings, hiddenToppingUuids, toppings]);
  const filteredToppingOptions = useMemo(() => {
    const query = normalizedText(toppingSearch);
    if (!query) return toppingOptions;
    return toppingOptions.filter((topping) =>
      textValues(topping, TOPPING_NAME_KEYS).some((value) => value.includes(query))
    );
  }, [toppingOptions, toppingSearch]);
  const selectedToppingBadges = useMemo(
    () => buildSelectedToppingBadges(selectedToppings, toppingOptions, language),
    [language, selectedToppings, toppingOptions]
  );

  useEffect(() => {
    if (!editing) return;
    setProdToppingStatus(productHasToppings(editing) ? TOPPING_HAS : TOPPING_NONE);
    setSelectedToppings(productToppingsFromRows(editing.toppings, toppings));
  }, [editing, editingHydrationKey, toppings]);

  useEffect(() => {
    if (!editing?.toppings?.length || !toppingOptions.length) return;

    const resolved = editing.toppings
      .map((row) => ({
        topping_uuid_fk: productToppingUuid(row, toppingOptions),
        topping_price: String(row.topping_price ?? 0)
      }))
      .filter((row) => row.topping_uuid_fk);

    if (!resolved.length) return;

    setSelectedToppings((current) => {
      const selectedIds = new Set(current.map((row) => row.topping_uuid_fk));
      const missing = resolved.filter((row) => !selectedIds.has(row.topping_uuid_fk));
      if (!current.length) return resolved;
      return missing.length ? [...current, ...missing] : current;
    });
  }, [editing, toppingOptions]);

  function toggleTopping(uuid: string, checked: boolean) {
    setSelectedToppings((current) => {
      if (checked) {
        if (current.some((row) => row.topping_uuid_fk === uuid)) return current;
        return [
          ...current,
          {
            topping_uuid_fk: uuid,
            topping_price: productFormToppingDefaultPrice(
              { toppingPrices: defaultToppingPrices },
              uuid,
            ),
          },
        ];
      }
      return current.filter((row) => row.topping_uuid_fk !== uuid);
    });
  }

  function updateToppingPrice(uuid: string, price: string) {
    setSelectedToppings((current) =>
      current.map((row) => (row.topping_uuid_fk === uuid ? { ...row, topping_price: price } : row))
    );
  }

  function resetNewToppingForm() {
    setEditingToppingUuid("");
    setNewToppingNameLa("");
    setNewToppingNameEng("");
    setNewToppingPrice("0");
  }

  function resetToppingSelection() {
    setProdToppingStatus(TOPPING_NONE);
    setSelectedToppings([]);
    setToppingSearch("");
    setToppingDialogOpen(false);
    resetNewToppingForm();
  }

  function selectSavedTopping(uuid: string, price: string, forceSelect: boolean) {
    if (!uuid) return;
    if (forceSelect) setProdToppingStatus(TOPPING_HAS);

    setSelectedToppings((current) => {
      const nextPrice = price.trim() || "0";
      const exists = current.some((row) => row.topping_uuid_fk === uuid);
      if (!forceSelect && !exists) return current;
      if (exists) {
        return current.map((row) => (row.topping_uuid_fk === uuid ? { ...row, topping_price: nextPrice } : row));
      }
      return [...current, { topping_uuid_fk: uuid, topping_price: nextPrice }];
    });
  }

  function editTopping(topping: Topping) {
    const uuid = toppingUuid(topping);
    if (!uuid) return;

    setEditingToppingUuid(uuid);
    setNewToppingNameLa(String(topping.topping_name_la ?? productToppingName(topping) ?? ""));
    setNewToppingNameEng(String(topping.topping_name_eng ?? ""));
    setNewToppingPrice(selectedToppingMap.get(uuid)?.topping_price ?? "0");
  }

  async function saveToppingFromDialog() {
    const nameLa = newToppingNameLa.trim();
    const nameEng = newToppingNameEng.trim() || nameLa;

    if (!storeUuid) {
      showToast({ title: t("settings.saveFailed"), description: t("settings.branchRequired"), tone: "error" });
      return;
    }

    if (!nameLa) {
      showToast({ title: t("settings.saveFailed"), description: t("fields.nameLa"), tone: "error" });
      return;
    }

    try {
      const saved = await createToppingRow({
        ...(editingToppingUuid ? { topping_uuid: editingToppingUuid } : {}),
        store_uuid_fk: storeUuid,
        topping_name_la: nameLa,
        topping_name_eng: nameEng
      });
      const refreshed = await loadToppings(language, storeUuid);
      const savedUuid = editingToppingUuid || toppingUuid(saved) || findToppingUuidByName(refreshed, nameLa, nameEng);

      setHiddenToppingUuids((current) => current.filter((uuid) => uuid !== savedUuid));
      selectSavedTopping(savedUuid, newToppingPrice, !editingToppingUuid);

      showToast({ title: t("settings.saved"), tone: "success" });
      resetNewToppingForm();
    } catch (error) {
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    }
  }

  async function deleteToppingFromDialog(uuid: string) {
    if (!uuid) return;

    try {
      await deleteToppingRow(uuid);
      setHiddenToppingUuids((current) => (current.includes(uuid) ? current : [...current, uuid]));
      setSelectedToppings((current) => current.filter((row) => row.topping_uuid_fk !== uuid));
      if (editingToppingUuid === uuid) resetNewToppingForm();
      if (storeUuid) await loadToppings(language, storeUuid);
      showToast({ title: t("settings.deleted"), tone: "success" });
    } catch (error) {
      showToast({
        title: t("settings.deleteFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    } finally {
      setDeletingToppingUuid("");
    }
  }

  return {
    deletingToppingUuid,
    editingToppingUuid,
    filteredToppingOptions,
    newToppingNameEng,
    newToppingNameLa,
    newToppingPrice,
    prodToppingStatus,
    selectedToppingBadges,
    selectedToppingMap,
    selectedToppings,
    setDeletingToppingUuid,
    setNewToppingNameEng,
    setNewToppingNameLa,
    setNewToppingPrice,
    setProdToppingStatus,
    setToppingDialogOpen,
    setToppingSearch,
    toppingDialogOpen,
    toppingOptions,
    toppingSearch,
    toggleTopping,
    updateToppingPrice,
    resetToppingSelection,
    resetNewToppingForm,
    editTopping,
    saveToppingFromDialog,
    deleteToppingFromDialog
  };
}
