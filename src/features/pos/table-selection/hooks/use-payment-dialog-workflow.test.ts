import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CartOrder, PosTable } from "@/services/pos";
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

vi.mock("@/lib/capacitor-platform", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/capacitor-platform")>(),
  isCapacitorMobileApp: () => true,
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

describe("payment dialog workflow", () => {
  const restoreSsrSnapshots: (() => void)[] = [];
  const originalPosActions = {
    printInvoice: usePosStore.getState().printInvoice,
    splitBill: usePosStore.getState().splitBill,
  };
  const originalExecuteInvoice = usePrinterStore.getState().executeInvoice;
  const originalShowToast = useToastStore.getState().show;
  beforeEach(() => {
    useAppStore.setState({ language: "la" });
    useAuthStore.setState({ user: null });
    useReferenceStore.setState({
      options: {},
      loadingKeys: {},
    });
  });

  afterEach(() => {
    for (const restore of restoreSsrSnapshots.splice(0)) restore();
    vi.restoreAllMocks();
    usePosStore.setState(originalPosActions);
    usePrinterStore.setState({ executeInvoice: originalExecuteInvoice });
    useToastStore.setState({ show: originalShowToast });
  });

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
    useAuthStore.setState({ user: {
      uuid: "cashier-1", email: "", status: 1, profile: "",
      branch_uuid: "branch-1", branch_name: "", branch_tel: "", branch_address: "",
      store_uuid: "store-1", store_name: "", store_logo: "", store_table_status: 1,
    } });
    const enqueue = vi.fn().mockRejectedValueOnce(new Error("Enqueue response lost")).mockResolvedValue({
      pending_query: { print_job_uuid: "invoice-job", login_uuid_fk: "cashier-1" },
    });
    usePosStore.setState({ printInvoice: enqueue, splitBill: enqueue });
    usePrinterStore.setState({ executeInvoice: vi.fn().mockResolvedValue({ successCount: 1, failedCount: 0, total: 1 }) });
    const show = vi.fn<typeof originalShowToast>();
    useToastStore.setState({ show });
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
      });
      onReady(workflow);
      return null;
    }
    renderToString(createElement(ActionHarness, { onReady: capture }));
    const workflow = capture.mock.calls.at(-1)?.[0];
    if (!workflow) throw new Error("Workflow was not rendered");
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
});
