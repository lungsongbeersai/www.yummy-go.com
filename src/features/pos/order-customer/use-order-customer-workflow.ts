"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/use-mobile";
import { useResetOnDeps } from "@/hooks/use-reset-on-change";
import { OrderChannelEnum, OrderSourceEnum } from "@/config/pos-constants";
import {
  isCapacitorAndroidApp,
  isCapacitorMobileApp,
} from "@/lib/capacitor-platform";
import { ServiceError } from "@/lib/api";
import { classifyBackendError } from "@/lib/network-state";
import { internalRoute } from "@/lib/routes";
import { optionalString } from "@/lib/values";
import type { ProdDetail, ProdItem, ProdTaste } from "@/services/pos";
import type { PrinterDeviceContext } from "@/services/printer";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useNavigationGuardStore } from "@/stores/navigation-guard-store";
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
  isToppingAvailable,
  isTasteAvailable,
  normalizeProdItem,
  orderCustomerUrl,
  orderQuantityRules,
  orderSelectionIssueLabel,
  productNeedsModal,
  selectedOrderTable,
  selectedToppingsFromQtyMap,
  selectedTastesFromUuids,
  tableSelectionUrl,
  tableZoneUuid,
  tasteSelectionLimit,
  toggleSetChildOptionGroupUuid,
  toggleSetChoiceUuid,
  toggleTasteUuid,
  toggleToppingQty,
  toppingSelectionLimit,
  type ProductCardEntry,
  type ProductModalMode,
  type SelectedTopping,
} from "./order-customer-utils";
import { cartForTable, cartQuantityCount } from "../table-selection/utils";
import { useDraftCleanup } from "./use-draft-cleanup";
import { useOrderCustomerRealtime } from "./use-order-customer-realtime";

export type OrderCustomerWorkflowInput = {
  initialTableUuid: string;
  initialTableName: string;
  initialZoneUuid: string;
};

