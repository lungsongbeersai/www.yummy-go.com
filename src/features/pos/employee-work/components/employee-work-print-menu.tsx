"use client";

import { ChevronDown, FileText, LoaderCircle, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface EmployeeWorkPrintMenuProps {
  disabled: boolean;
  pending: "escpos" | "pdf" | null;
  onEscpos: () => void;
  onPdf: () => void;
}

export function EmployeeWorkPrintMenu({ disabled, pending, onEscpos, onPdf }: EmployeeWorkPrintMenuProps) {
  const { t } = useTranslation();
  const label = pending ? t(`employeeWork.${pending === "pdf" ? "openPdf" : "printingShort"}`) : t("employeeWork.printShort");
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button type="button" className="min-h-11 min-w-0 gap-2 px-3" disabled={disabled || pending !== null} aria-busy={pending !== null} aria-label={label}>
      {pending ? <LoaderCircle className="size-4 shrink-0 animate-spin motion-reduce:animate-none" /> : <Printer className="size-4 shrink-0" />}<span className="truncate">{label}</span><ChevronDown className="size-4 shrink-0" />
    </Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-52 font-lao"><DropdownMenuGroup>
      <DropdownMenuItem className="min-h-11 gap-3" disabled={disabled || pending !== null} onSelect={onEscpos}><Printer className="size-4" />{t("employeeWork.printEscpos")}</DropdownMenuItem>
      <DropdownMenuItem className="min-h-11 gap-3" disabled={disabled || pending !== null} onSelect={onPdf}><FileText className="size-4" />{t("employeeWork.printPdfOption")}</DropdownMenuItem>
    </DropdownMenuGroup></DropdownMenuContent>
  </DropdownMenu>;
}
