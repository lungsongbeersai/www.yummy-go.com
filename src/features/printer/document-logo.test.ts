import { expect, it } from "vitest";
import type { Printer } from "@/services/printer";
import { documentLogoDefault } from "./document-logo";

function printer(role: string, logo?: boolean, active = true): Printer {
  return {
    print_config_uuid: role, printer_name: role, connect_type: "tcp", interface_value: "tcp://192.168.1.1:9100",
    paper_width_mm: 80, is_active: active, role_codes: [role], cate_uuid_fk: [], print_show_logo: logo,
  };
}

it("keeps pending or failed printer defaults unknown until a successful result arrives", () => {
  expect(documentLogoDefault(null)).toBe("indeterminate");
  expect(documentLogoDefault(null, "invoice")).toBe("indeterminate");
  expect(documentLogoDefault(null, "receipt")).toBe("indeterminate");
  expect(documentLogoDefault([])).toBe(false);
});

it("uses legacy hidden defaults and ignores kitchen or inactive printers", () => {
  expect(documentLogoDefault([])).toBe(false);
  expect(documentLogoDefault([printer("invoice"), printer("kitchen", true), printer("receipt", true, false)])).toBe(false);
});

it("reflects enabled defaults and preserves mixed document printer settings", () => {
  expect(documentLogoDefault([printer("invoice", true), printer("receipt", true)])).toBe(true);
  expect(documentLogoDefault([printer("invoice", true), printer("receipt", false)])).toBe("indeterminate");
});

it("keeps invoice and receipt defaults separate for fallback printing", () => {
  const printers = [printer("invoice", true), printer("receipt", false)];
  expect(documentLogoDefault(printers)).toBe("indeterminate");
  expect(documentLogoDefault(printers, "invoice")).toBe(true);
  expect(documentLogoDefault(printers, "receipt")).toBe(false);
  expect(documentLogoDefault([printer("invoice", true)], "receipt")).toBe(false);
});

it("preserves mixed settings among printers of the same document type", () => {
  const printers = [printer("receipt", true), printer("receipt", false), printer("invoice", true)];
  expect(documentLogoDefault(printers, "receipt")).toBe("indeterminate");
  expect(documentLogoDefault([{
    ...printer("receipt", true), role_codes: ["invoice", "receipt"],
  }], "invoice")).toBe(true);
});
