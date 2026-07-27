import { describe, expect, it } from "vitest";
import {
  reducePageRefreshRegistration,
  type PageRefreshRegistration,
} from "@/components/layout/page-refresh-state";

function registration(id: string): PageRefreshRegistration {
  return {
    busy: false,
    disabled: false,
    id,
    label: `Refresh ${id}`,
    refresh: () => undefined,
  };
}

describe("page refresh registration", () => {
  it("stores a route registration when it is registered", () => {
    const dashboard = registration("dashboard");

    expect(
      reducePageRefreshRegistration(null, { type: "register", registration: dashboard }),
    ).toBe(dashboard);
  });

  it("replaces the current registration when a new route registers", () => {
    const dashboard = registration("dashboard");
    const reports = registration("reports");

    expect(
      reducePageRefreshRegistration(
        dashboard,
        { type: "register", registration: reports },
      ),
    ).toBe(reports);
  });

  it("clears the registration when its owner unregisters", () => {
    const dashboard = registration("dashboard");

    expect(
      reducePageRefreshRegistration(dashboard, { type: "unregister", id: dashboard.id }),
    ).toBeNull();
  });

  it("ignores an unregister event from a stale route registration", () => {
    const dashboard = registration("dashboard");
    const reports = registration("reports");
    const current = reducePageRefreshRegistration(
      reducePageRefreshRegistration(null, { type: "register", registration: dashboard }),
      { type: "register", registration: reports },
    );

    expect(
      reducePageRefreshRegistration(current, {
        type: "unregister",
        id: dashboard.id,
      }),
    ).toBe(reports);
  });
});
