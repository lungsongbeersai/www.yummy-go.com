import { describe, expect, it } from "vitest";
import { formatIpInput } from "@/features/printer/form/printer-form-utils";

describe("formatIpInput", () => {
  it("auto-inserts a dot after every 3 digits while typing forward", () => {
    let value = "";
    for (const key of "192168".split("")) {
      value = formatIpInput(value + key, value);
    }
    expect(value).toBe("192.168.");
  });

  it("builds up to the full example address by incremental typing", () => {
    const keystrokes = "192168100.77".split("");
    let value = "";
    for (const key of keystrokes) {
      value = formatIpInput(value + key, value);
    }
    expect(value).toBe("192.168.100.77");
  });

  it("strips characters other than digits and dots", () => {
    expect(formatIpInput("192a.168b.100c.77d", "")).toBe("192.168.100.77");
  });

  it("collapses consecutive dots and drops a leading dot", () => {
    expect(formatIpInput(".192..168", "")).toBe("192.168.");
  });

  it("caps at 4 octets and ignores extra digits/dots", () => {
    expect(formatIpInput("192.168.100.255.99", "")).toBe("192.168.100.255");
    expect(formatIpInput("192.168.100.2559", "192.168.100.255")).toBe(
      "192.168.100.255",
    );
  });

  it("does not re-insert a trailing dot while deleting", () => {
    expect(formatIpInput("192", "192.")).toBe("192");
    expect(formatIpInput("192.", "192.1")).toBe("192.");
  });

  it("keeps an explicit short octet followed by a user-typed dot", () => {
    expect(formatIpInput("19.", "19")).toBe("19.");
  });
});
