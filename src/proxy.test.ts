import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

describe("canonical web origin", () => {
  it("redirects www to the one origin that owns the offline cache", () => {
    const response = proxy(new NextRequest("https://www.yummy-go.com/home?lang=la"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://yummy-go.com/home?lang=la");
  });

  it("does not redirect the canonical site or local app servers", () => {
    expect(proxy(new NextRequest("https://yummy-go.com/home")).headers.get("location")).toBeNull();
    expect(proxy(new NextRequest("http://127.0.0.1:3000/home")).headers.get("location")).toBeNull();
  });
});
