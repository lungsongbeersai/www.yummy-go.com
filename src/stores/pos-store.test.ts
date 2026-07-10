import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePrinterDeviceContext } from "@/services/printer";
import { confirmToKitchen, type ConfirmToKitchenResponse } from "@/services/pos";
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
    confirmToKitchen: vi.fn()
  };
});

const confirmToKitchenMock = vi.mocked(confirmToKitchen);
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
});
