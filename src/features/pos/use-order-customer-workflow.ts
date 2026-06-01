"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchCateProducts, getProdItem, ProductSortStatus, type CateProductItem, type CateWithProducts, type ProdDetail, type ProdItem, type ProdTopping } from "@/services/pos";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePosStore } from "@/stores/pos-store";
import { useToastStore } from "@/stores/toast-store";
import {
  buildStaffOrderInput,
  countProducts,
  defaultOrderQty,
  emptyMenuBySort,
  firstAvailableDetail,
  firstStatusWithProducts,
  flattenProducts,
  getModalUnitPrice,
  getProductBlockedState,
  getProductModalMode,
  nextMenuCategoryUuid,
  normalizeProdItem,
  orderCustomerUrl,
  productNeedsModal,
  selectedOrderTable,
  selectedToppingsFromUuids,
  toggleToppingUuid,
  type MenuBySort,
  type ProductCardEntry,
} from "./order-customer-utils";
import { optionalString, visibleCartItems } from "./table-selection/utils";

export type OrderCustomerWorkflowInput = {
  initialTableUuid: string;
  initialTableName: string;
};

export function useOrderCustomerWorkflow({
  initialTableUuid,
  initialTableName,
}: OrderCustomerWorkflowInput) {
  const { t } = useTranslation();
  const router = useRouter();
  const isMobile = useIsMobile();
  const user = useAuthStore((state) => state.user);
  const language = useAppStore((state) => state.language);
  const showToast = useToastStore((state) => state.show);
  const zones = usePosStore((state) => state.zones);
  const cart = usePosStore((state) => state.cart);
  const loadingTables = usePosStore((state) => state.loading);
  const loadingCart = usePosStore((state) => state.loadingCart);
  const saving = usePosStore((state) => state.saving);
  const loadTables = usePosStore((state) => state.loadTables);
  const loadCartStore = usePosStore((state) => state.loadCart);
  const createOrder = usePosStore((state) => state.createOrder);
  const setTable = usePosStore((state) => state.setTable);
  const [categories, setCategories] = useState<CateWithProducts[]>([]);
  const [selectedCateUuid, setSelectedCateUuid] = useState("");
  const [activeSort, setActiveSort] = useState<ProductSortStatus>(
    ProductSortStatus.NORMAL,
  );
  const [menuBySort, setMenuBySort] = useState<MenuBySort>(() =>
    emptyMenuBySort(),
  );
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [loadingProductUuid, setLoadingProductUuid] = useState("");
  const [productSheetOpen, setProductSheetOpen] = useState(false);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  const [selectedListProduct, setSelectedListProduct] =
    useState<CateProductItem | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProdItem | null>(null);
  const [detailUuid, setDetailUuid] = useState("");
  const [toppingUuids, setToppingUuids] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);

  const selectedTable = useMemo(
    () =>
      selectedOrderTable({
        tableName: initialTableName,
        tableUuid: initialTableUuid,
        zones,
      }),
    [initialTableName, initialTableUuid, zones],
  );

  const activeProducts = useMemo(
    () => flattenProducts(menuBySort[activeSort]),
    [activeSort, menuBySort],
  );
  const cartCount = useMemo(() => visibleCartItems(cart).length, [cart]);
  const selectedDetail = useMemo(
    () =>
      (selectedProduct?.details ?? []).find(
        (detail) => detail.pro_detail_uuid === detailUuid,
      ) ?? firstAvailableDetail(selectedProduct),
    [detailUuid, selectedProduct],
  );
  const selectedToppings = useMemo(
    () => selectedToppingsFromUuids(selectedProduct, toppingUuids),
    [selectedProduct, toppingUuids],
  );
  const productMode = useMemo(
    () => getProductModalMode(activeSort, selectedProduct),
    [activeSort, selectedProduct],
  );
  const modalUnitPrice = useMemo(
    () =>
      getModalUnitPrice(
        selectedProduct,
        selectedDetail,
        selectedToppings,
        productMode,
      ),
    [productMode, selectedDetail, selectedProduct, selectedToppings],
  );

  const fetchMenuGroups = useCallback(
    async (cateUuid: string, query: string) => {
      if (!user?.branch_uuid) return emptyMenuBySort();

      const selectedCateUuid = optionalString(cateUuid) ?? "";
      const searchQuery = query ?? "";
      if (!selectedCateUuid) return emptyMenuBySort();

      const request = (status_sort_fk: ProductSortStatus) =>
        fetchCateProducts({
          branch_uuid_fk: user.branch_uuid,
          cate_uuid: selectedCateUuid,
          lang: language,
          search: searchQuery,
          status_sort_fk,
        });

      const [normal, set, promotion] = await Promise.all([
        request(ProductSortStatus.NORMAL),
        request(ProductSortStatus.SET),
        request(ProductSortStatus.PROMOTION),
      ]);

      return {
        [ProductSortStatus.NORMAL]: normal.data ?? [],
        [ProductSortStatus.SET]: set.data ?? [],
        [ProductSortStatus.PROMOTION]: promotion.data ?? [],
      };
    },
    [language, user?.branch_uuid],
  );

  const loadCart = useCallback(async () => {
    if (!initialTableUuid) return;

    try {
      await loadCartStore({ table_uuid: initialTableUuid, lang: language });
    } catch (error) {
      showToast({
        title: t("pos.orderFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }, [initialTableUuid, language, loadCartStore, showToast, t]);

  const loadTablesForBranch = useCallback(async () => {
    if (!user?.branch_uuid) return [];

    try {
      return await loadTables({
        branch_uuid_fk: user.branch_uuid,
        lang: language,
      });
    } catch (error) {
      showToast({
        title: t("pos.failedTables"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
      return [];
    }
  }, [language, loadTables, showToast, t, user?.branch_uuid]);

  const loadMenu = useCallback(
    async ({
      cateUuid = "",
      query = "",
      refreshCategories = false,
    }: {
      cateUuid?: string;
      query?: string;
      refreshCategories?: boolean;
    } = {}) => {
      if (!user?.branch_uuid) {
        setCategories([]);
        setMenuBySort(emptyMenuBySort());
        return;
      }

      setLoadingMenu(true);
      try {
        let nextCateUuid = optionalString(cateUuid) ?? "";
        const nextQuery = query ?? "";

        if (refreshCategories) {
          const catalog = await fetchCateProducts({
            branch_uuid_fk: user.branch_uuid,
            lang: language,
            search: "",
            status_sort_fk: ProductSortStatus.NORMAL,
          });
          const nextCategories = catalog.data ?? [];
          setCategories(nextCategories);
          nextCateUuid = nextMenuCategoryUuid({
            categories: nextCategories,
            defaultCateUuid: catalog.default_cate_uuid,
            requestedCateUuid: nextCateUuid,
            selectedCateUuid: catalog.selected_cate_uuid,
          });
        }

        const nextMenu = await fetchMenuGroups(nextCateUuid, nextQuery);
        setSelectedCateUuid(nextCateUuid);
        setSubmittedSearch(nextQuery);
        setMenuBySort(nextMenu);
        setActiveSort((current) =>
          countProducts(nextMenu[current]) > 0
            ? current
            : firstStatusWithProducts(nextMenu),
        );
      } catch (error) {
        showToast({
          title: t("pos.failedProducts"),
          description: error instanceof Error ? error.message : "",
          tone: "error",
        });
      } finally {
        setLoadingMenu(false);
      }
    },
    [fetchMenuGroups, language, showToast, t, user?.branch_uuid],
  );

  const submitProductOrder = useCallback(
    async ({
      detail,
      noteText,
      quantity,
      toppings,
    }: {
      detail: ProdDetail;
      noteText: string;
      quantity: number;
      toppings: ProdTopping[];
    }) => {
      await createOrder(
        buildStaffOrderInput({
          branchUuid: user?.branch_uuid ?? "",
          detail,
          lang: language,
          noteText,
          quantity,
          tableUuid: initialTableUuid,
          toppings,
          userUuid: user?.uuid ?? "",
        }),
      );
      await loadCart();
      showToast({ title: t("pos.orderCreated"), tone: "success" });
    },
    [
      createOrder,
      initialTableUuid,
      language,
      loadCart,
      showToast,
      t,
      user?.branch_uuid,
      user?.uuid,
    ],
  );

  useEffect(() => {
    setTable(initialTableUuid, initialTableName);
    setCartSheetOpen(false);
  }, [initialTableName, initialTableUuid, setTable]);

  useEffect(() => {
    void loadTablesForBranch();
  }, [loadTablesForBranch]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  useEffect(() => {
    void loadMenu({ refreshCategories: true });
  }, [loadMenu]);

  function openTablesPage() {
    router.replace("/sales/open-table-sale");
  }

  async function refreshAll() {
    await Promise.all([
      loadTablesForBranch(),
      loadCart(),
      loadMenu({
        cateUuid: selectedCateUuid,
        query: submittedSearch,
        refreshCategories: !categories.length,
      }),
    ]);
  }

  async function selectCategory(cateUuid: string) {
    setSearch("");
    await loadMenu({ cateUuid, query: "" });
  }

  async function submitSearch() {
    await loadMenu({ cateUuid: selectedCateUuid, query: search.trim() });
  }

  async function openOrAddProduct(entry: ProductCardEntry) {
    const blockedState = getProductBlockedState(entry.product, activeSort);
    if (blockedState) return;

    setLoadingProductUuid(entry.product.prod_uuid);
    try {
      const item = await getProdItem({
        lang: language,
        prod_uuid: entry.product.prod_uuid,
      });
      const productItem = normalizeProdItem(item, entry.product);

      if (productNeedsModal(entry.product, productItem, activeSort)) {
        openProductOptions(entry.product, productItem);
        return;
      }

      const detail = firstAvailableDetail(productItem);
      if (!detail) throw new Error("Product detail is required");

      await submitProductOrder({
        detail,
        noteText: "",
        quantity: defaultOrderQty(detail),
        toppings: [],
      });
    } catch (error) {
      showToast({
        title: t("pos.orderFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setLoadingProductUuid("");
    }
  }

  function openProductOptions(listProduct: CateProductItem, product: ProdItem) {
    const detail = firstAvailableDetail(product);
    setSelectedListProduct(listProduct);
    setSelectedProduct(product);
    setDetailUuid(detail?.pro_detail_uuid ?? "");
    setQty(defaultOrderQty(detail));
    setToppingUuids([]);
    setNote("");
    setProductSheetOpen(true);
  }

  function changeProductDetail(nextDetail: ProdDetail) {
    setDetailUuid(nextDetail.pro_detail_uuid);
    setQty(defaultOrderQty(nextDetail));
  }

  function toggleSelectedTopping(uuid: string) {
    setToppingUuids((current) => toggleToppingUuid(current, uuid));
  }

  async function submitSelectedProduct() {
    if (!selectedProduct || !selectedDetail || saving) return;

    try {
      await submitProductOrder({
        detail: selectedDetail,
        noteText: note,
        quantity: qty,
        toppings: selectedToppings,
      });
      setProductSheetOpen(false);
    } catch (error) {
      showToast({
        title: t("pos.orderFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }

  async function handleTableActionComplete(nextTableUuid?: string) {
    const nextZones = await loadTablesForBranch();
    const targetUuid = nextTableUuid || initialTableUuid;

    if (nextTableUuid && nextTableUuid !== initialTableUuid) {
      const nextTable = selectedOrderTable({
        tableName: initialTableName,
        tableUuid: nextTableUuid,
        zones: nextZones,
      });
      router.replace(
        orderCustomerUrl({
          tableName: nextTable.table_name ?? initialTableName,
          tableUuid: nextTableUuid,
        }),
      );
      return;
    }

    await loadCartStore({ table_uuid: targetUuid, lang: language });
  }

  return {
    activeProducts,
    activeSort,
    cart,
    cartCount,
    cartSheetOpen,
    categories,
    changeProductDetail,
    handleTableActionComplete,
    isMobile,
    loadCart,
    loadingCart,
    loadingMenu,
    loadingProductUuid,
    loadingTables,
    menuBySort,
    modalUnitPrice,
    note,
    openOrAddProduct,
    openTablesPage,
    productMode,
    productSheetOpen,
    qty,
    refreshAll,
    saving,
    search,
    selectCategory,
    selectedCateUuid,
    selectedDetail,
    selectedListProduct,
    selectedProduct,
    selectedTable,
    selectedToppings,
    setActiveSort,
    setCartSheetOpen,
    setNote,
    setProductSheetOpen,
    setQty,
    setSearch,
    submitSearch,
    submitSelectedProduct,
    t,
    toggleSelectedTopping,
    toppingUuids,
    zones,
  };
}

export type OrderCustomerWorkflow = ReturnType<typeof useOrderCustomerWorkflow>;
