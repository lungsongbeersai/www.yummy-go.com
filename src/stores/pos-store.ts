"use client";

import { create } from "zustand";
import {
  getPrinters,
  resolvePrinterDeviceContext,
  type Printer,
  type PrinterDeviceContextParams
} from "@/services/printer";

import { usePrinterStore } from "@/stores/printer-store";
import { Capacitor } from "@capacitor/core";
import * as posService from "@/services/pos";
import { ProductSortStatus } from "@/services/pos";
import type {
  BillDiscountInput,
  CancelOrderItemInput,
  CartOrder,
  CateProductItem,
  CateWithProducts,
  ConfirmToKitchenPendingQuery,
  ConfirmOrderItemServedInput,
  ConfirmToKitchenInput,
  ConfirmToKitchenResponse,
  CreateOrderInput,
  CreateOrderResponse,
  CreateTableQRRequest,
  CreateTableQRResponse,
  FetchCartParams,
  FetchCateProductsResponse,
  FetchCateProductsParams,
  FetchJoinMoveTableParams,
  FetchPosParams,
  GetProdItemParams,
  InitOrderWithoutTableInput,
  InitOrderWithoutTableResponse,
  ItemDiscountInput,
  JoinTableMultiInput,
  MoveTableInput,
  MoveTableZone,
  OrderHistory,
  PaymentInput,
  PaymentResponse,
  PosZone,
  PrintInvoiceRequest,
  PrintInvoiceResponse,
  ProdItem,
  ReprintReceiptRequest,
  SplitBillInput,
  SplitBillResponse,
  TableQRResponse,
  UpdateOrderNoteInput,
  UpdateQtyInput,
  ProductSortStatus as ProductSortStatusType
} from "@/services/pos";
import {
  countPosMenuProducts,
  emptyPosMenuBySort,
  firstPosMenuStatusWithProducts,
  nextPosMenuCategoryUuid,
  updateZonesTableOrderState,
  type PosMenuBySort
} from "@/stores/pos-store/helpers";
import { createSessionGuard, registerSessionStoreReset } from "@/stores/session-store-registry";
import { errorMessage } from "@/stores/store-utils";

async function fetchTables(params: FetchPosParams) {
  const result = await posService.getPosTables(params);
  return result.data ?? [];
}

function textValue(value: unknown) {
  return String(value ?? "").trim();
}

let posMenuLifecycleVersion = 0;

function initialPosMenuState() {
  return {
    categories: [] as CateWithProducts[],
    selectedCateUuid: "",
    menuBySort: emptyPosMenuBySort(),
    loadingMenu: false,
    submittedSearch: "",
    activeSort: ProductSortStatus.NORMAL as ProductSortStatusType,
  };
}

function assertCurrentSession(isCurrentSession: () => boolean) {
  if (!isCurrentSession()) {
    throw new Error("Session changed while the request was in progress");
  }
}

function isMobilePrinterCandidate(printer: Printer) {
  const connectType = textValue(printer.connect_type).toLowerCase();
  const printMode = textValue(printer.print_mode).toLowerCase();

  return connectType === "tcp" || printMode === "mobile_wifi";
}

function pickMobilePrinterFromList(printers: Printer[]) {
  return printers.find((printer) => printer.is_active && isMobilePrinterCandidate(printer)) ??
    printers.find((printer) => isMobilePrinterCandidate(printer));
}

async function pickMobilePrinter(input: { login_uuid_fk?: string; lang?: string }) {
  const isCurrentSession = createSessionGuard();
  const printerState = usePrinterStore.getState();
  const cachedCandidates = [...printerState.printers, ...printerState.options];
  const cachedPrinter = pickMobilePrinterFromList(cachedCandidates);

  if (cachedPrinter?.device_code) {
    return cachedPrinter;
  }

  const loginUuid = textValue(input.login_uuid_fk);

  if (!loginUuid) {
    return cachedPrinter;
  }

  const fetchedPrinters = await getPrinters({
    login_uuid_fk: loginUuid,
    lang: input.lang
  });

  const fetchedPrinter = pickMobilePrinterFromList(fetchedPrinters);

  if (fetchedPrinters.length && isCurrentSession()) {
    usePrinterStore.setState({ printers: fetchedPrinters });
  }

  return fetchedPrinter ?? cachedPrinter;
}

