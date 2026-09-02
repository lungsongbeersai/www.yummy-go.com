import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BACKEND_NETWORK_STATE } from "@/lib/network-state";
import {
  configureLocalSync,
  getLocalSyncStatus,
  localSyncHasRetryableWork,
  needsLocalPrintOwnership,
  prepareOfflineRequest,
  resetLocalSyncConfiguration,
  runLocalSyncNow,
  shouldPreferOnlineTransport,
  shouldRouteToLocal,
  shouldUseLocalPrintOwnership,
  supportsOfflineRoute,
  withLocalPrintOwnership,
} from "@/services/offline-sync";

afterEach(() => {
  resetLocalSyncConfiguration();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("offline sync transport", () => {
  it("prefers Backend for a normal token whenever the browser is online", () => {
    expect(shouldPreferOnlineTransport("backend-token", BACKEND_NETWORK_STATE.CHECKING, false)).toBe(true);
    expect(shouldPreferOnlineTransport("backend-token", BACKEND_NETWORK_STATE.ONLINE, false)).toBe(true);
    expect(shouldPreferOnlineTransport("backend-token", BACKEND_NETWORK_STATE.OFFLINE, false)).toBe(false);
    expect(shouldPreferOnlineTransport("local.session-token", BACKEND_NETWORK_STATE.ONLINE, false)).toBe(false);
  });

  it("stops preferring Backend once the browser itself reports no network", () => {
    expect(shouldPreferOnlineTransport("backend-token", BACKEND_NETWORK_STATE.CHECKING, true)).toBe(false);
    expect(shouldPreferOnlineTransport("backend-token", BACKEND_NETWORK_STATE.ONLINE, true)).toBe(false);
  });

  it("routes a supported read to the Agent when the browser reports no network", () => {
    expect(
      shouldRouteToLocal(
        false,
        BACKEND_NETWORK_STATE.CHECKING,
        "get",
        "/api/v1/posAll/fetch_cate_products",
        true,
      ),
    ).toBe(true);
    // navigator offline still cannot route an endpoint that has no offline path.
    expect(
      shouldRouteToLocal(
        false,
        BACKEND_NETWORK_STATE.CHECKING,
        "post",
        "/api/v1/product/create",
        true,
      ),
    ).toBe(false);
  });

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
    expect(supportsOfflineRoute("get", "/api/v1/product/fetch_limit")).toBe(true);
    expect(supportsOfflineRoute("get", "/api/v1/product/stock_qty")).toBe(true);
    expect(supportsOfflineRoute("get", "/api/v1/report_all/sale_list")).toBe(true);
    expect(supportsOfflineRoute("get", "/api/v1/report_all/daily_closing")).toBe(true);
    expect(supportsOfflineRoute("get", "/api/v1/report_all/sale_report_bill")).toBe(true);
    expect(supportsOfflineRoute("get", "/api/v1/report_all/sale_report_list")).toBe(true);
    expect(supportsOfflineRoute("get", "/api/v1/report_all/payment_summary_by_method")).toBe(true);
    expect(supportsOfflineRoute("get", "/api/v1/report_all/group_list")).toBe(true);
    expect(supportsOfflineRoute("get", "/api/v1/best_selling/best_selling_products")).toBe(true);
    expect(supportsOfflineRoute("get", "/api/v1/register/fetch_limit")).toBe(true);
    expect(supportsOfflineRoute("post", "/api/v1/status/fetch_size")).toBe(true);
    expect(supportsOfflineRoute("get", "/api/v1/dashboard/executive")).toBe(true);
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

  it("routes only after NetworkManager confirms OFFLINE and ignores Agent sync state", () => {
    expect(
      shouldRouteToLocal(
        false,
        BACKEND_NETWORK_STATE.OFFLINE,
        "get",
        "/api/v1/posAll/fetch_table",
      ),
    ).toBe(true);
    expect(
      shouldRouteToLocal(
        false,
        BACKEND_NETWORK_STATE.CHECKING,
        "get",
        "/api/v1/posAll/fetch_table",
      ),
    ).toBe(false);
    expect(
      shouldRouteToLocal(
        false,
        BACKEND_NETWORK_STATE.ONLINE,
        "get",
        "/api/v1/posAll/fetch_table",
      ),
    ).toBe(false);
    expect(
      shouldRouteToLocal(
        false,
        BACKEND_NETWORK_STATE.OFFLINE,
        "post",
        "/api/v1/product/create",
      ),
    ).toBe(false);
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
    expect(data).not.toHaveProperty("new_order_invoice");
    expect(data.split_item_uuid_map).toMatchObject({
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb": expect.stringMatching(/^[0-9a-f-]{36}$/i),
    });
  });

  it("assigns a stable cancelled-item UUID for partial cancellation replay", () => {
    const prepared = prepareOfflineRequest("patch", "/api/v1/posAll/cancel_order_item", {
      data: {
        order_it_uuid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        order_it_qty: 1,
      },
    });
    expect(prepared.options?.data).toMatchObject({
      sync_event_uuid: prepared.eventUuid,
      stock_event_uuid: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      cancelled_order_item_uuid: expect.stringMatching(/^[0-9a-f-]{36}$/i),
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

  it("keeps the established Backend print template while the session is online", () => {
    expect(
      shouldUseLocalPrintOwnership(
        false,
        "patch",
        "/api/v1/posAll/confirm_to_kitchen",
      ),
    ).toBe(false);
    expect(
      shouldUseLocalPrintOwnership(
        true,
        "patch",
        "/api/v1/posAll/confirm_to_kitchen",
      ),
    ).toBe(true);
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

  it("reuses the matching Agent scope without sending a local token to Backend", async () => {
    vi.stubGlobal("window", { location: { origin: "https://pos.example.test" } });
    vi.stubGlobal("navigator", { onLine: true });
    const get = vi.spyOn(axios, "get").mockResolvedValue({
      data: {
        ok: true,
        data: {
          configured: true,
          bootstrap_complete: true,
          store_uuid: "store-1",
          branch_uuid: "branch-1",
          actor_login_uuid: "login-1",
        },
      },
    });
    const post = vi.spyOn(axios, "post");

    await expect(configureLocalSync({
      token: "local.session-token",
      actorLoginUuid: "login-1",
      storeUuid: "store-1",
      branchUuid: "branch-1",
    })).resolves.toBe(true);
    expect(get).toHaveBeenCalledOnce();
    expect(post).not.toHaveBeenCalled();
  });

  it("does not resume online while retryable local work remains", () => {
    expect(localSyncHasRetryableWork({
      bootstrap_complete: true,
      pending: { pending: 1, processing: 0, failed: 0, blocked: 0 },
    })).toBe(true);
    expect(localSyncHasRetryableWork({
      bootstrap_complete: true,
      pending: { pending: 0, processing: 0, failed: 0, blocked: 1 },
    })).toBe(false);
  });

  it("runs an immediate recovery cycle and confirms the Agent is online", async () => {
    vi.stubGlobal("window", { location: { origin: "https://pos.example.test" } });
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { ok: true } });
    const get = vi.spyOn(axios, "get").mockResolvedValue({
      data: {
        ok: true,
        data: {
          bootstrap_complete: true,
          connection_state: "ONLINE",
          pending: { pending: 0, processing: 0, failed: 0, blocked: 0 },
        },
      },
    });

    await expect(runLocalSyncNow()).resolves.toMatchObject({ connection_state: "ONLINE" });
    await expect(getLocalSyncStatus()).resolves.toMatchObject({ connection_state: "ONLINE" });
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining("/local/sync/run"),
      {},
      { timeout: 40000 },
    );
    expect(get).toHaveBeenCalledOnce();
  });
});
