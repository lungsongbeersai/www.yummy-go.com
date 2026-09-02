"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOfflineRefetchEpoch } from "@/hooks/use-offline-refetch";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import { OrderChannelEnum, OrderSourceEnum } from "@/config/pos-constants";
import { optionalString } from "@/lib/values";
import type { ProdDetail, ProdItem } from "@/services/pos";
import type { PrinterDeviceContext } from "@/services/printer";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import {
  buildStaffOrderInput,
  changeToppingQty,
  counterOrderTable,
  firstAvailableDetail,
  flattenProducts,
  getModalUnitPrice,
  getOrderSelectionIssue,
  getProductBlockedState,
  getProductModalMode,
  isDetailAvailable,
  isDetailEnabled,
  normalizeProdItem,
  orderCustomerUrl,
  orderQuantityRules,
  orderSelectionIssueLabel,
  productNeedsModal,
  selectedOrderTable,
  selectedToppingsFromQtyMap,
  toggleToppingQty,
  type ProductCardEntry,
  type ProductModalMode,
  type SelectedTopping,
} from "./order-customer-utils";
import { cartForTable, cartQuantityCount } from "../table-selection/utils";
import { useOrderCustomerRealtime } from "./use-order-customer-realtime";

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
  // Reload once when the backend transport verdict flips (net dropped or came
  // back) so cart/menu/tables swap between Local Agent and backend data on their
  // own.
  const refetchEpoch = useOfflineRefetchEpoch();
  const user = useAuthStore((state) => state.user);
  const branchUuid = user?.branch_uuid ?? "";
  const isNoTableStore = user?.store_table_status === 2;
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
  const initOrderWithoutTable = usePosStore((state) => state.initOrderWithoutTable);
  const setTable = usePosStore((state) => state.setTable);
  const setActiveSort = usePosStore((state) => state.setActiveSort);
  // ร้านไม่มีโต๊ะ (store_table_status === 2): ไม่มี table_uuid ให้ยึด จึงใช้
  // order_uuid ของบิลที่เปิดอยู่แทนสำหรับ fetch_cart/refresh ต่อ ๆ ไป — ได้มาจาก
  // init_order_without_table (เรียกตอนเข้าหน้านี้ ดู effect ด้านล่าง) ซึ่ง backend
  // ผูกไว้กับ login token เอง ไม่ต้อง persist ฝั่ง client
  const counterOrderUuid = usePosStore((state) => state.counterOrderUuid);
  const setCounterOrderUuid = usePosStore((state) => state.setCounterOrderUuid);
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

  const selectedTable = useMemo(() => {
    if (initialTableUuid) {
      return selectedOrderTable({
        tableName: initialTableName,
        tableUuid: initialTableUuid,
        zones,
      });
    }
    if (counterOrderUuid) {
      return counterOrderTable(counterOrderUuid, t("pos.counterOrderLabel"));
    }
    return null;
  }, [counterOrderUuid, initialTableName, initialTableUuid, t, zones]);

  const selectedCart = useMemo(() => {
    // fetch_cart ของออเดอร์เคาน์เตอร์ query ด้วย order_uuid + branch_uuid_fk
    // อยู่แล้ว (ขอบเขตแคบพอ) จึงไม่ต้อง filter ด้วย cartForTable ซ้ำแบบโต๊ะ
    if (!initialTableUuid) return cart;
    return cartForTable(cart, initialTableUuid);
  }, [cart, initialTableUuid]);
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
    if (!initialTableUuid && !counterOrderUuid) return;

    try {
      if (initialTableUuid) {
        await loadCartStore({ table_uuid: initialTableUuid, lang: language });
      } else if (branchUuid) {
        await loadCartStore({
          branch_uuid_fk: branchUuid,
          order_uuid: counterOrderUuid,
          lang: language,
        });
      }
    } catch (error) {
      showToast({
        title: t("pos.orderFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    }
  }, [
    branchUuid,
    counterOrderUuid,
    initialTableUuid,
    language,
    loadCartStore,
    showToast,
    t,
  ]);

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
      const response = await createOrder(
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

      if (initialTableUuid) {
        await loadCartStore({ table_uuid: initialTableUuid, lang: language });
      } else {
        // ร้านไม่มีโต๊ะ: บิลแรกที่สร้างได้ order_uuid มาเป็นตัวยึด — เก็บลง
        // pos-store (persist ลง localStorage) เพื่อให้รีเฟรชหน้า/ปิดแท็บ/กลับมาใหม่
        // ยังตามบิลเดิมต่อได้ backend รวมรายการที่สั่งเพิ่มทีหลังเข้าบิลเดียวกันให้
        // เองโดยไม่ต้องส่ง order_uuid กลับไป
        const nextOrderUuid = optionalString(response.order_uuid) ?? counterOrderUuid;
        if (nextOrderUuid && nextOrderUuid !== counterOrderUuid) {
          setCounterOrderUuid(nextOrderUuid);
        }
        if (nextOrderUuid && branchUuid) {
          await loadCartStore({
            branch_uuid_fk: branchUuid,
            order_uuid: nextOrderUuid,
            lang: language,
          });
        }
      }
      setNewOrderFocusKey((key) => key + 1);
      showToast({ title: t("pos.orderCreated"), tone: "success" });
    },
    [
      branchUuid,
      counterOrderUuid,
      createOrder,
      initialTableUuid,
      language,
      loadCartStore,
      setCounterOrderUuid,
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

  // ร้านมีโต๊ะ (store_table_status !== 2) ต้องมี table_uuid เสมอ — เดิม guard นี้
  // เป็น server redirect ใน page.tsx แต่ store_table_status อ่านได้จาก client
  // เท่านั้น จึงย้ายมาเช็คที่นี่ ร้านไม่มีโต๊ะ (status 2) ปล่อยผ่านแม้ไม่มีโต๊ะ
  useEffect(() => {
    if (!initialTableUuid && user?.store_table_status !== 2) {
      router.replace("/pos/tables");
    }
  }, [initialTableUuid, router, user?.store_table_status]);

  // ร้านไม่มีโต๊ะ: เข้าหน้านี้ปุ๊บขอ order_uuid ของบิลที่เปิดค้างอยู่ (หรือสร้างใหม่)
  // จาก backend ทันที ไม่ต้องรอให้กดเพิ่มสินค้าก่อนถึงจะรู้ว่าเป็นบิลไหน — ทำให้
  // ตะกร้าโชว์รายการที่ค้างจ่ายจากรอบก่อนได้ตั้งแต่เปิดหน้า
  useEffect(() => {
    if (initialTableUuid || isNoTableStore !== true || !branchUuid || counterOrderUuid) return;

    let cancelled = false;
    void (async () => {
      try {
        await initOrderWithoutTable({
          branch_uuid_fk: branchUuid,
          order_source: OrderSourceEnum.POS,
          order_channel: OrderChannelEnum.DINE_IN,
        });
      } catch (error) {
        if (cancelled) return;
        showToast({
          title: t("pos.orderFailed"),
          description: error instanceof Error ? error.message : "",
          tone: "error",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    branchUuid,
    counterOrderUuid,
    initOrderWithoutTable,
    initialTableUuid,
    isNoTableStore,
    showToast,
    t,
  ]);

  useResetOnDeps([initialTableName, initialTableUuid], () => {
    setCartSheetOpen(false);
  });

  useEffect(() => {
    resetMenu();
    return resetMenu;
  }, [resetMenu]);

  useEffect(() => {
    void loadTablesForBranch();
  }, [loadTablesForBranch, refetchEpoch]);

  useEffect(() => {
    void loadCart();
  }, [loadCart, refetchEpoch]);

  useOrderCustomerRealtime({ branchUuid, refresh: loadCart });

  useEffect(() => {
    void loadMenu({ refreshCategories: true });
  }, [loadMenu, refetchEpoch]);

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
    // ร้านไม่มีโต๊ะไม่มีหน้าเลือกโต๊ะให้กลับไป — ปุ่ม "ย้อนกลับ" จึงออกไปหน้าแรกแทน
    router.replace(user?.store_table_status === 2 ? "/" : "/pos/tables");
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
        title: orderSelectionIssueLabel(
          selectionIssue,
          t,
          orderQuantityRules(detail, productMode, selectedProduct),
        ),
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

    if (targetUuid) {
      await loadCartStore({ table_uuid: targetUuid, lang: language });
      return;
    }

    if (counterOrderUuid && branchUuid) {
      await loadCartStore({
        branch_uuid_fk: branchUuid,
        order_uuid: counterOrderUuid,
        lang: language,
      });
    }
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
    showTableFeatures: !isNoTableStore,
    submitSearch,
    submitSelectedProduct,
    t,
    toggleSelectedTopping,
    toppingQtyByUuid,
    zones,
  };
}

export type OrderCustomerWorkflow = ReturnType<typeof useOrderCustomerWorkflow>;
