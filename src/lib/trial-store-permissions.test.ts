import { describe, expect, it } from "vitest";
import {
  canConfigureTrialStorePermissions,
  resolveTrialPermissionContext,
  trialStorePermissionsRoute,
  TRIAL_PERMISSION_ROLE_ID,
} from "@/lib/trial-store-permissions";

const plcAdmin = { status: 1, store_status: 1 };
const options = {
  stores: [
    { store_uuid: "Trial-Store-UUID", store_name: "Demo store", store_status: 3, store_active: 1 },
    { store_uuid: "inactive-trial", store_name: "Inactive demo", store_status: 3, store_active: 2 },
    { store_uuid: "general-store", store_name: "General store", store_status: 2 },
    { store_uuid: "plc-store", store_name: "PLC store", store_status: 1 },
    { store_uuid: "unclassified-store", store_name: "Unclassified store" },
  ],
  roles: [
    { roles_id: 1, role_name: "PLC administrator" },
    { roles_id: 2, role_name: "Head office administrator" },
    { roles_id: 3, role_name: "Branch administrator" },
  ],
};

describe("trial-store permission configuration scope", () => {
  it("uses the real trial login role without promoting the store or user", () => {
    expect(TRIAL_PERMISSION_ROLE_ID).toBe(3);
    expect(canConfigureTrialStorePermissions(plcAdmin)).toBe(true);
  });

  it.each([
    null,
    undefined,
    {},
    { status: 1 },
    { store_status: 1 },
    { status: 1, store_status: 2 },
    { status: 1, store_status: 3 },
    { status: 2, store_status: 1 },
    { status: 3, store_status: 1 },
    { status: 3, store_status: 3 },
  ])("rejects a viewer outside the PLC administrator scope: %j", (viewer) => {
    expect(canConfigureTrialStorePermissions(viewer)).toBe(false);
    expect(resolveTrialPermissionContext(viewer, "Trial-Store-UUID", "3", options)).toBeNull();
  });
});

describe("trial-store permission context", () => {
  it.each([null, "3", " 3 ", "3.0"])("selects an authorized trial store with role query %j", (roleId) => {
    expect(resolveTrialPermissionContext(plcAdmin, "  tRiAl-StOrE-UuId  ", roleId, options)).toEqual({
      storeUuid: "Trial-Store-UUID",
      roleId: 3,
    });
  });

  it("allows configuring an inactive trial store without changing its public availability", () => {
    expect(resolveTrialPermissionContext(plcAdmin, "inactive-trial", null, options)).toEqual({
      storeUuid: "inactive-trial",
      roleId: 3,
    });
  });

  it.each(["", "  ", "unknown-store", "general-store", "plc-store", "unclassified-store"])(
    "rejects an unavailable or non-trial target: %j",
    (storeUuid) => {
      expect(resolveTrialPermissionContext(plcAdmin, storeUuid, "3", options)).toBeNull();
    },
  );

  it.each(["1", "2", "4", "", " ", "invalid", "NaN", "Infinity"])(
    "rejects a role query that cannot select the trial role: %j",
    (roleId) => {
      expect(resolveTrialPermissionContext(plcAdmin, "Trial-Store-UUID", roleId, options)).toBeNull();
    },
  );

  it("never selects a store missing from the authorized options", () => {
    expect(resolveTrialPermissionContext(plcAdmin, "Trial-Store-UUID", "3", { ...options, stores: [] })).toBeNull();
  });

  it("never selects the trial role when it is absent from the authorized options", () => {
    expect(resolveTrialPermissionContext(plcAdmin, "Trial-Store-UUID", "3", {
      ...options,
      roles: options.roles.filter((role) => role.roles_id !== 3),
    })).toBeNull();
  });
});

describe("trial-store permission shortcut URL", () => {
  it("encodes the target so reserved characters cannot replace the role or escape the internal route", () => {
    const storeUuid = "demo/store ?&role_id=1#ລາວ";
    const route = trialStorePermissionsRoute(storeUuid);
    const url = new URL(route, "https://example.test");

    expect(route).toBe(`/settings/manage-access-permissions?store_uuid=${encodeURIComponent(storeUuid)}&role_id=3`);
    expect(url.pathname).toBe("/settings/manage-access-permissions");
    expect(url.searchParams.get("store_uuid")).toBe(storeUuid);
    expect(url.searchParams.getAll("role_id")).toEqual(["3"]);
    expect(url.hash).toBe("");
  });
});
