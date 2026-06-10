import { describe, expect, it, vi } from "vitest";
import { refreshPermissionSidebarMenu } from "./permission-menu-sidebar-refresh";

describe("refreshPermissionSidebarMenu", () => {
  it("loads sidebar menu with store, role status, and language", async () => {
    const loadSidebarMenu = vi.fn().mockResolvedValue(undefined);

    await expect(
      refreshPermissionSidebarMenu({
        language: "la",
        loadSidebarMenu,
        status: 1,
        storeUuid: " store-1 "
      })
    ).resolves.toBe(true);

    expect(loadSidebarMenu).toHaveBeenCalledWith("store-1", 1, "la");
  });

  it("skips refresh without a store uuid", async () => {
    const loadSidebarMenu = vi.fn().mockResolvedValue(undefined);

    await expect(
      refreshPermissionSidebarMenu({
        language: "la",
        loadSidebarMenu,
        status: 1,
        storeUuid: " "
      })
    ).resolves.toBe(false);

    expect(loadSidebarMenu).not.toHaveBeenCalled();
  });

  it("skips refresh without a valid status", async () => {
    const loadSidebarMenu = vi.fn().mockResolvedValue(undefined);

    await expect(
      refreshPermissionSidebarMenu({
        language: "la",
        loadSidebarMenu,
        status: undefined,
        storeUuid: "store-1"
      })
    ).resolves.toBe(false);

    expect(loadSidebarMenu).not.toHaveBeenCalled();
  });

  it("keeps manage menu actions successful when sidebar refresh fails", async () => {
    const loadSidebarMenu = vi.fn().mockRejectedValue(new Error("offline"));

    await expect(
      refreshPermissionSidebarMenu({
        language: "la",
        loadSidebarMenu,
        status: 2,
        storeUuid: "store-1"
      })
    ).resolves.toBe(false);

    expect(loadSidebarMenu).toHaveBeenCalledWith("store-1", 2, "la");
  });
});
