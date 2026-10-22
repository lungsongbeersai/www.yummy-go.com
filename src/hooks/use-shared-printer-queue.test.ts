import { describe, expect, it } from "vitest";
import {
  isSharedPrinterOwnerReady,
  isSharedPrintJobForLocalOwner,
  sharedPrintExecutionKind,
  sharedPrinterOwnerPendingQuery,
} from "@/hooks/use-shared-printer-queue";

const windowsOwner = {
  agent_id: "windows-agent",
  agent_name: "Windows Owner",
  device_code: "WINDOWS-OWNER",
};

describe("shared printer owner queue", () => {
  it("discovers native mobile assignments even when its recovered identity has a browser platform", () => {
    expect(sharedPrinterOwnerPendingQuery(" cashier ", {
      agent_id: " mobile ",
      agent_name: "Native phone",
      device_code: " PHONE ",
      platform: "browser",
    }, true)).toEqual({
      print_job_uuid: "",
      login_uuid_fk: "cashier",
      device_code: "PHONE",
      agent_id: "mobile",
      print_mode: "mobile_wifi",
      agent_ready: true,
      refs_only: true,
    });
  });

  it("includes the macOS physical mode when discovering its assigned Internet printers", () => {
    expect(sharedPrinterOwnerPendingQuery("cashier", {
      agent_id: "mac-agent",
      agent_name: "Mac owner",
      device_code: "MAC",
      platform: "darwin",
    })).toEqual({
      print_job_uuid: "",
      login_uuid_fk: "cashier",
      device_code: "MAC",
      agent_id: "mac-agent",
      print_mode: "mac_agent",
      agent_ready: true,
      refs_only: true,
    });
  });

  it("keeps Windows owner discovery on its physical platform mode", () => {
    expect(sharedPrinterOwnerPendingQuery("cashier", {
      ...windowsOwner,
      platform: "win32",
    })).toEqual({
      print_job_uuid: "",
      login_uuid_fk: "cashier",
      device_code: "WINDOWS-OWNER",
      agent_id: "windows-agent",
      print_mode: "windows_agent",
      agent_ready: true,
      refs_only: true,
    });
  });

  it("does not advertise a cached desktop owner when its Local Agent is offline", () => {
    expect(isSharedPrinterOwnerReady({
      ok: true,
      agent: windowsOwner,
      connected: false,
      error: "Network Error",
    })).toBe(false);

    expect(isSharedPrinterOwnerReady({ ok: true, agent: windowsOwner })).toBe(true);
    expect(isSharedPrinterOwnerReady({ ok: false, error: "Network Error" })).toBe(false);
    expect(isSharedPrinterOwnerReady({
      ok: true,
      agent: { ...windowsOwner, agent_id: "desktop" },
    })).toBe(false);
    expect(isSharedPrinterOwnerReady({
      ok: true,
      agent: { ...windowsOwner, agent_id: "mobile" },
    }, true)).toBe(true);
  });

  it("accepts a remote job only on its target owner", () => {
    expect(
      isSharedPrintJobForLocalOwner(
        {
          print_job_uuid: "job-1",
          device_code: "WINDOWS-OWNER",
          agent_id: "windows-agent",
          remote_shared_print: true,
        },
        windowsOwner,
      ),
    ).toBe(true);

    expect(
      isSharedPrintJobForLocalOwner(
        {
          print_job_uuid: "job-1",
          device_code: "MAC-OWNER",
          agent_id: "mac-agent",
          remote_shared_print: true,
        },
        windowsOwner,
      ),
    ).toBe(false);
  });

  it("does not pick up a local job that the current cashier already executes", () => {
    expect(
      isSharedPrintJobForLocalOwner(
        {
          print_job_uuid: "job-2",
          device_code: "WINDOWS-OWNER",
          agent_id: "windows-agent",
          remote_shared_print: false,
        },
        windowsOwner,
      ),
    ).toBe(false);
  });

  it("uses document semantics for shared invoices and reports", () => {
    expect(sharedPrintExecutionKind({
      print_job_uuid: "invoice-job",
      source: "print_invoice",
    })).toBe("invoice");
    expect(sharedPrintExecutionKind({
      print_job_uuid: "report-job",
      source: "report",
    })).toBe("report");
  });

  it("keeps kitchen semantics for kitchen and unknown sources", () => {
    expect(sharedPrintExecutionKind({
      print_job_uuid: "kitchen-job",
      source: "confirm_to_kitchen",
    })).toBe("kitchen");
    expect(sharedPrintExecutionKind({
      print_job_uuid: "legacy-job",
    })).toBe("kitchen");
  });
});
