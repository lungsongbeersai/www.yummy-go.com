import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configureLocalSync,
  needsLocalPrintOwnership,
  prepareOfflineRequest,
  resetLocalSyncConfiguration,
  supportsOfflineRoute,
  withLocalPrintOwnership,
} from "@/services/offline-sync";

afterEach(() => {
  resetLocalSyncConfiguration();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("offline sync transport", () => {
  it("keeps unsupported mutations on the existing online-only flow", () => {
    expect(supportsOfflineRoute("post", "/api/v1/product/create")).toBe(false);
    expect(prepareOfflineRequest("post", "/api/v1/product/create", { data: { name: "x" } })).toEqual({
      eventUuid: null,
      options: { data: { name: "x" } },
    });
  });

  it("assigns stable order, item, stock and event UUIDs before the online attempt", () => {
    const prepared = prepareOfflineRequest("post", "/api/v1/posAll/create_order", {
      data: { items: [{ prod_detail_uuid_fk: "detail-1", order_it_qty: 2 }] },
    });
    const data = prepared.options?.data as {
      sync_event_uuid: string;
      order_uuid: string;
      items: Array<{ order_it_uuid: string; stock_event_uuid: string }>;
    };
    expect(data.sync_event_uuid).toBe(prepared.eventUuid);
    expect(data.order_uuid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(data.items[0].order_it_uuid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(data.items[0].stock_event_uuid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(prepared.options?.headers?.["x-sync-event-uuid"]).toBe(prepared.eventUuid);
  });

  it("preserves caller supplied idempotency UUIDs", () => {
    const eventUuid = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const paymentUuid = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const prepared = prepareOfflineRequest("post", "/api/v1/posAll/payment", {
      data: { sync_event_uuid: eventUuid, payment_uuid: paymentUuid },
    });
    expect(prepared.eventUuid).toBe(eventUuid);
    expect(prepared.options?.data).toMatchObject({ sync_event_uuid: eventUuid, payment_uuid: paymentUuid });
  });

  it("allows GET fallback from the exact local response cache", () => {
    expect(supportsOfflineRoute("get", "/api/v1/posAll/fetch_table")).toBe(true);
    expect(supportsOfflineRoute("get", "/api/v1/posAll/customer_order_queue?status=1")).toBe(true);
    expect(supportsOfflineRoute("get", "/api/v1/dashboard/executive")).toBe(false);
    expect(supportsOfflineRoute("get", "/api/v1/permission/menu")).toBe(false);
    expect(supportsOfflineRoute("post", "/api/v1/posAll/get_prod_item")).toBe(true);
    expect(supportsOfflineRoute("post", "/api/v1/posAll/init_order_without_table")).toBe(true);
    expect(supportsOfflineRoute("get", "/api/v1/posAll/fetch_join_move_table")).toBe(true);
    expect(supportsOfflineRoute("get", "/api/v1/posAll/admin/create_table_qr")).toBe(true);
    expect(supportsOfflineRoute("post", "/api/v1/posAll/move_table")).toBe(true);
    expect(supportsOfflineRoute("post", "/api/v1/posAll/join_table_multi")).toBe(true);
    expect(supportsOfflineRoute("post", "/api/v1/posAll/split_bill")).toBe(true);
    expect(supportsOfflineRoute("post", "/api/v1/posAll/print_invoice")).toBe(true);
    expect(supportsOfflineRoute("post", "/api/v1/posAll/reprint_receipt")).toBe(true);
    expect(supportsOfflineRoute("patch", "/api/v1/posAll/customer_order_queue/send_to_kitchen")).toBe(true);
  });

  it("assigns stable split order, payment and partial-item UUIDs before the online attempt", () => {
    const prepared = prepareOfflineRequest("post", "/api/v1/posAll/split_bill", {
      data: {
        order_uuid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        order_item_uuids: [{ "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb": 2 }],
      },
    });
    const data = prepared.options?.data as Record<string, unknown>;
    expect(data.new_order_uuid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(data.payment_uuid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(data.new_order_invoice).toMatch(/^OFF-SPLIT-/);
    expect(data.split_item_uuid_map).toMatchObject({
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb": expect.stringMatching(/^[0-9a-f-]{36}$/i),
    });
  });

  it("assigns a stable Local Agent event to table QR printing", () => {
    const prepared = prepareOfflineRequest("get", "/api/v1/posAll/admin/create_table_qr", {
      params: { table_uuid: "table-1" },
    });
    expect(prepared.eventUuid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(prepared.options?.data).toMatchObject({ sync_event_uuid: prepared.eventUuid });
  });

  it("marks only physical print mutations for Local Agent ownership", () => {
    expect(needsLocalPrintOwnership("patch", "/api/v1/posAll/confirm_to_kitchen")).toBe(true);
    expect(needsLocalPrintOwnership("post", "/api/v1/posAll/print_invoice")).toBe(true);
    expect(needsLocalPrintOwnership("post", "/api/v1/posAll/payment")).toBe(true);
    expect(needsLocalPrintOwnership("get", "/api/v1/posAll/admin/create_table_qr")).toBe(true);
    expect(needsLocalPrintOwnership("post", "/api/v1/posAll/create_order")).toBe(false);
    expect(withLocalPrintOwnership({ data: { order_uuid: "order-1" } }).data).toEqual({
      order_uuid: "order-1",
      local_agent_print: true,
    });
    expect(withLocalPrintOwnership({ params: { table_uuid: "table-1" } }, "get").params).toEqual({
      table_uuid: "table-1",
      local_agent_print: true,
    });
  });

  it("retries Local Agent configuration after a temporary startup failure", async () => {
    vi.stubGlobal("window", { location: { origin: "https://pos.example.test" } });
    const post = vi.spyOn(axios, "post")
      .mockRejectedValueOnce(new Error("agent starting"))
      .mockResolvedValueOnce({ data: { ok: true } });
    const identity = {
      token: "token-value",
      actorLoginUuid: "login-1",
      storeUuid: "store-1",
      branchUuid: "branch-1",
    };

    await expect(configureLocalSync(identity)).resolves.toBe(false);
    await expect(configureLocalSync(identity)).resolves.toBe(true);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0]?.[2]).toMatchObject({ timeout: 2000 });
  });
});
