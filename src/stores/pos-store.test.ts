import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePrinterDeviceContext } from "@/services/printer";
import {
  confirmToKitchen,
  reprintReceipt,
  splitBill,
  type ConfirmToKitchenResponse,
  type ReprintReceiptResponse,
  type SplitBillResponse
} from "@/services/pos";
import { usePosStore } from "@/stores/pos-store";
import { usePrinterStore } from "@/stores/printer-store";
import { resetSessionStores } from "@/stores/session-store-registry";

vi.mock("@/services/printer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/printer")>();
  return {
    ...actual,
    resolvePrinterDeviceContext: vi.fn()
  };
});

vi.mock("@/services/pos", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/pos")>();
  return {
    ...actual,
    confirmToKitchen: vi.fn(),
    reprintReceipt: vi.fn(),
    splitBill: vi.fn()
  };
});

const confirmToKitchenMock = vi.mocked(confirmToKitchen);
const reprintReceiptMock = vi.mocked(reprintReceipt);
const splitBillMock = vi.mocked(splitBill);
const resolvePrinterDeviceContextMock = vi.mocked(resolvePrinterDeviceContext);
const originalExecuteKitchen = usePrinterStore.getState().executeKitchen;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("POS store session follow-up requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePrinterStore.setState({ executeKitchen: originalExecuteKitchen });
    usePosStore.getState().reset();
    usePrinterStore.getState().reset();
  });

  it("does not confirm an order after printer resolution crosses a session boundary", async () => {
    const context = deferred<Awaited<ReturnType<typeof resolvePrinterDeviceContext>>>();
    resolvePrinterDeviceContextMock.mockReturnValueOnce(context.promise);

    const confirm = usePosStore.getState().confirmKitchen({
      order_uuid: "order-1",
      login_uuid_fk: "login-1"
    });
    resetSessionStores();
    context.resolve({
      agent_id: "agent-1",
      device_code: "device-1",
      print_mode: "local_agent"
    });

    await expect(confirm).rejects.toThrow("Session changed while the request was in progress");
    expect(confirmToKitchenMock).not.toHaveBeenCalled();
  });

  it("does not execute a kitchen print returned to a previous session", async () => {
    const response = deferred<ConfirmToKitchenResponse>();
    const executeKitchenMock = vi.fn().mockResolvedValue({
      failedCount: 0,
      successCount: 1,
      total: 1
    });
    resolvePrinterDeviceContextMock.mockResolvedValueOnce({
      agent_id: "agent-1",
      device_code: "device-1",
      print_mode: "local_agent"
    });
    confirmToKitchenMock.mockReturnValueOnce(response.promise);
    usePrinterStore.setState({ executeKitchen: executeKitchenMock });

    const confirm = usePosStore.getState().confirmKitchen({
      order_uuid: "order-1",
      login_uuid_fk: "login-1"
    });
    await vi.waitFor(() => expect(confirmToKitchenMock).toHaveBeenCalledOnce());
    resetSessionStores();
    const result: ConfirmToKitchenResponse = {
      message: "ok",
      pending_query: {
        print_job_uuid: "job-1",
        login_uuid_fk: "login-1"
      },
      status: "success"
    };
    response.resolve(result);

    await expect(confirm).resolves.toEqual(result);
    expect(executeKitchenMock).not.toHaveBeenCalled();
  });

  it("builds a reprint pending query from the local printer context", async () => {
    resolvePrinterDeviceContextMock.mockResolvedValueOnce({
      agent_id: "local-agent",
      device_code: "local-device",
      print_mode: "windows_agent"
    });
    reprintReceiptMock.mockResolvedValueOnce({
      print_job: { print_job_uuid: " job-1 " },
      pending_query: {
        print_job_uuid: "ignored-job",
        login_uuid_fk: "ignored-login",
        device_code: "ignored-device",
        agent_id: "ignored-agent",
        print_mode: "ignored-mode"
      }
    } as ReprintReceiptResponse & {
      pending_query: {
        print_job_uuid: string;
        login_uuid_fk: string;
        device_code: string;
        agent_id: string;
        print_mode: string;
      };
    });

    const result = await usePosStore.getState().reprintReceipt({
      order_uuid: "order-1",
      login_uuid_fk: "login-1",
      lang: "la"
    });

    expect(reprintReceiptMock).toHaveBeenCalledWith({
      order_uuid: "order-1",
      login_uuid_fk: "login-1",
      lang: "la",
      device_code: "local-device",
      agent_id: "local-agent",
      print_mode: "windows_agent"
    });
    expect(result).toEqual({
      print_job_uuid: "job-1",
      login_uuid_fk: "login-1",
      device_code: "local-device",
      agent_id: "local-agent",
      print_mode: "windows_agent"
    });
  });

  it("returns null when the reprint response has no usable job UUID", async () => {
    resolvePrinterDeviceContextMock.mockResolvedValueOnce({
      agent_id: "agent-1",
      device_code: "device-1",
      print_mode: "windows_agent"
    });
    reprintReceiptMock.mockResolvedValueOnce({
      print_job: { print_job_uuid: "   " }
    });

    await expect(usePosStore.getState().reprintReceipt({
      order_uuid: "order-1",
      login_uuid_fk: "login-1"
    })).resolves.toBeNull();
  });

  it("adds local printer context to split invoice requests", async () => {
    resolvePrinterDeviceContextMock.mockResolvedValueOnce({
      agent_id: "include-f8e4f9",
      device_code: "INCLUDE",
      print_mode: "windows_agent"
    });
    const response: SplitBillResponse = {
      print_job: { print_job_uuid: "job-1" },
      status: "success"
    };
    splitBillMock.mockResolvedValueOnce(response);

    const input = {
      order_uuid: "532f836f-d580-4244-b2fa-615526292b73",
      order_item_uuids: ["221aa39e-a6b7-4fcb-be26-dc0255bc10d2"],
      document_type: "invoice" as const,
      order_channel: 1 as const,
      customer_uuid_fk: "95eed663-1bad-4b2d-99c8-07676be13e94",
      payment_method: 1 as const,
      amount: 63840,
      cash_payment_amount: 63840,
      transfer_payment_amount: 0,
      change_amount: 0,
      note: "split bill cash payment",
      lang: "la" as const,
      login_uuid_fk: "fc445438-e617-471c-9af3-262ae747932f"
    };

    await expect(usePosStore.getState().splitBill(input)).resolves.toEqual(response);
    expect(splitBillMock).toHaveBeenCalledWith({
      ...input,
      device_code: "INCLUDE",
      agent_id: "include-f8e4f9",
      print_mode: "windows_agent"
    });
  });

  it("does not request a reprint after printer resolution crosses a session boundary", async () => {
    const context = deferred<Awaited<ReturnType<typeof resolvePrinterDeviceContext>>>();
    resolvePrinterDeviceContextMock.mockReturnValueOnce(context.promise);

    const reprint = usePosStore.getState().reprintReceipt({
      order_uuid: "order-1",
      login_uuid_fk: "login-1"
    });
    resetSessionStores();
    context.resolve({
      agent_id: "agent-1",
      device_code: "device-1",
      print_mode: "windows_agent"
    });

    await expect(reprint).rejects.toThrow("Session changed while the request was in progress");
    expect(reprintReceiptMock).not.toHaveBeenCalled();
  });

  it("rejects a reprint response returned to a previous session", async () => {
    const response = deferred<ReprintReceiptResponse>();
    resolvePrinterDeviceContextMock.mockResolvedValueOnce({
      agent_id: "agent-1",
      device_code: "device-1",
      print_mode: "windows_agent"
    });
    reprintReceiptMock.mockReturnValueOnce(response.promise);

    const reprint = usePosStore.getState().reprintReceipt({
      order_uuid: "order-1",
      login_uuid_fk: "login-1"
    });
    await vi.waitFor(() => expect(reprintReceiptMock).toHaveBeenCalledOnce());
    resetSessionStores();
    response.resolve({ print_job: { print_job_uuid: "job-1" } });

    await expect(reprint).rejects.toThrow("Session changed while the request was in progress");
  });
});
