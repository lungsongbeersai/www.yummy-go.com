"use client";

import { useState } from "react";
import type { TFunction } from "i18next";
import type { ToastInput } from "@/stores/toast-store";
import type { BinaryFlag, DetailRow, StatusSortFk } from "./product-form-types";
import { detailStockSummary, emptyDetail } from "./product-form-utils";

interface ProductFormDetailsOptions {
  isEditing: boolean;
  showToast: (toast: ToastInput) => void;
  statusSortFk: StatusSortFk;
  t: TFunction;
  updateDetailsStock: (stockModes: Array<{ pro_detail_uuid: string; pro_detail_stock: number }>) => Promise<void>;
}

export function useProductFormDetails({
  isEditing,
  showToast,
  statusSortFk,
  t,
  updateDetailsStock
}: ProductFormDetailsOptions) {
  const [details, setDetails] = useState<DetailRow[]>(() => [emptyDetail("1")]);
  const [bulkStockSaving, setBulkStockSaving] = useState(false);

  function addDetail() {
    setDetails((current) => [...current, emptyDetail(statusSortFk)]);
  }

  function updateDetail(id: string, patch: Partial<DetailRow>) {
    setDetails((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  async function updateAllDetailStockModes(nextStockMode: BinaryFlag) {
    const previousDetails = details;
    const nextDetails = previousDetails.map((row) => ({ ...row, pro_detail_stock: nextStockMode }));
    const stockModes = previousDetails
      .map((row) => ({
        pro_detail_uuid: row.pro_detail_uuid.trim(),
        pro_detail_stock: Number(nextStockMode)
      }))
      .filter((row) => row.pro_detail_uuid);

    setDetails(nextDetails);

    if (!isEditing || !stockModes.length) return;

    setBulkStockSaving(true);
    try {
      await updateDetailsStock(stockModes);
      showToast({ title: t("product.saved"), tone: "success" });
    } catch (error) {
      const previousStockById = new Map(previousDetails.map((row) => [row.id, row.pro_detail_stock]));
      setDetails((current) =>
        current.map((row) => ({
          ...row,
          pro_detail_stock: previousStockById.get(row.id) ?? row.pro_detail_stock
        }))
      );
      showToast({
        title: t("settings.saveFailed"),
        description: error instanceof Error ? error.message : t("toasts.pleaseTryAgain"),
        tone: "error"
      });
    } finally {
      setBulkStockSaving(false);
    }
  }

  function removeDetail(id: string) {
    setDetails((current) => (current.length <= 1 ? current : current.filter((row) => row.id !== id)));
  }

  return {
    bulkStockSaving,
    detailStockState: detailStockSummary(details),
    details,
    setDetails,
    addDetail,
    updateDetail,
    updateAllDetailStockModes,
    removeDetail
  };
}
