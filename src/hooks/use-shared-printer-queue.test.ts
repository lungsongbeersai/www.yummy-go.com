import { describe, expect, it } from "vitest";
import { isSharedPrintJobForLocalOwner } from "@/hooks/use-shared-printer-queue";

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
});
