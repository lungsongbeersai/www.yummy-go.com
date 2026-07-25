"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import type { ProdDetail, ProdItem } from "@/services/pos";
import type { PrinterDeviceContext } from "@/services/printer";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import { flattenProducts, orderCustomerUrl, selectedOrderTable, type ProductCardEntry, type ProductModalMode } from "@/features/pos/order-customer/menu-structure";
import { getOrderSelectionIssue, orderSelectionIssueLabel } from "@/features/pos/order-customer/order-selection-validation";
import { getModalUnitPrice } from "@/features/pos/order-customer/pricing";
import { firstAvailableDetail, isDetailAvailable, isDetailEnabled, normalizeProdItem } from "@/features/pos/order-customer/product-availability";
import { getProductBlockedState, getProductModalMode, productNeedsModal } from "@/features/pos/order-customer/product-classification";
import { orderQuantityRules } from "@/features/pos/order-customer/quantity-rules";
import { buildStaffOrderInput } from "@/features/pos/order-customer/staff-order-payload";
import { changeToppingQty, selectedToppingsFromQtyMap, toggleToppingQty, type SelectedTopping } from "@/features/pos/order-customer/topping-selection";
import { cartForTable, cartQuantityCount } from "@/features/pos/table-selection/cart-readers";

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
  const categories = usePosStore((state) => state.categories);
  const selectedCateUuid = usePosStore((state) => state.selectedCateUuid);
  const activeSort = usePosStore((state) => state.activeSort);
  const menuBySort = usePosStore((state) => state.menuBySort);
  const loadingMenu = usePosStore((state) => state.loadingMenu);
  const submittedSearch = usePosStore((state) => state.submittedSearch);
  const loadTables = usePosStore((state) => state.loadTables);
  const loadCartStore = usePosStore((state) => state.loadCart);
  const loadMenuStore = usePosStore((state) => state.loadMenu);
  const resetMenu = usePosStore((state) => state.resetMenu);
  const loadProductItem = usePosStore((state) => state.loadProductItem);
  const createOrder = usePosStore((state) => state.createOrder);
  const setTable = usePosStore((state) => state.setTable);
  const setActiveSort = usePosStore((state) => state.setActiveSort);
  const resolvePrinterDeviceContext = usePrinterStore(
    (state) => state.resolveDeviceContext,
  );
  const [search, setSearch] = useState("");
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
  const [fetchedPrinterContext, setFetchedPrinterContext] =
    useState<PrinterDeviceContext | null>(null);
  const printerContext = user?.uuid ? fetchedPrinterContext : null;

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
      (detail) => detail.proDetailUuid === detailUuid,
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
      try {
        await loadMenuStore({
          branchUuid,
          language,
          cateUuid,
          query,
          refreshCategories,
        });
      } catch (error) {
        showToast({
          title: t("pos.failedProducts"),
          description: error instanceof Error ? error.message : "",
          tone: "error",
        });
      }
    },
    [
      branchUuid,
      language,
      loadMenuStore,
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
      setDetailUuid(detail.proDetailUuid);
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

      setLoadingProductUuid(entry.product.prodUuid);
      try {
        const item = await loadProductItem({
          lang: language,
          prodUuid: entry.product.prodUuid,
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
  }, [initialTableName, initialTableUuid, setTable]);

  useResetOnDeps([initialTableName, initialTableUuid], () => {
    setCartSheetOpen(false);
  });

  useEffect(() => {
    resetMenu();
    return resetMenu;
  }, [resetMenu]);

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
    if (!user?.uuid) return;

    let cancelled = false;
    void resolvePrinterDeviceContext({
      login_uuid_fk: user.uuid,
      lang: language,
    })
      .then((context) => {
        if (!cancelled) setFetchedPrinterContext(context);
      })
      .catch(() => {
        if (!cancelled) setFetchedPrinterContext(null);
      });

    return () => {
      cancelled = true;
    };
  }, [language, resolvePrinterDeviceContext, user?.uuid]);

  function openTablesPage() {
    router.replace("/pos/tables");
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

    setDetailUuid(nextDetail.proDetailUuid);
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
