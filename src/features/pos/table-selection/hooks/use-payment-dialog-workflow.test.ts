import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartOrder, PosTable } from "@/services/pos";
import type {
  InvoicePrintData,
  LocalInvoicePrintWindowReservation,
} from "@/services/printer/invoice-print-window";
import type { PaymentDialogProps } from "../payment-dialog-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("./use-payment-customers", () => ({
  usePaymentCustomers: () => ({
    customerCreateOpen: false,
    customerOpen: false,
    customerUuid: "customer-1",
    selectedCustomerOption: null,
  }),
}));

const platform = vi.hoisted(() => ({ native: true, electron: false }));
vi.mock("@/lib/capacitor-platform", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/capacitor-platform")>(),
  canUseWindowOpen: () => !platform.native,
  isCapacitorMobileApp: () => platform.native,
}));
vi.mock("@/lib/system-print-capability", () => ({
  canUseSystemPrintFallback: () => !platform.native && !platform.electron,
}));

const browserPrint = vi.hoisted(() => ({
  reserve: vi.fn<() => LocalInvoicePrintWindowReservation | null>(),
  render: vi.fn<(data: InvoicePrintData) => boolean>(),
  closeUnused: vi.fn<() => void>(),
  open: vi.fn<(data: InvoicePrintData) => Promise<boolean>>(),
}));
vi.mock("@/services/printer/invoice-print-window", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/services/printer/invoice-print-window")>(),
  reserveLocalInvoicePrintWindow: browserPrint.reserve,
  openLocalInvoicePrintWindow: browserPrint.open,
}));

import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";
import { useReferenceStore } from "@/stores/reference-store";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { useToastStore } from "@/stores/toast-store";
import { usePaymentDialogWorkflow } from "./use-payment-dialog-workflow";

function WorkflowHarness(props: PaymentDialogProps) {
  const { activeInputDisplayValue } = usePaymentDialogWorkflow(props);
  return createElement("output", null, activeInputDisplayValue);
}

const orders = [
  {
    order_uuid: "order-1",
    order_invoice: "INV-1",
  } as CartOrder,
];

const table: PosTable = {
  table_uuid: "table-1",
  table_name: "A1",
  table_status: 2,
};

const summary = {
  grandTotal: 5_461_500,
  orderDiscount: 0,
  orderVat: null,
  serviceRate: null,
  serviceTotal: 0,
  subtotal: 5_461_500,
  tax: 0,
  taxRate: null,
  vatTotal: null,
} as PaymentDialogProps["summary"];

function safeBrowserDocument(documentType: "invoice" | "receipt") {
  return {
    fallback_print: {
      mode: "browser_print",
      role_code: documentType,
      safe_not_queued: true,
      reason: "DOCUMENT_PRINTER_UNAVAILABLE",
      payload: {
        document_type: documentType,
        invoiceNo: "SERVER-SPLIT-2",
        shopName: "Server shop",
        branchName: "Server branch",
        tableName: "Server table",
        show_logo: false,
        subTotal: 70_000,
        discount_amount: 7_000,
        service_charge_amount: 3_000,
        vat_amount: 6_000,
        total: 72_000,
        exchange_rates: [{ currency_code: "THB", exchange_rate: 600 }],
        payment_currency: "THB",
        paymentLabel: "Cash",
        exchange_rate: 600,
        paid_cash: 90_000,
        paid_transfer: 0,
        paid_total: 90_000,
        change: 18_000,
        foreign_paid: 150,
        paid_lak: 90_000,
        change_lak: 18_000,
        items: [{
          name: "Server noodles", qty: 2, price: 40_000, base_price: 30_000,
          total: 70_000, gross_total: 80_000, item_discount_amount: 10_000,
          topping_unit_total: 10_000,
          toppings: [{ topping_name: "Egg", topping_qty: 1, topping_total: 10_000 }],
          tastes: [{ taste_name: "Spicy" }],
        }],
      },
    },
  };
}

function safeInvoiceError() {
  return Object.assign(new Error("Invoice printer unavailable"), {
    payload: {
      error_code: "DOCUMENT_PRINTER_UNAVAILABLE",
      ...safeBrowserDocument("invoice"),
    },
  });
}

