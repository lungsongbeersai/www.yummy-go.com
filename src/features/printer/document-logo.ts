import type { Printer } from "@/services/printer";

export type DocumentLogoRole = "invoice" | "receipt";

export function documentLogoDefault(printers: Printer[] | null, documentRole?: DocumentLogoRole): boolean | "indeterminate" {
  // Unresolved defaults must not look disabled while the omitted request
  // field still allows a configured printer to include its logo.
  if (printers === null) return "indeterminate";
  const documents = printers.filter((printer) =>
    printer.is_active && printer.role_codes.some((role) =>
      documentRole ? role === documentRole : role === "invoice" || role === "receipt",
    ),
  );
  const enabled = documents.filter((printer) => printer.print_show_logo === true).length;
  if (enabled === 0) return false;
  return enabled === documents.length ? true : "indeterminate";
}
