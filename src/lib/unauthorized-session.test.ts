import { describe, expect, it } from "vitest";
import { shouldLogoutForUnauthorized } from "@/lib/unauthorized-session";

describe("shouldLogoutForUnauthorized", () => {
  it("logs out when the rejected request belongs to the active session", () => {
    expect(
      shouldLogoutForUnauthorized({
        currentToken: "current-token",
        isLoggedIn: true,
        requestToken: "current-token",
        status: 401,
      }),
    ).toBe(true);
  });

  it.each([
    { requestToken: "old-token", status: 401 },
    { requestToken: null, status: 401 },
    { requestToken: "current-token", status: 403 },
  ])("keeps the active session for an unrelated response", (input) => {
    expect(
      shouldLogoutForUnauthorized({
        currentToken: "current-token",
        isLoggedIn: true,
        ...input,
      }),
    ).toBe(false);
  });

  it("does nothing when there is no active login", () => {
    expect(
      shouldLogoutForUnauthorized({
        currentToken: "current-token",
        isLoggedIn: false,
        requestToken: "current-token",
        status: 401,
      }),
    ).toBe(false);
  });
});
