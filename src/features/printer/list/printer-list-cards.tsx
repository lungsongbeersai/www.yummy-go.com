"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Pencil,
  Power,
  PowerOff,
  Printer as PrinterIcon,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import type { Category } from "@/services/category";
import type { Printer } from "@/services/printer";
import {
  BadgeList,
  PrinterDetailMetric,
  PrinterStatusBadge,
} from "./printer-list-shared";
import {
  categoryLabel,
  printerCategories,
  type PrinterTableRow,
} from "./printer-page-utils";

interface PrinterListCardsProps {
  categories: Category[];
  filteredRows: PrinterTableRow[];
  language: string;
  printing: boolean;
  roleItemsByPrinter: Map<string, Array<{ label: string; value: string }>>;
  statusLabels: { active: string; inactive: string };
  testingUuid: string;
  togglingUuid: string;
  userUuid?: string;
  onDelete: (row: Printer) => void;
  onTest: (row: Printer) => void;
  onToggle: (row: Printer) => void;
}

function PrinterCard({
  categories,
  language,
  printing,
  roleItemsByPrinter,
  row,
  statusLabels,
  testingUuid,
  togglingUuid,
  userUuid,
  onDelete,
  onTest,
  onToggle,
}: Omit<PrinterListCardsProps, "filteredRows"> & { row: PrinterTableRow }) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex min-w-0 items-start gap-3 p-3 sm:p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary sm:size-11">
          <PrinterIcon className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-black sm:text-base">
                {row.printer_name}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {row.device_code || row.agent_name || "-"}
              </p>
            </div>

            <PrinterStatusBadge
              active={row.is_active}
              label={
                row.is_active ? statusLabels.active : statusLabels.inactive
              }
            />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <PrinterDetailMetric
              label={t("fields.connectType")}
              value={
                <Badge className="w-fit whitespace-nowrap">
                  {row.connect_type.toUpperCase()}
                </Badge>
              }
            />
            <PrinterDetailMetric
              label={t("fields.interfaceValue")}
              value={
                <span className="block truncate font-mono text-xs sm:text-sm">
                  {row.interface_value || "-"}
                </span>
              }
            />
          </div>

          <div className="mt-3 space-y-2.5">
            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">
                {t("printer.roles")}
              </p>
              <BadgeList
                emptyLabel={t("printer.noRoles")}
                items={roleItemsByPrinter.get(row.print_config_uuid) ?? []}
              />
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold text-muted-foreground">
                {t("printer.categories")}
              </p>
              <BadgeList
                emptyLabel={t("printer.noCategories")}
                items={printerCategories(row, categories).map((category) => ({
                  label: categoryLabel(category, language),
                  value: category.cate_uuid,
                }))}
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div className="mt-auto flex items-center justify-end gap-1.5 p-3 sm:p-4">
        <Button
          size="iconSm"
          variant="outline"
          aria-label={t("printer.testPrinter")}
          disabled={
            printing ||
            Boolean(testingUuid) ||
            Boolean(togglingUuid) ||
            !userUuid ||
            !row.print_config_uuid
          }
          onClick={() => void onTest(row)}
        >
          {testingUuid === row.print_config_uuid ? (
            <Spinner />
          ) : (
            <PrinterIcon />
          )}
        </Button>

        <Button
          size="iconSm"
          variant="outline"
          aria-label={
            row.is_active
              ? t("printer.disablePrinter")
              : t("printer.activatePrinter")
          }
          disabled={Boolean(togglingUuid) || !row.print_config_uuid}
          onClick={() => void onToggle(row)}
        >
          {togglingUuid === row.print_config_uuid ? (
            <Spinner />
          ) : row.is_active ? (
            <PowerOff />
          ) : (
            <Power />
          )}
        </Button>

        <Button
          size="iconSm"
          variant="outline"
          aria-label={t("actions.edit")}
          onClick={() =>
            router.push(
              `/printer/form?print_config_uuid=${encodeURIComponent(
                row.print_config_uuid,
              )}`,
            )
          }
        >
          <Pencil />
        </Button>

        <Button
          size="iconSm"
          variant="danger"
          aria-label={t("actions.delete")}
          onClick={() => onDelete(row)}
        >
          <Trash2 />
        </Button>
      </div>
    </article>
  );
}

export function PrinterListCards(props: PrinterListCardsProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden lg:hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:p-3">
        <div className="grid gap-2 sm:gap-3 md:grid-cols-2">
        {props.filteredRows.map((row) => (
          <PrinterCard key={row.print_config_uuid} row={row} {...props} />
        ))}
        </div>
      </div>
    </div>
  );
}