async function resolvePosPrinterContext(
  input: PrinterDeviceContextParams & {
    agent_name?: string;
    lang?: string;
  }
) {
  if (Capacitor.isNativePlatform()) {
    const selectedPrinter = await pickMobilePrinter(input);

    if (!selectedPrinter?.device_code) {
      throw new Error("mobile printer device_code not found");
    }

    return {
      device_code: selectedPrinter.device_code,
      agent_id: selectedPrinter.agent_id ?? input.agent_id,
      agent_name: selectedPrinter.agent_name ?? input.agent_name,
      print_mode: selectedPrinter.print_mode ?? input.print_mode ?? "mobile_wifi"
    };

  }

  return resolvePrinterDeviceContext(input);
}

interface PosState {
  zones: PosZone[];
  zoneOptions: PosZone[];
  products: CateProductItem[];
  categories: CateWithProducts[];
  selectedCateUuid: string;
  menuBySort: PosMenuBySort;
  loadingMenu: boolean;
  submittedSearch: string;
  activeSort: ProductSortStatusType;
  selectedProduct: ProdItem | null;
  cart: CartOrder | CartOrder[] | null;
  joinMoveZones: MoveTableZone[];
  tableQr: TableQRResponse | CreateTableQRResponse | null;
  orderHistory: OrderHistory[];
  lastPayment: PaymentResponse | null;
  lastSplitBill: SplitBillResponse | null;
  lastKitchenConfirm: ConfirmToKitchenResponse | null;
  lastInvoice: PrintInvoiceResponse | null;
  tableUuid: string;
  tableName: string;
  // ร้านไม่มีโต๊ะ (store_table_status === 2): order_uuid ของบิลที่กำลังเปิดอยู่
  // backend ผูกไว้กับ login token เอง (ดู initOrderWithoutTable) จึงไม่ต้อง
  // persist ฝั่ง client — เรียก init ใหม่ทุกครั้งที่เข้าหน้านี้ก็ได้ค่าเดิมกลับมา
  counterOrderUuid: string;
  loading: boolean;
  loadingCart: boolean;
  saving: boolean;
  error: string | null;
  setZones: (zones: PosZone[]) => void;
  setProducts: (products: CateProductItem[]) => void;
  setActiveSort: (activeSort: ProductSortStatusType) => void;
  resetMenu: () => void;
  setCart: (cart: CartOrder | CartOrder[] | null) => void;
  setTable: (tableUuid: string, tableName?: string) => void;
  setCounterOrderUuid: (orderUuid: string) => void;
  updateTableCustomerOrderState: (tableUuid: string, customerOrderState: boolean) => void;
  loadTables: (params: FetchPosParams) => Promise<PosZone[]>;
  refreshTables: (params: FetchPosParams) => Promise<PosZone[]>;
  loadProductCategories: (params: FetchCateProductsParams) => Promise<FetchCateProductsResponse>;
  loadMenu: (params: {
    branchUuid: string;
    language: string;
    cateUuid?: string;
    query?: string;
    refreshCategories?: boolean;
  }) => Promise<PosMenuBySort>;
  loadProducts: (params: FetchCateProductsParams) => Promise<CateProductItem[]>;
  loadProductItem: (params: GetProdItemParams) => Promise<ProdItem>;
  loadCart: (params: FetchCartParams) => Promise<CartOrder | CartOrder[] | null>;
  createOrder: (input: CreateOrderInput) => Promise<CreateOrderResponse>;
  initOrderWithoutTable: (input: InitOrderWithoutTableInput) => Promise<InitOrderWithoutTableResponse>;
  updateQty: (input: UpdateQtyInput) => ReturnType<typeof posService.updateOrderItemQty>;
  applyItemDiscount: (input: ItemDiscountInput) => ReturnType<typeof posService.applyItemDiscount>;
  applyBillDiscount: (input: BillDiscountInput) => ReturnType<typeof posService.applyBillDiscount>;
  deleteItem: (orderItemUuid: string) => ReturnType<typeof posService.deleteOrderItem>;
  loadJoinMoveTables: (params: FetchJoinMoveTableParams) => Promise<MoveTableZone[]>;
  moveTable: (input: MoveTableInput) => ReturnType<typeof posService.moveTable>;
  joinTables: (input: JoinTableMultiInput) => ReturnType<typeof posService.joinTableMulti>;
  loadTableQr: (tableUuid: string) => Promise<TableQRResponse>;
  confirmKitchen: (input: ConfirmToKitchenInput) => Promise<ConfirmToKitchenResponse>;
  confirmServed: (input: ConfirmOrderItemServedInput) => ReturnType<typeof posService.confirmOrderItemServed>;
  cancelItem: (input: CancelOrderItemInput) => ReturnType<typeof posService.cancelOrderItem>;
  updateNote: (input: UpdateOrderNoteInput) => ReturnType<typeof posService.updateOrderNote>;
  createPayment: (input: PaymentInput) => Promise<PaymentResponse>;
  splitBill: (input: SplitBillInput) => Promise<SplitBillResponse>;
  // action นี้สั่งพิมพ์ QR ด้วย จึงบังคับ login_uuid_fk ที่ระดับ store (request type เป็น optional)
  createTableQr: (params: CreateTableQRRequest & { login_uuid_fk: string }) => Promise<CreateTableQRResponse>;
  printInvoice: (params: PrintInvoiceRequest) => Promise<PrintInvoiceResponse>;
  reprintReceipt: (params: ReprintReceiptRequest) => Promise<ConfirmToKitchenPendingQuery | null>;
  setOrderHistory: (orders: CartOrder[]) => void;
  reset: () => void;
}

