import { describe, expect, it } from "vitest";
import {
  isSharedPrintJobForLocalOwner,
  sharedPrintExecutionKind,
} from "@/hooks/use-shared-printer-queue";

const windowsOwner = {
  agent_id: "windows-agent",
  agent_name: "Windows Owner",
  device_code: "WINDOWS-OWNER",
};

describe("shared printer owner queue", () => {
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