function committedReceipt(paymentKind: "full" | "split") {
  return {
    ...safeBrowserDocument("receipt"),
    order_uuid: "order-1",
    ...(paymentKind === "split" ? { new_order_uuid: "paid-split-order" } : {}),
    payment: {
      payment_uuid: "committed-payment-1",
      order_uuid_fk: paymentKind === "split" ? "paid-split-order" : "order-1",
    },
    payment_committed: true,
  };
}

describe("payment dialog workflow", () => {
  const restoreSsrSnapshots: (() => void)[] = [];
  const originalPosActions = {
    createPayment: usePosStore.getState().createPayment,
    printInvoice: usePosStore.getState().printInvoice,
    reprintReceipt: usePosStore.getState().reprintReceipt,
    splitBill: usePosStore.getState().splitBill,
  };
  const originalExecuteInvoice = usePrinterStore.getState().executeInvoice;
  const originalAgentStatus = usePrinterStore.getState().agentStatus;
  const originalShowToast = useToastStore.getState().show;
  beforeEach(() => {
    platform.native = true;
    platform.electron = false;
    browserPrint.render.mockReset().mockReturnValue(true);
    browserPrint.closeUnused.mockReset();
    browserPrint.open.mockReset().mockResolvedValue(true);
    browserPrint.reserve.mockReset().mockImplementation(() => ({
      render: browserPrint.render,
      closeUnused: browserPrint.closeUnused,
    }));
    useAppStore.setState({ language: "la" });
    useAuthStore.setState({ user: null });
    useReferenceStore.setState({
      options: {},
      loadingKeys: {},
    });
    usePrinterStore.setState({ agentStatus: "offline" });
  });

  afterEach(() => {
    for (const restore of restoreSsrSnapshots.splice(0)) restore();
    vi.restoreAllMocks();
    usePosStore.setState(originalPosActions);
    usePrinterStore.setState({ executeInvoice: originalExecuteInvoice, agentStatus: originalAgentStatus });
    useToastStore.setState({ show: originalShowToast });
  });

  function renderActionWorkflow(paymentKind: "full" | "split", overrides: Partial<PaymentDialogProps> = {}) {
    useAuthStore.setState({ user: {
      uuid: "cashier-1", email: "", status: 1, profile: "",
      branch_uuid: "branch-1", branch_name: "", branch_tel: "", branch_address: "",
      store_uuid: "store-1", store_name: "", store_logo: "", store_table_status: 1,
    } });
    // SSR reads each Zustand store's initial snapshot. Expose this test's
    // current state while exercising the hook's actions without mounting UI.
    function exposeCurrentSnapshot<T extends object>(store: { getInitialState(): T; getState(): T }) {
      const initial = store.getInitialState();
      const original = { ...initial };
      Object.assign(initial, store.getState());
      restoreSsrSnapshots.push(() => { Object.assign(initial, original); });
    }
    exposeCurrentSnapshot(useAuthStore);
    exposeCurrentSnapshot(usePosStore);
    exposeCurrentSnapshot(usePrinterStore);
    exposeCurrentSnapshot(useToastStore);
    const capture = vi.fn<(workflow: ReturnType<typeof usePaymentDialogWorkflow>) => void>();
    function ActionHarness({ onReady }: { onReady: typeof capture }) {
      const workflow = usePaymentDialogWorkflow({
        onCompleted: async () => {}, onOpenChange: () => {}, open: true,
        orders, summary, table, paymentKind, splitBillItemUuids: [{ "item-1": 1 }],
        ...overrides,
      });
      onReady(workflow);
      return null;
    }
    renderToString(createElement(ActionHarness, { onReady: capture }));
    const workflow = capture.mock.calls.at(-1)?.[0];
    if (!workflow) throw new Error("Workflow was not rendered");
    return workflow;
  }

  it("prefills cash received with the amount due on the first open", () => {
    const html = renderToString(
      createElement(WorkflowHarness, {
        onCompleted: async () => undefined,
        onOpenChange: () => undefined,
        open: true,
        orders,
        summary,
        table,
      }),
    );

    expect(html).toBe("<output>5,461,500</output>");
  });

  it.each(["full", "split"] as const)("uses a new operation for each %s invoice click and retains it after a lost enqueue response", async (paymentKind) => {
    const enqueue = vi.fn().mockRejectedValueOnce(new Error("Enqueue response lost")).mockResolvedValue({
      pending_query: { print_job_uuid: "invoice-job", login_uuid_fk: "cashier-1" },
    });
    usePosStore.setState({ printInvoice: enqueue, splitBill: enqueue });
    usePrinterStore.setState({ executeInvoice: vi.fn().mockResolvedValue({ successCount: 1, failedCount: 0, total: 1 }) });
    const show = vi.fn<typeof originalShowToast>();
    useToastStore.setState({ show });
    const workflow = renderActionWorkflow(paymentKind);
    await workflow.handlePrintInvoice();
    expect(enqueue).toHaveBeenCalledOnce();
    const firstOperation = enqueue.mock.calls[0][0].operation_uuid;
    expect(firstOperation).toMatch(/^[0-9a-f-]{36}$/i);
    const retry = show.mock.calls.at(-1)?.[0].action;
    expect(retry).toBeDefined();
    retry?.onClick({ preventDefault() {} });
    await vi.waitFor(() => expect(enqueue).toHaveBeenCalledTimes(2));
    expect(enqueue.mock.calls[1][0].operation_uuid).toBe(firstOperation);
    await vi.waitFor(() => expect(show).toHaveBeenLastCalledWith(expect.objectContaining({ title: "common.printSuccess" })));
    await workflow.handlePrintInvoice();
    expect(enqueue).toHaveBeenCalledTimes(3);
    expect(enqueue.mock.calls[2][0].operation_uuid).not.toBe(firstOperation);
    if (paymentKind === "split") expect(enqueue.mock.calls[2][0].document_type).toBe("invoice");
  });

  it.each(["full", "split"] as const)("shows an actionable %s invoice availability error without opening a browser fallback", async (paymentKind) => {
    platform.native = false;
    const unavailable = Object.assign(new Error("DOCUMENT_PRINTER_UNAVAILABLE: invoice"), {
      payload: { error_code: "DOCUMENT_PRINTER_UNAVAILABLE", role_code: "invoice", retryable: true },
    });
    const enqueue = vi.fn().mockRejectedValue(unavailable);
    const execute = vi.fn();
    const show = vi.fn<typeof originalShowToast>();
    usePosStore.setState({ printInvoice: enqueue, splitBill: enqueue });
    usePrinterStore.setState({ executeInvoice: execute });
    useToastStore.setState({ show });
    const workflow = renderActionWorkflow(paymentKind);
    await workflow.handlePrintInvoice();
    expect(execute).not.toHaveBeenCalled();
    expect(show).toHaveBeenLastCalledWith(expect.objectContaining({
      title: "pos.invoicePrintFailed", description: "pos.documentPrinterUnavailable", tone: "error",
      action: expect.objectContaining({ label: "actions.tryAgain" }),
    }));
    expect(show.mock.calls.every(([toast]) => toast.title !== "pos.invoicePrintFallback")).toBe(true);
    const firstOperation = enqueue.mock.calls[0][0].operation_uuid;
    show.mock.calls.at(-1)?.[0].action?.onClick({ preventDefault() {} });
    await vi.waitFor(() => expect(enqueue).toHaveBeenCalledTimes(2));
    expect(enqueue.mock.calls[1][0].operation_uuid).toBe(firstOperation);
  });

  it.each(["full", "split"] as const)("opens a %s invoice using only the authoritative unqueued server snapshot", async (paymentKind) => {
    platform.native = false;
    const enqueue = vi.fn().mockRejectedValue(safeInvoiceError());
    const payment = vi.fn();
    const execute = vi.fn();
    const show = vi.fn<typeof originalShowToast>();
    usePosStore.setState({ printInvoice: enqueue, splitBill: enqueue, createPayment: payment });
    usePrinterStore.setState({ executeInvoice: execute });
    useToastStore.setState({ show });

    await renderActionWorkflow(paymentKind).handlePrintInvoice();

    expect(enqueue).toHaveBeenCalledOnce();
    expect(browserPrint.reserve).toHaveBeenCalledOnce();
    expect(browserPrint.reserve.mock.invocationCallOrder[0]).toBeLessThan(enqueue.mock.invocationCallOrder[0]);
    expect(browserPrint.render).toHaveBeenCalledOnce();
    expect(browserPrint.render).toHaveBeenCalledWith(expect.objectContaining({
      invoice: "SERVER-SPLIT-2", total: 72_000, subtotal: 70_000,
      storeName: "Server shop", tableName: "Server table",
      discount: 7_000, service: 3_000, vat: 6_000,
      exchangeRates: [{ code: "THB", rate: 600 }],
      items: [expect.objectContaining({ name: "Server noodles", qty: 2, toppingTotal: 20_000 })],
    }));
    expect(browserPrint.render.mock.calls[0][0].total).not.toBe(summary.grandTotal);
    expect(browserPrint.render.mock.calls[0][0].payment).toBeUndefined();
    expect(browserPrint.open).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    expect(payment).not.toHaveBeenCalled();
    expect(browserPrint.closeUnused).toHaveBeenCalledOnce();
    expect(show).toHaveBeenLastCalledWith(expect.objectContaining({ title: "pos.browserPrintOpened", tone: "info" }));
    expect(show.mock.calls.some(([toast]) => toast.title === "common.printSuccess")).toBe(false);
    if (paymentKind === "split") expect(enqueue.mock.calls[0][0].document_type).toBe("invoice");
  });

  it.each(["full", "split"] as const)("finishes a committed %s payment and opens its saved receipt without replaying payment", async (paymentKind) => {
    platform.native = false;
    const response = committedReceipt(paymentKind);
    const pay = vi.fn().mockResolvedValue(response);
    const reprint = vi.fn();
    const execute = vi.fn();
    const show = vi.fn<typeof originalShowToast>();
    const onCompleted = vi.fn<PaymentDialogProps["onCompleted"]>().mockResolvedValue();
    const onOpenChange = vi.fn<PaymentDialogProps["onOpenChange"]>();
    usePosStore.setState({ createPayment: pay, splitBill: pay, reprintReceipt: reprint });
    usePrinterStore.setState({ executeInvoice: execute });
    useToastStore.setState({ show });

    await renderActionWorkflow(paymentKind, { onCompleted, onOpenChange }).submitPayment();

    expect(pay).toHaveBeenCalledOnce();
    expect(browserPrint.reserve.mock.invocationCallOrder[0]).toBeLessThan(pay.mock.invocationCallOrder[0]);
    expect(browserPrint.render).toHaveBeenCalledOnce();
    expect(browserPrint.render).toHaveBeenCalledWith(expect.objectContaining({
      invoice: "SERVER-SPLIT-2", total: 72_000, title: "pos.receiptPrintTitle",
      payment: expect.objectContaining({
        paidTotal: 90_000, paidCash: 90_000, paidTransfer: 0,
        change: 18_000, currency: "THB", exchangeRate: 600, foreignPaid: 150,
      }),
    }));
    expect(execute).not.toHaveBeenCalled();
    expect(reprint).not.toHaveBeenCalled();
    expect(onCompleted).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(browserPrint.closeUnused).toHaveBeenCalledOnce();
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ title: "pos.browserPrintOpened", tone: "info" }));
    expect(show).toHaveBeenLastCalledWith(expect.objectContaining({
      title: paymentKind === "split" ? "pos.splitPaymentCreated" : "pos.paymentSuccess", tone: "success",
    }));
    if (paymentKind === "split") expect(pay.mock.calls[0][0].document_type).toBe("receipt");
  });

  it.each(["full", "split"] as const)("preserves the kitchen retry while browser-printing an explicitly skipped %s receipt", async (paymentKind) => {
    platform.native = false;
    const response = {
      ...committedReceipt(paymentKind),
      pending_query: { print_job_uuid: "kitchen-job", login_uuid_fk: "cashier-1" },
      print_skipped: { role_code: "receipt", reason: "DOCUMENT_PRINT_ROLE_NOT_CONFIGURED" },
    };
    const pay = vi.fn().mockResolvedValue(response);
    const execute = vi.fn().mockResolvedValue({ successCount: 0, failedCount: 1, total: 1 });
    const show = vi.fn<typeof originalShowToast>();
    usePosStore.setState({ createPayment: pay, splitBill: pay });
    usePrinterStore.setState({ executeInvoice: execute });
    useToastStore.setState({ show });

    await renderActionWorkflow(paymentKind).submitPayment();

    expect(pay).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(browserPrint.render).toHaveBeenCalledOnce();
    const kitchenFailure = show.mock.calls.find(([toast]) => toast.title === "pos.documentPrintFailed")?.[0];
    const receiptOpened = show.mock.calls.find(([toast]) => toast.title === "pos.browserPrintOpened")?.[0];
    expect(kitchenFailure).toMatchObject({ tone: "error", action: { label: "pos.manualReprint" } });
    expect(receiptOpened).toMatchObject({ tone: "info" });
    expect(kitchenFailure?.id).toBeDefined();
    expect(kitchenFailure?.id).not.toBe(receiptOpened?.id);
  });

  it.each(["full", "split"] as const)("retries only the queued kitchen job when a %s payment replay skips receipt without a safe snapshot", async (paymentKind) => {
    platform.native = false;
    const response = {
      order_uuid: "order-1",
      payment_committed: true,
      payment: { payment_uuid: "committed-payment-1" },
      print_skipped: { role_code: "receipt", reason: "DOCUMENT_PRINT_ROLE_NOT_CONFIGURED" },
      pending_query: { print_job_uuid: "replayed-kitchen-job", login_uuid_fk: "cashier-1" },
    };
    const pay = vi.fn().mockResolvedValue(response);
    const reprint = vi.fn();
    const execute = vi.fn()
      .mockResolvedValueOnce({ successCount: 0, failedCount: 1, total: 1 })
      .mockResolvedValueOnce({ successCount: 1, failedCount: 0, total: 1 });
    const show = vi.fn<typeof originalShowToast>();
    const onCompleted = vi.fn<PaymentDialogProps["onCompleted"]>().mockResolvedValue();
    usePosStore.setState({ createPayment: pay, splitBill: pay, reprintReceipt: reprint });
    usePrinterStore.setState({ executeInvoice: execute });
    useToastStore.setState({ show });

    await renderActionWorkflow(paymentKind, { onCompleted }).submitPayment();

    expect(execute).toHaveBeenCalledOnce();
    const failure = show.mock.calls.at(-1)?.[0];
    expect(failure).toMatchObject({
      id: "document-print:replayed-kitchen-job:kitchen", title: "pos.documentPrintFailed",
      tone: "error", action: { label: "pos.manualReprint" },
    });
    failure?.action?.onClick({ preventDefault() {} });

    await vi.waitFor(() => expect(show).toHaveBeenLastCalledWith(expect.objectContaining({
      id: failure?.id, title: "common.printSuccess", tone: "success",
    })));
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[0][0]).toEqual(expect.objectContaining({ pending_query: response.pending_query }));
    expect(execute.mock.calls[1][0]).toEqual(execute.mock.calls[0][0]);
    expect(pay).toHaveBeenCalledOnce();
    expect(reprint).not.toHaveBeenCalled();
    expect(onCompleted).toHaveBeenCalledOnce();
    expect(browserPrint.render).not.toHaveBeenCalled();
    expect(browserPrint.open).not.toHaveBeenCalled();
    expect(show.mock.calls.some(([toast]) => toast.title === "pos.browserPrintOpened")).toBe(false);
  });

  for (const documentType of ["invoice", "receipt"] as const) {
    it.each(["full", "split"] as const)(`reopens the same prepared ${documentType} after a blocked %s popup without replaying its request`, async (paymentKind) => {
      platform.native = false;
      browserPrint.render.mockReturnValue(false);
      browserPrint.open.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const request = documentType === "invoice"
        ? vi.fn().mockRejectedValue(safeInvoiceError())
        : vi.fn().mockResolvedValue(committedReceipt(paymentKind));
      const reprint = vi.fn();
      const execute = vi.fn();
      const show = vi.fn<typeof originalShowToast>();
      const onCompleted = vi.fn<PaymentDialogProps["onCompleted"]>().mockResolvedValue();
      usePosStore.setState({
        createPayment: request, printInvoice: request, splitBill: request, reprintReceipt: reprint,
      });
      usePrinterStore.setState({ executeInvoice: execute });
      useToastStore.setState({ show });
      const workflow = renderActionWorkflow(paymentKind, { onCompleted });

      if (documentType === "invoice") await workflow.handlePrintInvoice();
      else await workflow.submitPayment();

      expect(request).toHaveBeenCalledOnce();
      const preparedDocument = browserPrint.render.mock.calls[0]?.[0];
      expect(preparedDocument).toMatchObject({ invoice: "SERVER-SPLIT-2", total: 72_000 });
      const blockedToast = show.mock.calls.at(-1)?.[0];
      expect(blockedToast).toMatchObject({
        tone: "error", description: "pos.invoicePrintPopupBlocked",
        action: { label: "pos.browserPrintAction" },
      });
      blockedToast?.action?.onClick({ preventDefault() {} });

      await vi.waitFor(() => expect(show).toHaveBeenLastCalledWith(expect.objectContaining({
        title: "pos.browserPrintOpened", tone: "info",
      })));
      expect(browserPrint.open).toHaveBeenCalledTimes(2);
      expect(browserPrint.open.mock.calls[0][0]).toBe(preparedDocument);
      expect(browserPrint.open.mock.calls[1][0]).toBe(preparedDocument);
      expect(request).toHaveBeenCalledOnce();
      expect(reprint).not.toHaveBeenCalled();
      expect(execute).not.toHaveBeenCalled();
      expect(onCompleted).toHaveBeenCalledTimes(documentType === "receipt" ? 1 : 0);
    });
  }

  it.each(["full", "split"] as const)("refuses browser fallback for a %s invoice retry after a lost enqueue response", async (paymentKind) => {
    platform.native = false;
    const enqueue = vi.fn()
      .mockRejectedValueOnce(new Error("Enqueue response lost"))
      .mockRejectedValueOnce(safeInvoiceError());
    const show = vi.fn<typeof originalShowToast>();
    usePosStore.setState({ printInvoice: enqueue, splitBill: enqueue });
    usePrinterStore.setState({ executeInvoice: vi.fn() });
    useToastStore.setState({ show });
    const workflow = renderActionWorkflow(paymentKind);

    await workflow.handlePrintInvoice();
    const operationUuid = enqueue.mock.calls[0][0].operation_uuid;
    show.mock.calls.at(-1)?.[0].action?.onClick({ preventDefault() {} });

    await vi.waitFor(() => expect(show).toHaveBeenCalledTimes(2));
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue.mock.calls[1][0].operation_uuid).toBe(operationUuid);
    expect(browserPrint.render).not.toHaveBeenCalled();
    expect(browserPrint.open).not.toHaveBeenCalled();
    expect(show).toHaveBeenLastCalledWith(expect.objectContaining({ title: "pos.invoicePrintFailed", tone: "error" }));
  });

  it.each(["full", "split"] as const)("browser-prints the first safe manual receipt retry after a committed %s payment", async (paymentKind) => {
    platform.native = false;
    const response = {
      ...committedReceipt(paymentKind),
      pending_query: { print_job_uuid: "receipt-job", login_uuid_fk: "cashier-1" },
    };
    const pay = vi.fn().mockResolvedValue(response);
    const reprint = vi.fn().mockRejectedValue(Object.assign(new Error("Receipt printer unavailable"), {
      payload: { error_code: "DOCUMENT_PRINTER_UNAVAILABLE", ...safeBrowserDocument("receipt") },
    }));
    const execute = vi.fn().mockResolvedValue({ successCount: 0, failedCount: 1, total: 1 });
    const show = vi.fn<typeof originalShowToast>();
    const onCompleted = vi.fn<PaymentDialogProps["onCompleted"]>().mockResolvedValue();
    usePosStore.setState({ createPayment: pay, splitBill: pay, reprintReceipt: reprint });
    usePrinterStore.setState({ executeInvoice: execute });
    useToastStore.setState({ show });

    await renderActionWorkflow(paymentKind, { onCompleted }).submitPayment();
    expect(browserPrint.render).not.toHaveBeenCalled();
    const retry = show.mock.calls.at(-1)?.[0].action;
    expect(retry?.label).toBe("pos.manualReprint");
    retry?.onClick({ preventDefault() {} });

    await vi.waitFor(() => expect(show).toHaveBeenLastCalledWith(expect.objectContaining({
      title: "pos.browserPrintOpened", tone: "info",
    })));
    expect(browserPrint.render).toHaveBeenCalledOnce();
    expect(browserPrint.render).toHaveBeenCalledWith(expect.objectContaining({
      title: "pos.receiptPrintTitle", invoice: "SERVER-SPLIT-2", total: 72_000,
      payment: expect.objectContaining({ paidTotal: 90_000, change: 18_000 }),
    }));
    expect(reprint).toHaveBeenCalledOnce();
    expect(reprint).toHaveBeenCalledWith(expect.objectContaining({
      order_uuid: paymentKind === "split" ? "paid-split-order" : "order-1",
      payment_uuid: "committed-payment-1",
    }));
    expect(pay).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it.each(["full", "split"] as const)("refuses browser fallback after a %s receipt retry lost its enqueue response", async (paymentKind) => {
    platform.native = false;
    const response = {
      ...committedReceipt(paymentKind),
      pending_query: { print_job_uuid: "receipt-job", login_uuid_fk: "cashier-1" },
    };
    const pay = vi.fn().mockResolvedValue(response);
    const reprint = vi.fn()
      .mockRejectedValueOnce(new Error("Receipt enqueue response lost"))
      .mockRejectedValueOnce(Object.assign(new Error("Receipt printer unavailable"), {
        payload: { error_code: "DOCUMENT_PRINTER_UNAVAILABLE", ...safeBrowserDocument("receipt") },
      }));
    const execute = vi.fn().mockResolvedValue({ successCount: 0, failedCount: 1, total: 1 });
    const show = vi.fn<typeof originalShowToast>();
    usePosStore.setState({ createPayment: pay, splitBill: pay, reprintReceipt: reprint });
    usePrinterStore.setState({ executeInvoice: execute });
    useToastStore.setState({ show });

    await renderActionWorkflow(paymentKind).submitPayment();
    show.mock.calls.at(-1)?.[0].action?.onClick({ preventDefault() {} });
    await vi.waitFor(() => expect(show).toHaveBeenCalledTimes(2));
    const operationUuid = reprint.mock.calls[0][0].operation_uuid;
    show.mock.calls.at(-1)?.[0].action?.onClick({ preventDefault() {} });

    await vi.waitFor(() => expect(show).toHaveBeenCalledTimes(3));
    expect(reprint).toHaveBeenCalledTimes(2);
    expect(reprint.mock.calls[1][0].operation_uuid).toBe(operationUuid);
    expect(browserPrint.render).not.toHaveBeenCalled();
    expect(browserPrint.open).not.toHaveBeenCalled();
    expect(pay).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(show).toHaveBeenLastCalledWith(expect.objectContaining({ title: "pos.paymentReceiptPrintFailed", tone: "error" }));
  });

  for (const documentType of ["invoice", "receipt"] as const) {
    it.each(["full", "split"] as const)(`keeps a queued physical ${documentType} failure on the %s printer workflow`, async (paymentKind) => {
      platform.native = false;
      const response = {
        ...(documentType === "receipt" ? committedReceipt(paymentKind) : safeBrowserDocument("invoice")),
        pending_query: { print_job_uuid: "known-physical-job", login_uuid_fk: "cashier-1" },
      };
      const request = vi.fn().mockResolvedValue(response);
      const execute = vi.fn().mockResolvedValue({
        successCount: 0, failedCount: 1, total: 1, errorMessage: "Connection lost after send",
      });
      const show = vi.fn<typeof originalShowToast>();
      const onCompleted = vi.fn<PaymentDialogProps["onCompleted"]>().mockResolvedValue();
      usePosStore.setState({ createPayment: request, printInvoice: request, splitBill: request });
      usePrinterStore.setState({ executeInvoice: execute });
      useToastStore.setState({ show });
      const workflow = renderActionWorkflow(paymentKind, { onCompleted });

      if (documentType === "invoice") await workflow.handlePrintInvoice();
      else await workflow.submitPayment();

      expect(request).toHaveBeenCalledOnce();
      expect(execute).toHaveBeenCalledOnce();
      expect(execute).toHaveBeenCalledWith(expect.objectContaining({ pending_query: response.pending_query }));
      expect(browserPrint.render).not.toHaveBeenCalled();
      expect(browserPrint.open).not.toHaveBeenCalled();
      expect(browserPrint.closeUnused).toHaveBeenCalledOnce();
      expect(show).toHaveBeenLastCalledWith(expect.objectContaining({
        title: documentType === "invoice" ? "pos.invoicePrintFailed" : "pos.paymentReceiptPrintFailed",
        tone: "error", action: expect.objectContaining({ label: "pos.manualReprint" }),
      }));
      expect(onCompleted).toHaveBeenCalledTimes(documentType === "receipt" ? 1 : 0);
    });
  }

  for (const paymentKind of ["full", "split"] as const) {
    it.each([
      "INVOICE_PRINT_PREPARATION_FAILED", "PRINTER_AGENT_AUTHORIZATION_FAILED",
      "PRINTER_AGENT_REGISTRATION_FAILED", "INTERNAL_ERROR",
    ])(`does not browser-print a ${paymentKind} invoice for %s`, async (errorCode) => {
      platform.native = false;
      const error = Object.assign(new Error(errorCode), {
        payload: { error_code: errorCode, ...safeBrowserDocument("invoice") },
      });
      const enqueue = vi.fn().mockRejectedValue(error);
      const execute = vi.fn();
      const show = vi.fn<typeof originalShowToast>();
      usePosStore.setState({ printInvoice: enqueue, splitBill: enqueue });
      usePrinterStore.setState({ executeInvoice: execute });
      useToastStore.setState({ show });

      await renderActionWorkflow(paymentKind).handlePrintInvoice();

      expect(enqueue).toHaveBeenCalledOnce();
      expect(execute).not.toHaveBeenCalled();
      expect(browserPrint.render).not.toHaveBeenCalled();
      expect(browserPrint.open).not.toHaveBeenCalled();
      expect(browserPrint.closeUnused).toHaveBeenCalledOnce();
      expect(show).toHaveBeenLastCalledWith(expect.objectContaining({ title: "pos.invoicePrintFailed", tone: "error" }));
    });
  }

  it.each(["full", "split"] as const)("requires safe_not_queued for a %s invoice fallback", async (paymentKind) => {
    platform.native = false;
    const source = safeBrowserDocument("invoice");
    const enqueue = vi.fn().mockResolvedValue({
      ...source, fallback_print: { ...source.fallback_print, safe_not_queued: false },
    });
    const show = vi.fn<typeof originalShowToast>();
    usePosStore.setState({ printInvoice: enqueue, splitBill: enqueue });
    useToastStore.setState({ show });

    await renderActionWorkflow(paymentKind).handlePrintInvoice();

    expect(browserPrint.render).not.toHaveBeenCalled();
    expect(browserPrint.open).not.toHaveBeenCalled();
    expect(show).toHaveBeenLastCalledWith(expect.objectContaining({ title: "pos.invoicePrintFailed", tone: "error" }));
  });

  for (const target of ["native", "electron"] as const) {
    it.each(["full", "split"] as const)(`finishes ${target} %s payment when its unconfigured receipt role includes a browser-only snapshot`, async (paymentKind) => {
      platform.native = target === "native";
      platform.electron = target === "electron";
      const response = {
        ...committedReceipt(paymentKind),
        print_skipped: { role_code: "receipt", reason: "DOCUMENT_PRINT_ROLE_NOT_CONFIGURED" },
      };
      const pay = vi.fn().mockResolvedValue(response);
      const reprint = vi.fn();
      const execute = vi.fn();
      const show = vi.fn<typeof originalShowToast>();
      const onCompleted = vi.fn<PaymentDialogProps["onCompleted"]>().mockResolvedValue();
      const onOpenChange = vi.fn<PaymentDialogProps["onOpenChange"]>();
      usePosStore.setState({ createPayment: pay, splitBill: pay, reprintReceipt: reprint });
      usePrinterStore.setState({ executeInvoice: execute });
      useToastStore.setState({ show });

      await renderActionWorkflow(paymentKind, { onCompleted, onOpenChange }).submitPayment();

      expect(pay).toHaveBeenCalledOnce();
      expect(onCompleted).toHaveBeenCalledOnce();
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(show).toHaveBeenLastCalledWith(expect.objectContaining({
        title: paymentKind === "split" ? "pos.splitPaymentCreated" : "pos.paymentSuccess", tone: "success",
      }));
      expect(show.mock.calls.some(([toast]) => toast.tone === "error")).toBe(false);
      expect(execute).not.toHaveBeenCalled();
      expect(reprint).not.toHaveBeenCalled();
      expect(browserPrint.reserve).not.toHaveBeenCalled();
      expect(browserPrint.render).not.toHaveBeenCalled();
      expect(browserPrint.open).not.toHaveBeenCalled();
    });

    it.each(["full", "split"] as const)(`keeps ${target} %s invoices out of browser fallback`, async (paymentKind) => {
      platform.native = target === "native";
      platform.electron = target === "electron";
      const enqueue = vi.fn().mockRejectedValue(safeInvoiceError());
      const show = vi.fn<typeof originalShowToast>();
      usePosStore.setState({ printInvoice: enqueue, splitBill: enqueue });
      useToastStore.setState({ show });

      await renderActionWorkflow(paymentKind).handlePrintInvoice();

      expect(browserPrint.reserve).not.toHaveBeenCalled();
      expect(browserPrint.render).not.toHaveBeenCalled();
      expect(browserPrint.open).not.toHaveBeenCalled();
      expect(show).toHaveBeenLastCalledWith(expect.objectContaining({ title: "pos.invoicePrintFailed", tone: "error" }));
    });
  }
});
