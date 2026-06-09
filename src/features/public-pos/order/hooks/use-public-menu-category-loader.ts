"use client";

import type { TFunction } from "i18next";
import { useCallback } from "react";
import { usePublicPosStore } from "@/stores/public-pos-store";
import type { ToastInput } from "@/stores/toast-store";

type PublicPosState = ReturnType<typeof usePublicPosStore.getState>;

interface UsePublicMenuCategoryLoaderParams {
  lang: string;
  loadNormalCategoryProducts: PublicPosState["loadNormalCategoryProducts"];
  loadedCateUuids: string[];
  loadingCateUuids: string[];
  submittedSearch: string;
  t: TFunction;
  toast: (toast: ToastInput) => void;
  token: string;
}

export function usePublicMenuCategoryLoader({
  lang,
  loadNormalCategoryProducts,
  loadedCateUuids,
  loadingCateUuids,
  submittedSearch,
  t,
  toast,
  token,
}: UsePublicMenuCategoryLoaderParams) {
  const loadNormalCategoryProductsSafely = useCallback(
    async (cateUuid: string) => {
      if (
        !cateUuid ||
        loadedCateUuids.includes(cateUuid) ||
        loadingCateUuids.includes(cateUuid)
      ) {
        return;
      }

      try {
        await loadNormalCategoryProducts({
          t: token,
          lang,
          search: submittedSearch,
          cate_uuid: cateUuid,
        });
      } catch (error) {
        toast({
          title: t("pos.productLoadFailed"),
          description: error instanceof Error ? error.message : undefined,
          tone: "error",
        });
        throw error;
      }
    },
    [
      lang,
      loadNormalCategoryProducts,
      loadedCateUuids,
      loadingCateUuids,
      submittedSearch,
      t,
      toast,
      token,
    ],
  );

  const ensureNormalCategoryProducts = useCallback(
    (cateUuid: string) => {
      void loadNormalCategoryProductsSafely(cateUuid).catch(() => undefined);
    },
    [loadNormalCategoryProductsSafely],
  );

  return {
    ensureNormalCategoryProducts,
    loadNormalCategoryProductsSafely,
  };
}
