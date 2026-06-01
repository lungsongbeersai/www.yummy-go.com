"use client";

import { create } from "zustand";
import * as posService from "@/services/pos";
import type {
  BillDiscountInput,
  CancelOrderItemInput,
  CartOrder,
  CateProductItem,
  ConfirmOrderItemServedInput,
  ConfirmToKitchenInput,
  ConfirmToKitchenResponse,
  CreateOrderInput,
  CreateOrderResponse,
  CreateTableQRRequest,
  CreateTableQRResponse,
  FetchCartParams,
  FetchCateProductsParams,
  FetchJoinMoveTableParams,
  FetchPosParams,
  GetProdItemParams,
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
  SplitBillInput,
  SplitBillResponse,
  TableQRResponse,
  UpdateOrderNoteInput,
  UpdateQtyInput
} from "@/services/pos";
import { updateZonesTableOrderState } from "@/stores/pos-store/helpers";
import { errorMessage } from "@/stores/store-utils";

async function fetchTables(params: FetchPosParams) {
  const result = await posService.getPosTables(params);
  return result.data ?? [];
}

interface PosState {
  zones: PosZone[];
  products: CateProductItem[];
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
  loading: boolean;
  loadingCart: boolean;
  saving: boolean;
  error: string | null;
  setZones: (zones: PosZone[]) => void;
  setProducts: (products: CateProductItem[]) => void;
  setCart: (cart: CartOrder | CartOrder[] | null) => void;
  setTable: (tableUuid: string, tableName?: string) => void;
  updateTableCustomerOrderState: (tableUuid: string, customerOrderState: boolean) => void;
  loadTables: (params: FetchPosParams) => Promise<PosZone[]>;
  refreshTables: (params: FetchPosParams) => Promise<PosZone[]>;
  loadProducts: (params: FetchCateProductsParams) => Promise<CateProductItem[]>;
  loadProductItem: (params: GetProdItemParams) => Promise<ProdItem>;
  loadCart: (params: FetchCartParams) => Promise<CartOrder | CartOrder[] | null>;
  createOrder: (input: CreateOrderInput) => Promise<CreateOrderResponse>;
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
  createTableQr: (params: CreateTableQRRequest) => Promise<CreateTableQRResponse>;
  printInvoice: (params: PrintInvoiceRequest) => Promise<PrintInvoiceResponse>;
  setOrderHistory: (orders: CartOrder[]) => void;
  reset: () => void;
}

export const usePosStore = create<PosState>((set) => ({
  zones: [],
  products: [],
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
  loading: false,
  loadingCart: false,
  saving: false,
  error: null,
  setZones: (zones) => set({ zones }),
  setProducts: (products) => set({ products }),
  setCart: (cart) => set({ cart }),
  setTable: (tableUuid, tableName = "") => set({ tableUuid, tableName }),
  updateTableCustomerOrderState: (tableUuid, customerOrderState) =>
    set((state) => ({
      zones: updateZonesTableOrderState(state.zones, tableUuid, customerOrderState)
    })),
  loadTables: async (params) => {
    set({ loading: true, error: null });
    try {
      const zones = await fetchTables(params);
      set({ zones, loading: false });
      return zones;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  refreshTables: async (params) => {
    try {
      const zones = await fetchTables(params);
      set({ zones });
      return zones;
    } catch (error) {
      set({ error: errorMessage(error) });
      throw error;
    }
  },
  loadProducts: async (params) => {
    set({ loading: true, error: null });
    try {
      const result = await posService.fetchCateProducts(params);
      const products = (result.data ?? []).flatMap((category) => category.products ?? []);
      set({ products, loading: false });
      return products;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
  loadProductItem: async (params) => {
    const selectedProduct = await posService.getProdItem(params);
    set({ selectedProduct });
    return selectedProduct;
  },
  loadCart: async (params) => {
    set({ loadingCart: true, error: null });
    try {
      const result = await posService.fetchCart(params);
      const cart = result.orders ?? result.data ?? null;
      set({ cart, loadingCart: false });
      return cart;
    } catch (error) {
      set({ error: errorMessage(error), loadingCart: false });
      throw error;
    }
  },
  createOrder: async (input) => {
    set({ saving: true, error: null });
    try {
      const result = await posService.createOrder(input);
      set({ saving: false });
      return result;
    } catch (error) {
      set({ error: errorMessage(error), saving: false });
      throw error;
    }
  },
  updateQty: (input) => posService.updateOrderItemQty(input),
  applyItemDiscount: (input) => posService.applyItemDiscount(input),
  applyBillDiscount: (input) => posService.applyBillDiscount(input),
  deleteItem: (orderItemUuid) => posService.deleteOrderItem(orderItemUuid),
  loadJoinMoveTables: async (params) => {
    const result = await posService.fetchJoinMoveTables(params);
    const joinMoveZones = result.data ?? [];
    set({ joinMoveZones });
    return joinMoveZones;
  },
  moveTable: (input) => posService.moveTable(input),
  joinTables: (input) => posService.joinTableMulti(input),
  loadTableQr: async (tableUuid) => {
    const tableQr = await posService.getTableQR(tableUuid);
    set({ tableQr });
    return tableQr;
  },
  confirmKitchen: async (input) => {
    const lastKitchenConfirm = await posService.confirmToKitchen(input);
    set({ lastKitchenConfirm });
    return lastKitchenConfirm;
  },
  confirmServed: (input) => posService.confirmOrderItemServed(input),
  cancelItem: (input) => posService.cancelOrderItem(input),
  updateNote: (input) => posService.updateOrderNote(input),
  createPayment: async (input) => {
    const lastPayment = await posService.createPayment(input);
    set({ lastPayment });
    return lastPayment;
  },
  splitBill: async (input) => {
    const lastSplitBill = await posService.splitBill(input);
    set({ lastSplitBill });
    return lastSplitBill;
  },
  createTableQr: async (params) => {
    const tableQr = await posService.createTableQR(params);
    set({ tableQr });
    return tableQr;
  },
  printInvoice: async (params) => {
    const lastInvoice = await posService.printInvoice(params);
    set({ lastInvoice });
    return lastInvoice;
  },
  setOrderHistory: (orders) => set({ orderHistory: posService.cartOrdersToHistory(orders) }),
  reset: () =>
    set({
      zones: [],
      products: [],
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
      loading: false,
      loadingCart: false,
      saving: false,
      error: null
    })
}));