export function useOrderCustomerWorkflow({
  initialTableUuid,
  initialTableName,
  initialZoneUuid,
}: OrderCustomerWorkflowInput) {
  const { t } = useTranslation();
  const router = useRouter();
  const isMobile = useIsMobile();
  const user = useAuthStore((state) => state.user);
  const branchUuid = user?.branch_uuid ?? "";
  const isNoTableStore = user?.store_table_status === 2;
  const language = useAppStore((state) => state.language);
  const showToast = useToastStore((state) => state.show);
  const setNavigationGuard = useNavigationGuardStore((state) => state.setGuard);
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
  const refreshTablesStore = usePosStore((state) => state.refreshTables);
  const loadCartStore = usePosStore((state) => state.loadCart);
  const loadMenuStore = usePosStore((state) => state.loadMenu);
  const resetMenu = usePosStore((state) => state.resetMenu);
  const loadProductItem = usePosStore((state) => state.loadProductItem);
  const prefetchProductItem = usePosStore((state) => state.prefetchProductItem);
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
  const [draftExitWarningOpen, setDraftExitWarningOpen] = useState(false);
  const [draftExitCleanupPending, setDraftExitCleanupPending] = useState(false);
  const backgroundCartRefreshRef = useRef<Promise<void> | null>(null);
  const pendingExitActionRef = useRef<(() => void) | null>(null);
  const allowNextUnloadRef = useRef(false);
  const requestGuardedNavigationRef = useRef<(action: () => void) => void>(
    (action) => action(),
  );
  const [newOrderFocusKey, setNewOrderFocusKey] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<ProdItem | null>(null);
  const [detailUuid, setDetailUuid] = useState("");
  const [selectedTasteUuids, setSelectedTasteUuids] = useState<string[]>([]);
  const [selectedSetChoiceUuids, setSelectedSetChoiceUuids] = useState<
    Record<string, string[]>
  >({});
  const [selectedSetChildOptionGroupUuids, setSelectedSetChildOptionGroupUuids] = useState<
    Record<string, string[]>
  >({});
  const [selectedSetChoiceTasteUuids, setSelectedSetChoiceTasteUuids] = useState<
    Record<string, string[]>
  >({});
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

  const selectedTableZoneUuid = useMemo(
    () =>
      tableZoneUuid(zones, initialTableUuid) ||
      initialZoneUuid ||
      user?.zone_uuid ||
      "",
    [initialTableUuid, initialZoneUuid, user?.zone_uuid, zones],
  );

  const selectedCart = useMemo(() => {
    // fetch_cart ของออเดอร์เคาน์เตอร์ query ด้วย order_uuid + branch_uuid_fk
    // อยู่แล้ว (ขอบเขตแคบพอ) จึงไม่ต้อง filter ด้วย cartForTable ซ้ำแบบโต๊ะ
    if (!initialTableUuid) return cart;
    return cartForTable(cart, initialTableUuid);
  }, [cart, initialTableUuid]);
  const draftCleanup = useDraftCleanup({
    cart: selectedCart,
    userUuid: user?.uuid ?? "",
  });
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
  const selectedTastes = useMemo(
    () => selectedTastesFromUuids(selectedProduct, selectedTasteUuids),
    [selectedProduct, selectedTasteUuids],
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

  const loadCart = useCallback(async (options?: { background?: boolean }) => {
    if (!initialTableUuid && !counterOrderUuid) return;

    try {
      if (initialTableUuid) {
        await loadCartStore({ table_uuid: initialTableUuid, lang: language }, options);
      } else if (branchUuid) {
        await loadCartStore({
          branch_uuid_fk: branchUuid,
          order_uuid: counterOrderUuid,
          lang: language,
        }, options);
      }
    } catch (error) {
      // A foreground transport failure leaves the cashier on a half-loaded
      // online-only screen, so show an actionable connection message instead
      // of Axios's raw "Network Error". Background refreshes remain silent.
      const isForegroundLoad = !options?.background;
      if (
        isForegroundLoad &&
        isCapacitorAndroidApp() &&
        classifyBackendError(error instanceof ServiceError ? error.originalError : error)
          .classification === "NETWORK_TRANSPORT"
      ) {
        showToast({ title: t("pos.tableOpenNeedsConnection"), tone: "info" });
        router.replace("/posAll/tables");
        return;
      }
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
    router,
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
      background = false,
    }: {
      cateUuid?: string;
      query?: string;
      refreshCategories?: boolean;
      background?: boolean;
    } = {}) => {
      try {
        await loadMenuStore({
          branchUuid,
          language,
          cateUuid,
          query,
          refreshCategories,
          background,
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
      selectedSetChildOptionGroupUuids: setChildOptionGroupUuids,
      selectedSetChoiceUuids: setChoiceUuids,
      selectedSetChoiceTasteUuids: setChoiceTasteUuids,
      tastes,
      toppings,
    }: {
      detail: ProdDetail;
      mode?: ProductModalMode;
      noteText: string;
      product?: ProdItem | null;
      quantity: number;
      selectedSetChildOptionGroupUuids?: Record<string, string[]>;
      selectedSetChoiceUuids?: Record<string, string[]>;
      selectedSetChoiceTasteUuids?: Record<string, string[]>;
      tastes: ProdTaste[];
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
          selectedSetChildOptionGroupUuids: setChildOptionGroupUuids,
          selectedSetChoiceUuids: setChoiceUuids,
          selectedSetChoiceTasteUuids: setChoiceTasteUuids,
          tableUuid: initialTableUuid,
          tastes,
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
      setSelectedTasteUuids([]);
      setToppingQtyByUuid({});
      setRememberedToppingQtyByUuid({});
      setSelectedSetChoiceUuids({});
      setSelectedSetChildOptionGroupUuids({});
      setSelectedSetChoiceTasteUuids({});
      setNote("");
      setProductSheetOpen(true);
    },
    [activeSort],
  );

  const prefetchProduct = useCallback(
    async (entry: ProductCardEntry) => {
      if (getProductBlockedState(entry.product, activeSort)) return;
      try {
        await prefetchProductItem({
          lang: language,
          prodUuid: entry.product.prodUuid,
        });
      } catch {
        // Prefetch is best-effort; the actual click owns user-visible errors.
      }
    },
    [activeSort, language, prefetchProductItem],
  );

  const openOrAddProduct = useCallback(
    async (entry: ProductCardEntry) => {
      const blockedState = getProductBlockedState(entry.product, activeSort);
      if (blockedState) return;

      setLoadingProductUuid(entry.product.prodUuid);
      try {
        let item: ProdItem | null = null;
        try {
          item = await loadProductItem({
            lang: language,
            prodUuid: entry.product.prodUuid,
          });
        } catch (error) {
          if (classifyBackendError(error).classification !== "NETWORK_TRANSPORT") {
            throw error;
          }
          // Product option details are server-owned in online-only mode. Explain
          // the connection requirement instead of surfacing a generic error.
          showToast({
            title: t("pos.productOptionsNeedConnection"),
            tone: "error",
          });
          return;
        }
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
          tastes: [],
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
          tastes: [],
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
      router.replace("/posAll/tables");
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
  }, [loadTablesForBranch]);

  useEffect(() => {
    void loadCart();
  }, [loadCart]);

  // Socket และ lifecycle อาจแจ้งพร้อมกันหลังแอปกลับ foreground จึงรวม background
  // refresh ที่คาบเกี่ยวกันให้ใช้ request เดียว ส่วน foreground refresh หลัง mutation
  // ยังคงยิงใหม่เสมอเพื่อไม่ให้ใช้ response เก่าก่อนเพิ่ม/แก้รายการอาหาร
  const refreshCartInBackground = useCallback(() => {
    const activeRequest = backgroundCartRefreshRef.current;
    if (activeRequest) return activeRequest;

    const request = loadCart({ background: true }).finally(() => {
      if (backgroundCartRefreshRef.current === request) {
        backgroundCartRefreshRef.current = null;
      }
    });
    backgroundCartRefreshRef.current = request;
    return request;
  }, [loadCart]);

  // Web ใช้ visibilitychange; Capacitor ใช้ native appStateChange ซึ่ง map ไปยัง
  // lifecycle ของ iOS/Android โดยตรง เมื่อกลับ foreground ให้โหลด cart จาก server
  // ใหม่จาก Backend เท่านั้น ตอน background ห้ามลบ เพราะ OS อาจหยุด process ก่อน
  // request จบได้ทุกเมื่อ และ Backend เป็น source of truth ของ cleanup 5 นาที
  useEffect(() => {
    let inactive = false;
    let disposed = false;

    const resume = () => {
      if (!inactive || disposed) return;
      inactive = false;
      void refreshCartInBackground();
    };

    if (isCapacitorMobileApp()) {
      const listener = import("@capacitor/app")
        .then(({ App }) =>
          App.addListener("appStateChange", ({ isActive }) => {
            if (!isActive) {
              inactive = true;
              return;
            }
            resume();
          }),
        )
        .catch(() => null);

      return () => {
        disposed = true;
        void listener.then((handle) => handle?.remove()).catch(() => undefined);
      };
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        inactive = true;
        return;
      }
      resume();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshCartInBackground]);

  useOrderCustomerRealtime({ branchUuid, refresh: refreshCartInBackground });

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

  function navigateAwayFromOrder() {
    // ร้านไม่มีโต๊ะไม่มีหน้าเลือกโต๊ะให้กลับไป — ปุ่ม "ย้อนกลับ" จึงออกไปหน้าแรกแทน
    router.replace(
      user?.store_table_status === 2
        ? "/"
        : tableSelectionUrl(selectedTableZoneUuid),
    );
  }

  function requestGuardedNavigation(action: () => void) {
    if (draftCleanup.backDecision === "prompt") {
      pendingExitActionRef.current = action;
      setDraftExitWarningOpen(true);
      return;
    }

    // cart อาจยังแสดง status 1 ชั่วคราวระหว่างกำลังยืนยัน/พิมพ์ครัว จึงห้าม
    // navigation/cleanup แทรกระหว่างงานครัว
    if (draftCleanup.backDecision === "wait") return;

    action();
  }

  function openTablesPage() {
    requestGuardedNavigation(navigateAwayFromOrder);
  }

  async function discardDraftAndLeaveTable() {
    if (draftExitCleanupPending) return;

    setDraftExitCleanupPending(true);
    try {
      const cleanupCompleted = await draftCleanup.cleanupNow();
      if (!cleanupCompleted) return;
      setDraftExitWarningOpen(false);
      const exitAction = pendingExitActionRef.current ?? navigateAwayFromOrder;
      pendingExitActionRef.current = null;
      exitAction();
    } catch (error) {
      showToast({
        title: t("pos.draftCleanupFailed"),
        description: error instanceof Error ? error.message : "",
        tone: "error",
      });
    } finally {
      setDraftExitCleanupPending(false);
    }
  }

  function continueOrdering() {
    setDraftExitWarningOpen(false);
    pendingExitActionRef.current = null;
  }

  useEffect(() => {
    requestGuardedNavigationRef.current = requestGuardedNavigation;
  });

  // programmatic navigation จาก shell (notification/logout/native fallback)
  // ส่งผ่าน guard เดียวกับปุ่ม Back ของหน้ารับออเดอร์
  useEffect(() => {
    const guard = (action: () => void) => {
      requestGuardedNavigationRef.current(action);
    };
    setNavigationGuard(guard);
    return () => setNavigationGuard(null);
  }, [setNavigationGuard]);

  // Link ของ sidebar/bottom nav เป็น navigation ที่เกิดนอก component tree ของหน้านี้
  // ดักเฉพาะตอนมี draft (หรือกำลัง confirm) แล้วส่ง action เดิมไปทำต่อหลังผู้ใช้ตัดสินใจ
  useEffect(() => {
    if (draftCleanup.backDecision === "leave") return;

    const interceptLink = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);
      if (
        destination.origin === current.origin &&
        destination.pathname === current.pathname &&
        destination.search === current.search
      ) {
        return;
      }
      if (!["http:", "https:"].includes(destination.protocol)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      requestGuardedNavigationRef.current(() => {
        if (destination.origin === current.origin) {
          router.push(internalRoute(
            `${destination.pathname}${destination.search}${destination.hash}`,
          ));
          return;
        }
        allowNextUnloadRef.current = true;
        window.location.assign(destination.href);
      });
    };

    document.addEventListener("click", interceptLink, true);
    return () => document.removeEventListener("click", interceptLink, true);
  }, [draftCleanup.backDecision, router]);

  // Web browser อาจปิด tab/refresh/พิมพ์ URL ใหม่โดยไม่ผ่าน navigation ของ React
  // แสดง native warning เท่านั้นและไม่ยิง cleanup; beforeunload ไม่รับประกันบน mobile
  // Backend cleanup 5 นาทีเป็นกลไกหลักสำหรับกรณีปิดหน้าต่างแบบควบคุมไม่ได้
  useEffect(() => {
    if (draftCleanup.backDecision !== "prompt") return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowNextUnloadRef.current) {
        allowNextUnloadRef.current = false;
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [draftCleanup.backDecision]);

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
    // ยังไม่ได้เลือกอยู่ตอนนี้ + ครบเพดานจำนวนชนิดแล้ว = ห้ามเลือกเพิ่ม แจ้งเตือนแทนที่จะเงียบๆ
    // (checkbox ฝั่ง UI จงใจไม่ใช้ disabled ของจริง เพื่อให้คลิกทะลุมาถึงจุดนี้ได้เสมอ)
    if (!selectedQty) {
      const availableToppingCount = (selectedProduct?.toppings ?? []).filter(
        isToppingAvailable,
      ).length;
      const limit = toppingSelectionLimit(
        availableToppingCount,
        selectedProduct?.prodToppingMaxSelect,
      );
      if (selectedToppings.length >= limit) {
        showToast({
          title: t("pos.toppingSelectionLimitReached", { count: limit }),
          tone: "info",
        });
        return;
      }
    }

    if (selectedQty) {
      setRememberedToppingQtyByUuid((remembered) => ({
        ...remembered,
        [uuid]: selectedQty,
      }));
    }
    setToppingQtyByUuid((current) =>
      toggleToppingQty(current, uuid, rememberedToppingQtyByUuid[uuid] ?? 1),
    );
  }

  function toggleSelectedTaste(uuid: string) {
    if (!(selectedProduct?.tastes ?? []).some(
      (taste) => taste.tasteUuid === uuid && isTasteAvailable(taste),
    )) return;
    const limit = tasteSelectionLimit(selectedProduct);
    if (!selectedTasteUuids.includes(uuid) && selectedTasteUuids.length >= limit) {
      showToast({
        title: t("pos.tasteSelectionLimitReached", { count: limit }),
        tone: "info",
      });
      return;
    }
    setSelectedTasteUuids((current) => toggleTasteUuid(current, uuid, limit));
  }

  function toggleSetChoice(groupUuid: string, detailUuid: string, maxSelect: number) {
    const current = selectedSetChoiceUuids[groupUuid] ?? [];
    if (!current.includes(detailUuid) && current.length >= maxSelect) {
      showToast({
        title: t("pos.setChoiceSelectionLimitReached", { count: maxSelect }),
        tone: "info",
      });
      return;
    }
    const next = toggleSetChoiceUuid(current, detailUuid, maxSelect);
    setSelectedSetChoiceUuids((state) => ({ ...state, [groupUuid]: next }));
    if (!next.includes(detailUuid)) {
      setSelectedSetChildOptionGroupUuids((state) =>
        Object.fromEntries(
          Object.entries(state).filter(([key]) => key !== detailUuid),
        ),
      );
      setSelectedSetChoiceTasteUuids((state) => {
        return Object.fromEntries(
          Object.entries(state).filter(([key]) => !key.startsWith(`${detailUuid}:`)),
        );
      });
    }
  }

  function toggleSetChildOption(
    detailUuid: string,
    optionGroupUuid: string,
    maxSelect: number,
  ) {
    const detail = selectedProduct?.details.find(
      (candidate) => candidate.proDetailUuid === detailUuid,
    );
    if (!detail?.setOptionGroups?.some(
      (group) => group.setDetailOptionGroupUuid === optionGroupUuid,
    )) return;

    const current = selectedSetChildOptionGroupUuids[detailUuid] ?? [];
    if (!current.includes(optionGroupUuid) && current.length >= maxSelect) {
      showToast({
        title: t("pos.setChoiceSelectionLimitReached", { count: maxSelect }),
        tone: "info",
      });
      return;
    }
    const next = toggleSetChildOptionGroupUuid(current, optionGroupUuid, maxSelect);
    setSelectedSetChildOptionGroupUuids((state) => ({
      ...state,
      [detailUuid]: next,
    }));
    if (!next.includes(optionGroupUuid)) {
      const selectionKey = `${detailUuid}:${optionGroupUuid}`;
      setSelectedSetChoiceTasteUuids((state) =>
        Object.fromEntries(
          Object.entries(state).filter(([key]) => key !== selectionKey),
        ),
      );
    }
  }

  function toggleSetChoiceTaste(
    detailUuid: string,
    optionGroupUuid: string,
    tasteUuid: string,
    maxSelect: number,
  ) {
    const detail = selectedProduct?.details.find(
      (candidate) => candidate.proDetailUuid === detailUuid,
    );
    const optionGroup = detail?.setOptionGroups?.find(
      (candidate) => candidate.setDetailOptionGroupUuid === optionGroupUuid,
    );
    const allowedTastes = optionGroup?.tastes ?? (
      optionGroupUuid === `legacy:${detailUuid}` ? detail?.setTastes : []
    ) ?? [];
    if (!allowedTastes.some(
      (taste) => taste.tasteUuid === tasteUuid && isTasteAvailable(taste),
    )) return;

    const selectionKey = `${detailUuid}:${optionGroupUuid}`;
    const current = selectedSetChoiceTasteUuids[selectionKey] ?? [];
    if (!current.includes(tasteUuid) && current.length >= maxSelect) {
      showToast({
        title: t("pos.tasteSelectionLimitReached", { count: maxSelect }),
        tone: "info",
      });
      return;
    }
    setSelectedSetChoiceTasteUuids((state) => ({
      ...state,
      [selectionKey]: toggleTasteUuid(current, tasteUuid, maxSelect),
    }));
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
      selectedSetChildOptionGroupUuids,
      selectedSetChoiceTasteUuids,
      selectedSetChoiceUuids,
      tastes: selectedTastes,
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
        selectedSetChildOptionGroupUuids,
        selectedSetChoiceUuids,
        selectedSetChoiceTasteUuids,
        tastes: selectedTastes,
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
          zoneUuid: tableZoneUuid(nextZones, nextTableUuid),
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

  async function handlePaymentComplete() {
    if (isNoTableStore) {
      await handleTableActionComplete();
      return;
    }

    setCartSheetOpen(false);
    router.replace(tableSelectionUrl(selectedTableZoneUuid));
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
    handlePaymentComplete,
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
    prefetchProduct,
    openCartSheet,
    openTablesPage,
    draftExitCleanupPending,
    draftExitWarningOpen,
    onDraftExitContinue: continueOrdering,
    onDraftExitLeaveTable: () => void discardDraftAndLeaveTable(),
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
    selectedTastes,
    selectedTasteUuids,
    selectedSetChildOptionGroupUuids,
    selectedSetChoiceUuids,
    selectedSetChoiceTasteUuids,
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
    toggleSelectedTaste,
    toggleSetChildOption,
    toggleSetChoice,
    toggleSetChoiceTaste,
    toppingQtyByUuid,
    zones,
  };
}

export type OrderCustomerWorkflow = ReturnType<typeof useOrderCustomerWorkflow>;
