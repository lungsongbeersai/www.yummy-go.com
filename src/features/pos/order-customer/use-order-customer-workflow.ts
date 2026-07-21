"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import type { CateWithProducts, ProdDetail, ProdItem } from "@/services/pos";
import type { PrinterDeviceContext } from "@/services/printer";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import {
  buildStaffOrderInput,
  changeToppingQty,
  countProducts,
  emptyMenuBySort,
  firstAvailableDetail,
  firstStatusWithProducts,
  flattenProducts,
  getModalUnitPrice,
  getOrderSelectionIssue,
  getProductBlockedState,
  getProductModalMode,
  isDetailAvailable,
  isDetailEnabled,
  nextMenuCategoryUuid,
  normalizeProdItem,
  orderCustomerUrl,
  orderQuantityRules,
  orderSelectionIssueLabel,
  ProductSortStatus,
  productNeedsModal,
  selectedOrderTable,
  selectedToppingsFromQtyMap,
  toggleToppingQty,
  type MenuBySort,
  type ProductCardEntry,
  type ProductModalMode,
  type SelectedTopping,
} from "./order-customer-utils";
import {
  cartForTable,
  cartQuantityCount,
  optionalString,
} from "../table-selection/utils";

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
  const branchUuid = user?.branch_uuid ?? "";
  const language = useAppStore((state) => state.language);
  const showToast = useToastStore((state) => state.show);
  const zones = usePosStore((state) => state.zones);
  const cart = usePosStore((state) => state.cart);
  const loadingTables = usePosStore((state) => state.loading);
  const loadingCart = usePosStore((state) => state.loadingCart);
  const saving = usePosStore((state) => state.saving);
  const loadTables = usePosStore((state) => state.loadTables);
  const loadCartStore = usePosStore((state) => state.loadCart);
  const loadProductCategories = usePosStore((state) => state.loadProductCategories);
  const loadProductItem = usePosStore((state) => state.loadProductItem);
  const createOrder = usePosStore((state) => state.createOrder);
  const setTable = usePosStore((state) => state.setTable);
  const resolvePrinterDeviceContext = usePrinterStore(
    (state) => state.resolveDeviceContext,
  );
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
  const [newOrderFocusKey, setNewOrderFocusKey] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<ProdItem | null>(null);
  const [detailUuid, setDetailUuid] = useState("");
  const [toppingQtyByUuid, setToppingQtyByUuid] = useState<
    Record<string, number>
  >({});
  const [rememberedToppingQtyByUuid, setRememberedToppingQtyByUuid] = useState<
    Record<string, number>
  >({});
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);
  const [printerContext, setPrinterContext] =
    useState<PrinterDeviceContext | null>(null);

  const selectedTable = useMemo(
    () =>
      selectedOrderTable({
        tableName: initialTableName,
        tableUuid: initialTableUuid,
        zones,
      }),
    [initialTableName, initialTableUuid, zones],
  );

  const selectedCart = useMemo(
    () => cartForTable(cart, initialTableUuid),
    [cart, initialTableUuid],
  );
  const activeProducts = useMemo(
    () => flattenProducts(menuBySort[activeSort]),
    [activeSort, menuBySort],
  );
  const cartCount = useMemo(
    () => cartQuantityCount(selectedCart),
    [selectedCart],
  );
  const productMode = useMemo(
    () => getProductModalMode(activeSort, selectedProduct),
    [activeSort, selectedProduct],
  );
  const selectedDetail = useMemo(() => {
    const matchingDetail = (selectedProduct?.details ?? []).find(
      (detail) => detail.pro_detail_uuid === detailUuid,
    );
    const matchingDetailIsValid =
      productMode === "set"
        ? isDetailEnabled(matchingDetail)
        : isDetailAvailable(matchingDetail);
    if (matchingDetail && matchingDetailIsValid) return matchingDetail;
    return firstAvailableDetail(selectedProduct, productMode);
  }, [detailUuid, productMode, selectedProduct]);
  const selectedToppings = useMemo(
    () => selectedToppingsFromQtyMap(selectedProduct, toppingQtyByUuid),
    [selectedProduct, toppingQtyByUuid],
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
      if (!branchUuid) return emptyMenuBySort();

      const selectedCateUuid = optionalString(cateUuid) ?? "";
      const searchQuery = query.trim();
      if (!selectedCateUuid && !searchQuery) return emptyMenuBySort();

      const request = (status_sort_fk: ProductSortStatus) =>
        loadProductCategories({
          branch_uuid_fk: branchUuid,
          ...(searchQuery ? {} : { cate_uuid: selectedCateUuid }),
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
    [branchUuid, language, loadProductCategories],
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
    if (!branchUuid) return [];

    try {
      return await loadTables({
        branch_uuid_fk: branchUuid,
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
  }, [branchUuid, language, loadTables, showToast, t]);

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
      if (!branchUuid) {
        setCategories([]);
        setMenuBySort(emptyMenuBySort());
        return;
      }

      setLoadingMenu(true);
      try {
        let nextCateUuid = optionalString(cateUuid) ?? "";
        const nextQuery = query ?? "";

        if (refreshCategories) {
          const catalog = await loadProductCategories({
            branch_uuid_fk: branchUuid,
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
    [
      fetchMenuGroups,
      branchUuid,
      language,
      loadProductCategories,
      showToast,
      t,
    ],
  );

  const submitProductOrder = useCallback(
    async ({
      detail,
      mode,
      noteText,
      product,
      quantity,
      toppings,
    }: {
      detail: ProdDetail;
      mode?: ProductModalMode;
      noteText: string;
      product?: ProdItem | null;
      quantity: number;
      toppings: SelectedTopping[];
    }) => {
      await createOrder(
        buildStaffOrderInput({
          branchUuid: user?.branch_uuid ?? "",
          detail,
          lang: language,
          mode,
          noteText,
          product,
          quantity,
          tableUuid: initialTableUuid,
          toppings,
          userUuid: user?.uuid ?? "",
        }),
      );
      await loadCartStore({ table_uuid: initialTableUuid, lang: language });
      setNewOrderFocusKey((key) => key + 1);
      showToast({ title: t("pos.orderCreated"), tone: "success" });
    },
    [
      createOrder,
      initialTableUuid,
      language,
      loadCartStore,
      showToast,
      t,
      user?.branch_uuid,
      user?.uuid,
    ],
  );

  const openProductOptions = useCallback(
    (product: ProdItem) => {
      const mode = getProductModalMode(activeSort, product);
      const detail = firstAvailableDetail(product, mode);
      if (!detail) return;

      setSelectedProduct(product);
      setDetailUuid(detail.pro_detail_uuid);
      setQty(orderQuantityRules(detail, mode, product).min);
      setToppingQtyByUuid({});
      setRememberedToppingQtyByUuid({});
      setNote("");
      setProductSheetOpen(true);
    },
    [activeSort],
  );

  const openOrAddProduct = useCallback(
    async (entry: ProductCardEntry) => {
      const blockedState = getProductBlockedState(entry.product, activeSort);
      if (blockedState) return;

      setLoadingProductUuid(entry.product.prod_uuid);
      try {
        const item = await loadProductItem({
          lang: language,
          prod_uuid: entry.product.prod_uuid,
        });
        const productItem = normalizeProdItem(item, entry.product);
        const mode = getProductModalMode(activeSort, productItem);
        const detail = firstAvailableDetail(productItem, mode);

        if (!detail) {
          showToast({
            title: t("pos.noAvailableOptions"),
            description: t("pos.checkProductAvailability"),
            tone: "error",
          });
          return;
        }

        if (productNeedsModal(entry.product, productItem, activeSort)) {
          openProductOptions(productItem);
          return;
        }

        const quantity = orderQuantityRules(detail, mode, productItem).min;
        const selectionIssue = getOrderSelectionIssue({
          detail,
          mode,
          product: productItem,
          quantity,
          toppings: [],
        });
        if (selectionIssue) {
          showToast({
            title: orderSelectionIssueLabel(selectionIssue, t),
            description:
              selectionIssue === "detail-unavailable" ||
              selectionIssue === "stock-insufficient"
                ? t("pos.checkProductAvailability")
                : "",
            tone: "error",
          });
          return;
        }

        await submitProductOrder({
          detail,
          mode,
          noteText: "",
          product: productItem,
          quantity,
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
    },
    [
      activeSort,
      language,
      loadProductItem,
      openProductOptions,
      showToast,
      submitProductOrder,
      t,
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

  useEffect(() => {
    if (!user?.uuid) {
      setPrinterContext(null);
      return;
    }

    let cancelled = false;
    void resolvePrinterDeviceContext({
      login_uuid_fk: user.uuid,
      lang: language,
    })
      .then((context) => {
        if (!cancelled) setPrinterContext(context);
      })
      .catch(() => {
        if (!cancelled) setPrinterContext(null);
      });

    return () => {
      cancelled = true;
    };
  }, [language, resolvePrinterDeviceContext, user?.uuid]);

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

  async function openCartSheet() {
    setCartSheetOpen(true);
    await loadCart();
  }

  async function selectCategory(cateUuid: string) {
    setSearch("");
    await loadMenu({ cateUuid, query: "" });
  }

  async function submitSearch() {
    await loadMenu({ cateUuid: selectedCateUuid, query: search.trim() });
  }

  function changeProductDetail(nextDetail: ProdDetail) {
    if (!isDetailAvailable(nextDetail)) return;

    setDetailUuid(nextDetail.pro_detail_uuid);
    if (productMode === "promotion") {
      setQty(
        orderQuantityRules(nextDetail, productMode, selectedProduct).min,
      );
    }
  }

  function toggleSelectedTopping(uuid: string) {
    const selectedQty = toppingQtyByUuid[uuid];
    if (selectedQty) {
      setRememberedToppingQtyByUuid((remembered) => ({
        ...remembered,
        [uuid]: selectedQty,
      }));
    }
    setToppingQtyByUuid((current) =>
      toggleToppingQty(
        current,
        uuid,
        rememberedToppingQtyByUuid[uuid] ?? 1,
      ),
    );
  }

  function changeSelectedToppingQty(uuid: string, nextQty: number) {
    setToppingQtyByUuid((current) => changeToppingQty(current, uuid, nextQty));
  }

  async function submitSelectedProduct() {
    if (!selectedProduct || saving) return;

    const detail = selectedDetail;
    if (!detail) return;

    const selectionIssue = getOrderSelectionIssue({
      detail,
      mode: productMode,
      product: selectedProduct,
      quantity: qty,
      toppings: selectedToppings,
    });
    if (selectionIssue) {
      showToast({
        title: orderSelectionIssueLabel(selectionIssue, t),
        description:
          selectionIssue === "detail-unavailable" ||
          selectionIssue === "stock-insufficient"
            ? t("pos.checkProductAvailability")
            : "",
        tone: "error",
      });
      return;
    }

    try {
      await submitProductOrder({
        detail,
        mode: productMode,
        noteText: note,
        product: selectedProduct,
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
    cart: selectedCart,
    cartCount,
    cartSheetOpen,
    categories,
    changeProductDetail,
    changeSelectedToppingQty,
    handleTableActionComplete,
    isMobile,
    loadCart,
    loadingCart,
    loadingMenu,
    loadingProductUuid,
    loadingTables,
    menuBySort,
    modalUnitPrice,
    newOrderFocusKey,
    note,
    openOrAddProduct,
    openCartSheet,
    openTablesPage,
    productMode,
    productSheetOpen,
    printerContext,
    qty,
    refreshAll,
    saving,
    search,
    selectCategory,
    selectedCateUuid,
    selectedDetail,
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
    toppingQtyByUuid,
    zones,
  };
}

export type OrderCustomerWorkflow = ReturnType<typeof useOrderCustomerWorkflow>;
