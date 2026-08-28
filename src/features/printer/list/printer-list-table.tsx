"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Power,
  PowerOff,
  Printer as PrinterIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { DataTable } from "@/components/common/data-table";
import type { Category } from "@/services/category";
import type { Printer } from "@/services/printer";
import type { Zone } from "@/services/zone";
import {
  BadgeList,
  PrinterStatusBadge,
} from "./printer-list-shared";
import {
  categoryLabel,
  mappingTypeOf,
  printerCategories,
  printerZones,
  zoneLabel,
  type PrinterTableRow,
} from "./printer-page-utils";

interface PrinterListTableProps {
  categories: Category[];
  zones: Zone[];
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

export function PrinterListTable({
  categories,
  zones,
  filteredRows,
  language,
  printing,
  roleItemsByPrinter,
  statusLabels,
  testingUuid,
  togglingUuid,
  userUuid,
  onDelete,
  onTest,
  onToggle,
}: PrinterListTableProps) {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="settings-table-scroll min-h-0 flex-1 overflow-auto">
        <DataTable<PrinterTableRow>
        rows={filteredRows}
        idKey="print_config_uuid"
        rowClassName={(row) =>
          row.is_active
            ? undefined
            : "border-l-4 border-l-destructive bg-destructive/5 hover:bg-destructive/10"
        }
        columns={[
          {
            key: "row_number",
            label: "#",
            align: "center",
            className:
              "w-14 whitespace-nowrap font-black text-muted-foreground",
            headClassName: "whitespace-nowrap",
          },
          {
            key: "printer_name",
            label: t("fields.name"),
            headClassName: "whitespace-nowrap",
            render: (row) => (
              <div className="flex min-w-52 items-center gap-3 whitespace-nowrap">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <PrinterIcon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="max-w-56 truncate font-black">
                    {row.printer_name}
                  </p>
                  <p className="max-w-56 truncate text-xs text-muted-foreground">
                    {row.device_code || row.agent_name || "-"}
                  </p>
                </div>
              </div>
            ),
          },
          {
            key: "connect_type",
            label: t("fields.connectType"),
            headClassName: "whitespace-nowrap",
            render: (row) => (
              <Badge className="whitespace-nowrap">
                {row.connect_type.toUpperCase()}
              </Badge>
            ),
          },
          {
            key: "interface_value",
            label: t("fields.interfaceValue"),
            className: "max-w-64 truncate whitespace-nowrap text-xs",
            headClassName: "whitespace-nowrap",
          },
          {
            key: "role_codes",
            label: t("printer.roles"),
            headClassName: "whitespace-nowrap",
            render: (row) => (
              <BadgeList
                emptyLabel={t("printer.noRoles")}
                items={roleItemsByPrinter.get(row.print_config_uuid) ?? []}
              />
            ),
          },
          {
            key: "mapping_type",
            label: t("printer.mappingType"),
            headClassName: "whitespace-nowrap",
            render: (row) => (
              <Badge variant="outline" className="whitespace-nowrap">
                {mappingTypeOf(row) === "ZONE"
                  ? t("printer.mappingTypeZone")
                  : t("printer.mappingTypeCategory")}
              </Badge>
            ),
          },
          {
            key: "categories",
            label: t("printer.categories"),
            headClassName: "whitespace-nowrap",
            render: (row) => (
              <BadgeList
                emptyLabel={t("printer.noCategories")}
                items={printerCategories(row, categories).map((category) => ({
                  label: categoryLabel(category, language),
                  value: category.cate_uuid,
                }))}
              />
            ),
          },
          {
            key: "zones",
            label: t("printer.zones"),
            headClassName: "whitespace-nowrap",
            render: (row) =>
              mappingTypeOf(row) === "ZONE" ? (
                <BadgeList
                  emptyLabel={t("printer.noZones")}
                  items={printerZones(row, zones).map((zone) => ({
                    label: zoneLabel(zone, language),
                    value: zone.zone_uuid,
                  }))}
                />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t("printer.noZones")}
                </span>
              ),
          },
          {
            key: "is_active",
            label: t("common.status"),
            className: "whitespace-nowrap",
            headClassName: "whitespace-nowrap",
            render: (row) => (
              <PrinterStatusBadge
                active={row.is_active}
                label={
                  row.is_active ? statusLabels.active : statusLabels.inactive
                }
              />
            ),
          },
        ]}
        actions={[
          {
            id: "test-printer",
            label: (row) =>
              testingUuid === row.print_config_uuid
                ? t("printer.testingPrinter")
                : t("printer.testPrinter"),
            icon: (row) =>
              testingUuid === row.print_config_uuid ? (
                <Spinner />
              ) : (
                <PrinterIcon />
              ),
            disabled: (row) =>
              printing ||
              Boolean(testingUuid) ||
              Boolean(togglingUuid) ||
              !userUuid ||
              !row.print_config_uuid,
            keepOpenOnSelect: true,
            onSelect: (row) => void onTest(row),
          },
          {
            id: "toggle-active",
            label: (row) =>
              row.is_active
                ? t("printer.disablePrinter")
                : t("printer.activatePrinter"),
            icon: (row) =>
              togglingUuid === row.print_config_uuid ? (
                <Spinner />
              ) : row.is_active ? (
                <PowerOff />
              ) : (
                <Power />
              ),
            disabled: (row) =>
              Boolean(togglingUuid) || !row.print_config_uuid,
            keepOpenOnSelect: true,
            onSelect: (row) => void onToggle(row),
          },
        ]}
        onEdit={(row) =>
          router.push(
            `/printers/form?print_config_uuid=${encodeURIComponent(
              row.print_config_uuid,
            )}`,
          )
        }
        onDelete={(row) => onDelete(row)}
      />
      </div>
    </div>
  );
}
