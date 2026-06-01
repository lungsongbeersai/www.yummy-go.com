import { describe, expect, it } from "vitest";
import { agentBase, failPayload, mapPrinter, parseInterfaceValue } from "@/services/printer/helpers";

describe("printer helpers", () => {
  it("normalizes agent base URLs", () => {
    expect(agentBase("http://127.0.0.1:7777/", " http://printer.local/ ")).toBe("http://printer.local");
    expect(agentBase("http://127.0.0.1:7777/")).toBe("http://127.0.0.1:7777");
  });

  it("parses printer interface values", () => {
    expect(parseInterfaceValue("tcp://192.168.1.20:9101")).toEqual({
      mode: "network",
      ip: "192.168.1.20",
      port: 9101
    });
    expect(parseInterfaceValue("win:Receipt Printer")).toEqual({
      mode: "usb",
      systemPrinterName: "Receipt Printer"
    });
  });

  it("maps loose printer API rows into stable printer objects", () => {
    expect(mapPrinter({ display_name: "Kitchen", paper_width_mm: "58", role_codes: [1, "bar"] })).toMatchObject({
      printer_name: "Kitchen",
      paper_width_mm: 58,
      role_codes: ["1", "bar"],
      cate_uuid_fk: []
    });
  });

  it("adds failure reason only when missing", () => {
    expect(
      failPayload(
        {
          print_job_uuid: "job",
          results: [
            { print_job_item_uuid: "1", status: "failed" },
            { print_job_item_uuid: "2", status: "failed", reason: "Paper" },
            { print_job_item_uuid: "3", status: "success" }
          ]
        },
        "Offline"
      ).results
    ).toEqual([
      { print_job_item_uuid: "1", status: "failed", reason: "Offline" },
      { print_job_item_uuid: "2", status: "failed", reason: "Paper" },
      { print_job_item_uuid: "3", status: "success" }
    ]);
  });
});
