"use client";

import { useCallback, useEffect } from "react";
import type { TFunction } from "i18next";
import type { Category } from "@/services/category";
import type { Color } from "@/services/color";
import type { Group } from "@/services/group";
import type { SetChildOption } from "@/services/set-child-option";
import type { Size } from "@/services/size";
import type { Taste } from "@/services/taste";
import type { Topping } from "@/services/topping";
import type { Unit } from "@/services/unit";
import { useProductStore } from "@/stores/product-store";
import { useReferenceStore } from "@/stores/reference-store";
import { useSetChildOptionStore } from "@/stores/set-child-option-store";
import type { ToastInput } from "@/stores/toast-store";
import { useToppingStore } from "@/stores/topping-store";
import { useTasteStore } from "@/stores/taste-store";
import type { StatusSortFk } from "./product-form-types";
import {
  EMPTY_CATEGORIES,
  EMPTY_COLORS,
  EMPTY_GROUPS,
  EMPTY_SIZES,
  EMPTY_TASTES,
  EMPTY_TOPPINGS,
  EMPTY_UNITS
} from "./product-form-utils";

interface ProductFormReferenceDataOptions {
  language: string;
  storeUuid: string;
  statusSortFk: StatusSortFk;
  showToast: (toast: ToastInput) => void;
  t: TFunction;
}

export function useProductFormReferenceData({
  language,
  showToast,
  statusSortFk,
  storeUuid,
  t
}: ProductFormReferenceDataOptions) {
  const rows = useProductStore((state) => state.rows);
  const productLoading = useProductStore((state) => state.loading);
  const productSizesByStatus = useProductStore((state) => state.sizesByStatus);
  const productSizesByStatusStatus = useProductStore((state) => state.sizesByStatusStatus);
  const saving = useProductStore((state) => state.saving);
  const saveProduct = useProductStore((state) => state.save);
  const loadProducts = useProductStore((state) => state.load);
  const loadSizesByStatus = useProductStore((state) => state.loadSizesByStatus);
  const createSizeForStatus = useProductStore((state) => state.createSizeForStatus);
  const deleteSizeForStatus = useProductStore((state) => state.deleteSizeForStatus);
  const updateDetailsStock = useProductStore((state) => state.updateDetailsStock);
  const categories = (useReferenceStore((state) => state.options.categories) ?? EMPTY_CATEGORIES) as Category[];
  const colors = (useReferenceStore((state) => state.options.colors) ?? EMPTY_COLORS) as Color[];
  const groups = (useReferenceStore((state) => state.options.groups) ?? EMPTY_GROUPS) as Group[];
  const units = (useReferenceStore((state) => state.options.units) ?? EMPTY_UNITS) as Unit[];
  const sizes = (useReferenceStore((state) => state.options.sizes) ?? EMPTY_SIZES) as Size[];
  const toppings = (useReferenceStore((state) => state.options.toppings) ?? EMPTY_TOPPINGS) as Topping[];
  const tastes = (useReferenceStore((state) => state.options.tastes) ?? EMPTY_TASTES) as Taste[];
  const loadCategories = useReferenceStore((state) => state.loadCategories);
  const loadColors = useReferenceStore((state) => state.loadColors);
  const loadGroups = useReferenceStore((state) => state.loadGroups);
  const loadUnits = useReferenceStore((state) => state.loadUnits);
  const loadSizes = useReferenceStore((state) => state.loadSizes);
  const loadToppings = useReferenceStore((state) => state.loadToppings);
  const loadTastes = useReferenceStore((state) => state.loadTastes);
  const createToppingRow = useToppingStore((state) => state.save);
  const deleteToppingRow = useToppingStore((state) => state.remove);
  const toppingSaving = useToppingStore((state) => state.saving);
  const createTasteRow = useTasteStore((state) => state.save);
  const deleteTasteRow = useTasteStore((state) => state.remove);
  const tasteSaving = useTasteStore((state) => state.saving);
  const setChildOptions = useSetChildOptionStore((state) => state.rows) as SetChildOption[];
  const loadSetChildOptionRows = useSetChildOptionStore((state) => state.load);
  const createSetChildOption = useSetChildOptionStore((state) => state.save);
  const deleteSetChildOption = useSetChildOptionStore((state) => state.remove);

  const loadSetChildOptions = useCallback((lang: string, targetStoreUuid: string) =>
    loadSetChildOptionRows({
      lang,
      store_uuid_fk: targetStoreUuid,
      limit: "All",
    }), [loadSetChildOptionRows]);

  useEffect(() => {
    if (!storeUuid) return;
    void Promise.all([
      loadCategories(language, storeUuid),
      loadColors(),
      loadGroups(language, storeUuid),
      loadUnits(language, storeUuid),
      loadSizes(language, storeUuid),
      loadToppings(language, storeUuid),
      loadTastes(language, storeUuid),
      ...(statusSortFk === "2"
        ? [loadSetChildOptions(language, storeUuid)]
        : []),
    ]).catch((error) => {
      showToast({
        title: t("settings.loadFailed", { title: t("product.title") }),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    });
  }, [language, loadCategories, loadColors, loadGroups, loadSetChildOptions, loadSizes, loadTastes, loadToppings, loadUnits, showToast, statusSortFk, storeUuid, t]);

  useEffect(() => {
    if (!storeUuid) return;
    void loadSizesByStatus(storeUuid, Number(statusSortFk), language).catch((error) => {
      showToast({
        title: t("settings.loadFailed", { title: t("settings.modules.size.title") }),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    });
  }, [language, loadSizesByStatus, showToast, statusSortFk, storeUuid, t]);

  return {
    rows,
    productLoading,
    productSizesByStatus,
    productSizesByStatusStatus,
    saving,
    saveProduct,
    loadProducts,
    loadSizesByStatus,
    createSizeForStatus,
    deleteSizeForStatus,
    updateDetailsStock,
    categories,
    colors,
    groups,
    units,
    sizes,
    toppings,
    tastes,
    loadCategories,
    loadUnits,
    loadSizes,
    loadToppings,
    loadTastes,
    createToppingRow,
    deleteToppingRow,
    toppingSaving,
    createTasteRow,
    deleteTasteRow,
    tasteSaving,
    setChildOptions,
    loadSetChildOptions,
    createSetChildOption,
    deleteSetChildOption,
  };
}
