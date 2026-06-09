"use client";

import { useEffect } from "react";
import type { TFunction } from "i18next";
import type { Category } from "@/services/category";
import type { Color } from "@/services/color";
import type { Size } from "@/services/size";
import type { Topping } from "@/services/topping";
import type { Unit } from "@/services/unit";
import { useProductStore } from "@/stores/product-store";
import { useReferenceStore } from "@/stores/reference-store";
import type { ToastInput } from "@/stores/toast-store";
import { useToppingStore } from "@/stores/topping-store";
import type { StatusSortFk } from "./product-form-types";
import {
  EMPTY_CATEGORIES,
  EMPTY_COLORS,
  EMPTY_SIZES,
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
  const units = (useReferenceStore((state) => state.options.units) ?? EMPTY_UNITS) as Unit[];
  const sizes = (useReferenceStore((state) => state.options.sizes) ?? EMPTY_SIZES) as Size[];
  const toppings = (useReferenceStore((state) => state.options.toppings) ?? EMPTY_TOPPINGS) as Topping[];
  const loadCategories = useReferenceStore((state) => state.loadCategories);
  const loadColors = useReferenceStore((state) => state.loadColors);
  const loadUnits = useReferenceStore((state) => state.loadUnits);
  const loadSizes = useReferenceStore((state) => state.loadSizes);
  const loadToppings = useReferenceStore((state) => state.loadToppings);
  const createToppingRow = useToppingStore((state) => state.save);
  const deleteToppingRow = useToppingStore((state) => state.remove);
  const toppingSaving = useToppingStore((state) => state.saving);

  useEffect(() => {
    if (!storeUuid) return;
    void Promise.all([
      loadCategories(language, storeUuid),
      loadColors(),
      loadUnits(language, storeUuid),
      loadSizes(language, storeUuid),
      loadToppings(language, storeUuid)
    ]).catch((error) => {
      showToast({
        title: t("settings.loadFailed", { title: t("product.title") }),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    });
  }, [language, loadCategories, loadColors, loadSizes, loadToppings, loadUnits, showToast, storeUuid, t]);

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
    units,
    sizes,
    toppings,
    loadToppings,
    createToppingRow,
    deleteToppingRow,
    toppingSaving
  };
}