export const usePosStore = create<PosState>((set, get) => ({
  zones: [],
  zoneOptions: [],
  products: [],
  ...initialPosMenuState(),
  selectedProduct: null,
  cart: null,
  joinMoveZones: [],
  tableQr: null,
  orderHistory: [],
  lastPayment: null,
  lastSplitBill: null,
  lastKitchenConfirm: null,
  lastInvoice: null,
  tableUuid: "",
  tableName: "",
  counterOrderUuid: "",
  loading: false,
  loadingCart: false,
  saving: false,
  error: null,
  setZones: (zones) => set({ zones }),
  setProducts: (products) => set({ products }),
  setActiveSort: (activeSort) => set({ activeSort }),
  resetMenu: () => {
    posMenuLifecycleVersion += 1;
    set(initialPosMenuState());
  },
  setCart: (cart) => set({ cart }),
  setTable: (tableUuid, tableName = "") => set({ tableUuid, tableName }),
  setCounterOrderUuid: (orderUuid) => set({ counterOrderUuid: orderUuid }),
  updateTableCustomerOrderState: (tableUuid, customerOrderState) =>
    set((state) => ({
      zones: updateZonesTableOrderState(state.zones, tableUuid, customerOrderState)
    })),
  loadTables: async (params) => {
    const isCurrentSession = createSessionGuard();
    set({ loading: true, error: null });
    try {
      const zones = await fetchTables(params);
      if (isCurrentSession()) {
        set({
          zones,
          ...(!params.zone_uuid ? { zoneOptions: zones } : {}),
          loading: false
        });
      }
      return zones;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  refreshTables: async (params) => {
    const isCurrentSession = createSessionGuard();
    try {
      const zones = await fetchTables(params);
      if (isCurrentSession()) {
        set({
          zones,
          ...(!params.zone_uuid ? { zoneOptions: zones } : {})
        });
      }
      return zones;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error) });
      throw error;
    }
  },
  loadProductCategories: async (params) => {
    const isCurrentSession = createSessionGuard();
    try {
      const result = await posService.fetchCateProducts(params);
      const categories = result.categories ?? [];
      if (isCurrentSession()) {
        set({
          products: categories.flatMap((category: CateWithProducts) => category.products ?? []),
          error: null
        });
      }
      return result;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error) });
      throw error;
    }
  },
  loadMenu: async ({
    branchUuid,
    language,
    cateUuid = "",
    query = "",
    refreshCategories = false
  }) => {
    const isCurrentSession = createSessionGuard();
    const menuLifecycleVersion = posMenuLifecycleVersion;
    const isCurrentMenuLifecycle = () =>
      isCurrentSession() &&
      menuLifecycleVersion === posMenuLifecycleVersion;
    if (!branchUuid) {
      get().resetMenu();
      return emptyPosMenuBySort();
    }

    set({ loadingMenu: true, error: null });
    try {
      let nextCateUuid = textValue(cateUuid);
      const nextQuery = query ?? "";

      if (refreshCategories) {
        const catalog = await get().loadProductCategories({
          branchUuidFk: branchUuid,
          lang: language,
          search: "",
          statusSortFk: ProductSortStatus.NORMAL
        });
        const categories = catalog.categories ?? [];
        nextCateUuid = nextPosMenuCategoryUuid({
          categories,
          defaultCateUuid: catalog.defaultCateUuid,
          requestedCateUuid: nextCateUuid,
          selectedCateUuid: catalog.selectedCateUuid
        });
        if (isCurrentMenuLifecycle()) set({ categories });
      }

      const searchQuery = nextQuery.trim();
      let menuBySort = emptyPosMenuBySort();
      if (nextCateUuid || searchQuery) {
        const request = (statusSortFk: ProductSortStatusType) =>
          get().loadProductCategories({
            branchUuidFk: branchUuid,
            ...(searchQuery ? {} : { cateUuid: nextCateUuid }),
            lang: language,
            search: searchQuery,
            statusSortFk
          });
        const [normal, setMenu, promotion] = await Promise.all([
          request(ProductSortStatus.NORMAL),
          request(ProductSortStatus.SET),
          request(ProductSortStatus.PROMOTION)
        ]);
        menuBySort = {
          [ProductSortStatus.NORMAL]: normal.categories ?? [],
          [ProductSortStatus.SET]: setMenu.categories ?? [],
          [ProductSortStatus.PROMOTION]: promotion.categories ?? []
        };
      }

      if (isCurrentMenuLifecycle()) {
        set((state) => ({
          activeSort:
            countPosMenuProducts(menuBySort[state.activeSort]) > 0
              ? state.activeSort
              : firstPosMenuStatusWithProducts(menuBySort),
          selectedCateUuid: nextCateUuid,
          submittedSearch: nextQuery,
          menuBySort
        }));
      }
      return menuBySort;
    } catch (error) {
      if (isCurrentMenuLifecycle()) set({ error: errorMessage(error) });
      throw error;
    } finally {
      if (isCurrentMenuLifecycle()) set({ loadingMenu: false });
    }
  },
  loadProducts: async (params) => {
    const isCurrentSession = createSessionGuard();
    set({ loading: true, error: null });
    try {
      const result = await posService.fetchCateProducts(params);
      const products = (result.categories ?? []).flatMap((category) => category.products ?? []);
      if (isCurrentSession()) set({ products, loading: false });
      return products;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  loadProductItem: async (params) => {
    const isCurrentSession = createSessionGuard();
    const selectedProduct = await posService.getProdItem(params);
    if (isCurrentSession()) set({ selectedProduct });
    return selectedProduct;
  },
  loadCart: async (params) => {
    const isCurrentSession = createSessionGuard();
    set({ loadingCart: true, error: null });
    try {
      const result = await posService.fetchCart(params);
      const cart = result.orders ?? result.data ?? null;
      if (isCurrentSession()) set({ cart, loadingCart: false });
      return cart;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), loadingCart: false });
      throw error;
    }
  },
  createOrder: async (input) => {
    const isCurrentSession = createSessionGuard();
    set({ saving: true, error: null });
    try {
      const result = await posService.createOrder(input);
      if (isCurrentSession()) set({ saving: false });
      return result;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  initOrderWithoutTable: async (input) => {
    const isCurrentSession = createSessionGuard();
    try {
      const result = await posService.initOrderWithoutTable(input);
      if (isCurrentSession()) set({ counterOrderUuid: textValue(result.order_uuid) });
      return result;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error) });
      throw error;
    }
  },
  updateQty: (input) => posService.updateOrderItemQty(input),
  applyItemDiscount: (input) => posService.applyItemDiscount(input),
  applyBillDiscount: (input) => posService.applyBillDiscount(input),
  deleteItem: (orderItemUuid) => posService.deleteOrderItem(orderItemUuid),
  loadJoinMoveTables: async (params) => {
    const isCurrentSession = createSessionGuard();
    const result = await posService.fetchJoinMoveTables(params);
    const joinMoveZones = result.data ?? [];
    if (isCurrentSession()) set({ joinMoveZones });
    return joinMoveZones;
  },
  moveTable: (input) => posService.moveTable(input),
  joinTables: (input) => posService.joinTableMulti(input),
  loadTableQr: async (tableUuid) => {
    const isCurrentSession = createSessionGuard();
    const tableQr = await posService.createTableQR({ table_uuid: tableUuid });
    if (isCurrentSession()) set({ tableQr });
    return tableQr;
  },
  confirmKitchen: async (input) => {
    const isCurrentSession = createSessionGuard();
    try {
      const printer = await resolvePosPrinterContext(input);
      assertCurrentSession(isCurrentSession);

      const payload = {
        order_uuid: input.order_uuid,
        login_uuid_fk: input.login_uuid_fk,
        order_item_uuids: input.order_item_uuids,
        lang: input.lang,
        device_code: printer.device_code,
        agent_id: printer.agent_id,
        print_mode: printer.print_mode,
      };

      const lastKitchenConfirm = await posService.confirmToKitchen(payload);

      // การพิมพ์ครัวเป็นหน้าที่ของ workflow ฝั่ง UI (executeKitchenAck) ที่เดียว
      // — เดิม store รันงานพิมพ์ซ้อนอีกชั้นด้วย print_job_uuid เดียวกัน ทำให้พิมพ์/ack ซ้ำ
      // และรอบสองถูก backend รายงานเป็น fail ปลอม ("ພິມບໍ່ສຳເລັດ 1/1") ทั้งที่งานแรกสำเร็จ
      if (isCurrentSession()) set({ lastKitchenConfirm });
      return lastKitchenConfirm;
    } catch (error) {
      if (isCurrentSession()) set({ error: errorMessage(error) });
      throw error;
    }

  },
  confirmServed: (input) => posService.confirmOrderItemServed(input),
  cancelItem: (input) => posService.cancelOrderItem(input),
  updateNote: (input) => posService.updateOrderNote(input),
  createPayment: async (input) => {
    const isCurrentSession = createSessionGuard();
    const printer = await resolvePosPrinterContext(input);
    assertCurrentSession(isCurrentSession);

    const lastPayment = await posService.createPayment({
      ...input,
      device_code: printer.device_code,
      agent_id: printer.agent_id,
      print_mode: printer.print_mode
    });
    if (isCurrentSession()) set({ lastPayment });
    return lastPayment;
  },
  splitBill: async (input) => {
    const isCurrentSession = createSessionGuard();
    const printer = await resolvePosPrinterContext(input);
    assertCurrentSession(isCurrentSession);

    const lastSplitBill = await posService.splitBill({
      ...input,
      device_code: printer.device_code,
      agent_id: printer.agent_id,
      print_mode: printer.print_mode
    });
    if (isCurrentSession()) set({ lastSplitBill });
    return lastSplitBill;
  },
  createTableQr: async (params) => {
    const isCurrentSession = createSessionGuard();
    const printer = await resolvePosPrinterContext(params);
    assertCurrentSession(isCurrentSession);

    const tableQr = await posService.createTableQR({
      ...params,
      device_code: printer.device_code,
      agent_id: printer.agent_id,
      print_mode: printer.print_mode
    });
    if (isCurrentSession()) set({ tableQr });
    return tableQr;
  },
  printInvoice: async (params) => {
    const isCurrentSession = createSessionGuard();
    const printer = await resolvePosPrinterContext(params);
    assertCurrentSession(isCurrentSession);

    const lastInvoice = await posService.printInvoice({
      login_uuid_fk: params.login_uuid_fk,
      order_uuid: params.order_uuid,
      lang: params.lang,
      document_type: "invoice",
      device_code: printer.device_code,
      agent_id: printer.agent_id,
      print_mode: printer.print_mode
    });
    if (isCurrentSession()) set({ lastInvoice });
    return lastInvoice;
  },
  reprintReceipt: async (params) => {
    const isCurrentSession = createSessionGuard();
    const printer = await resolvePosPrinterContext(params);
    assertCurrentSession(isCurrentSession);

    const response = await posService.reprintReceipt({
      order_uuid: params.order_uuid,
      login_uuid_fk: params.login_uuid_fk,
      lang: params.lang,
      device_code: printer.device_code,
      agent_id: printer.agent_id,
      print_mode: printer.print_mode
    });
    assertCurrentSession(isCurrentSession);
    const printJobUuid = textValue(response.print_job?.print_job_uuid);

    if (!printJobUuid) return null;

    return {
      print_job_uuid: printJobUuid,
      login_uuid_fk: params.login_uuid_fk,
      device_code: printer.device_code,
      agent_id: printer.agent_id,
      print_mode: printer.print_mode
    };
  },
  setOrderHistory: (orders) => set({ orderHistory: posService.cartOrdersToHistory(orders) }),
  reset: () => {
    posMenuLifecycleVersion += 1;
    set({
      zones: [],
      zoneOptions: [],
      products: [],
      ...initialPosMenuState(),
      selectedProduct: null,
      cart: null,
      joinMoveZones: [],
      tableQr: null,
      orderHistory: [],
      lastPayment: null,
      lastSplitBill: null,
      lastKitchenConfirm: null,
      lastInvoice: null,
      tableUuid: "",
      tableName: "",
      counterOrderUuid: "",
      loading: false,
      loadingCart: false,
      saving: false,
      error: null
    });
  }
}));

registerSessionStoreReset("pos", () => usePosStore.getState().reset());
