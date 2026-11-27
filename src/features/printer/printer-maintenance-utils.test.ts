import { describe, expect, it } from "vitest";
import { parsePrinterMaintenanceEndpoint, printerMaintenanceEndpoint } from "./printer-maintenance-utils";

describe("printer maintenance destination", () => {
  it.each(["10.0.0.1", "172.16.0.1", "172.31.255.254", "192.168.100.202"])("accepts private IPv4 %s", (ip) => {
    expect(printerMaintenanceEndpoint(ip, "9100")).toBe(`tcp://${ip}:9100`);
  });
  it.each(["8.8.8.8", "127.0.0.1", "169.254.1.1", "172.15.0.1", "172.32.0.1", "192.168.1.256", "192.168.01.2", "printer.local", "192.168.1.2/path", "::1"])("rejects invalid or non-private IP %s", (ip) => {
    expect(printerMaintenanceEndpoint(ip, "9100")).toBeNull();
  });
  it.each(["0", "65536", "09100", "-1", "9100/path", "9e3", ""])("rejects invalid port %s", (port) => {
    expect(printerMaintenanceEndpoint("192.168.1.2", port)).toBeNull();
  });
  it("preserves explicit ports and refuses endpoint credentials, query and extra routes", () => {
    expect(parsePrinterMaintenanceEndpoint("tcp://192.168.100.202:65535")).toEqual({ ip: "192.168.100.202", port: "65535" });
    for (const value of ["tcp://user@192.168.1.2:9100", "tcp://192.168.1.2:9100/", "tcp://192.168.1.2:9100?x", "http://192.168.1.2:9100"]) {
      expect(parsePrinterMaintenanceEndpoint(value)).toBeNull();
    }
  });
});
