import { describe, expect, it } from "vitest";
import type {
  BrowserOfflineStore,
  BrowserPrintJobEntry,
} from "@/services/offline-db";
import { rebindRetryableMobilePrintEndpoints } from "@/services/mobile-printer-endpoint-rebind";

class MemoryStore implements BrowserOfflineStore {
  readonly jobs = new Map<string, BrowserPrintJobEntry>();
  async getApiCache() { return undefined; }
  async putApiCache() { /* unused */ }
  async pruneApiCache() { /* unused */ }
  async listApiCacheByPath() { return []; }
  async getSyncQueue() { return undefined; }
  async putSyncQueue() { /* unused */ }
  async deleteSyncQueue() { /* unused */ }
  async listSyncQueue() { return []; }
  async getSyncStatus() { return undefined; }
  async putSyncStatus() { /* unused */ }
  async pruneSyncedQueue() { /* unused */ }
  async getPrintJob(uuid: string) { return this.jobs.get(uuid); }
  async putPrintJob(job: BrowserPrintJobEntry) { this.jobs.set(job.printJobUuid, job); }
  async deletePrintJob(uuid: string) { this.jobs.delete(uuid); }
  async listPrintJobs(scope: { storeUuid: string; branchUuid: string }) {
    return [...this.jobs.values()].filter(
      (job) => job.storeUuid === scope.storeUuid && job.branchUuid === scope.branchUuid,
    );
  }
}

const SCOPE = { storeUuid: "store-1", branchUuid: "branch-1" };

function job(status: BrowserPrintJobEntry["status"]): BrowserPrintJobEntry {
  return {
    printJobUuid: `job-${status}`,
    eventUuid: `event-${status}`,
    storeUuid: SCOPE.storeUuid,
    branchUuid: SCOPE.branchUuid,
    actorLoginUuid: "login-1",
    orderUuid: "order-1",
    orderItemUuids: ["item-1"],
    documentType: "KITCHEN",
    printConfigUuid: "old-config",
    interfaceValue: "tcp://192.168.100.52:9100",
    printerName: "Print",
    paperWidthMm: 80,
    openCashDrawer: false,
    lines: [],
    status,
    attempts: status === "FAILED" ? 1 : 0,
    lastError: status === "FAILED" ? "No route to host" : null,
    createdAt: 1,
    updatedAt: 1,
  };
}

function response(rows = [{
  print_config_uuid: "new-config",
  printer_name: "Print",
  interface_value: "tcp://192.168.100.2:9100",
  is_active: true,
}]) {
  return { status: "success", data: { data: rows } };
}

describe("mobile printer endpoint rebind", () => {
  it.each(["PENDING", "FAILED"] as const)(
    "moves %s work to a recreated config and retries it safely",
    async (status) => {
      const store = new MemoryStore();
      await store.putPrintJob(job(status));

      expect(await rebindRetryableMobilePrintEndpoints(SCOPE, response(), store)).toBe(1);
      expect(await store.getPrintJob(`job-${status}`)).toMatchObject({
        status: "PENDING",
        lastError: null,
        printConfigUuid: "new-config",
        interfaceValue: "tcp://192.168.100.2:9100",
      });
    },
  );

  it.each(["PRINTING", "UNCERTAIN", "PRINTED"] as const)(
    "never rebinds %s work that could already have printed",
    async (status) => {
      const store = new MemoryStore();
      await store.putPrintJob(job(status));

      expect(await rebindRetryableMobilePrintEndpoints(SCOPE, response(), store)).toBe(0);
      expect((await store.getPrintJob(`job-${status}`))?.interfaceValue)
        .toBe("tcp://192.168.100.52:9100");
    },
  );

  it("refuses an ambiguous name fallback", async () => {
    const store = new MemoryStore();
    await store.putPrintJob(job("FAILED"));
    const duplicateNames = response([
      { print_config_uuid: "new-1", printer_name: "Print", interface_value: "tcp://192.168.100.2:9100", is_active: true },
      { print_config_uuid: "new-2", printer_name: "print", interface_value: "tcp://192.168.100.3:9100", is_active: true },
    ]);

    expect(await rebindRetryableMobilePrintEndpoints(SCOPE, duplicateNames, store)).toBe(0);
  });
});
