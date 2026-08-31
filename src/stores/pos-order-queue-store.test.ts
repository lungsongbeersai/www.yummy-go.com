import { describe, expect, it } from "vitest";
import {
  aggregateKitchenPrintResults,
  kitchenPrintRequests
} from "@/stores/pos-order-queue-store";

describe("POS order queue kitchen printing", () => {
  it("collects every print job returned by a multi-order batch", () => {
    const requests = kitchenPrintRequests({
      status: "success",
      message: "queued",
      print_jobs: [
        { print_job_uuid: "job-1", login_uuid_fk: "login-1" },
        { print_job_uuid: "job-2", login_uuid_fk: "login-1" }
      ],
      pending_queries: [
        { print_job_uuid: "job-1", login_uuid_fk: "login-1" },
        { print_job_uuid: "job-2", login_uuid_fk: "login-1" }
      ]
    });

    expect(requests).toHaveLength(2);
    expect(requests.map((request) => request.pending_query?.print_job_uuid))
      .toEqual(["job-1", "job-2"]);
    expect(requests.map((request) => request.print_job?.print_job_uuid))
      .toEqual(["job-1", "job-2"]);
  });

  it("preserves the legacy single-job response without duplicating it", () => {
    const requests = kitchenPrintRequests({
      status: "success",
      message: "queued",
      print_job: { print_job_uuid: "job-1" },
      pending_query: { print_job_uuid: "job-1", login_uuid_fk: "login-1" }
    });

    expect(requests).toEqual([{
      print_job: { print_job_uuid: "job-1" },
      pending_query: { print_job_uuid: "job-1", login_uuid_fk: "login-1" }
    }]);
  });

  it("aggregates printed, failed, and pending jobs without losing any count", () => {
    expect(aggregateKitchenPrintResults([
      { successCount: 2, failedCount: 0, total: 2 },
      {
        successCount: 0,
        failedCount: 1,
        total: 1,
        pending: true,
        errorMessage: "printer offline"
      }
    ])).toEqual({
      successCount: 2,
      failedCount: 1,
      total: 3,
      pending: true,
      errorMessage: "printer offline"
    });
  });
});
