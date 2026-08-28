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
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import type { Category } from "@/services/category";
import type { Printer } from "@/services/printer";
import type { Zone } from "@/services/zone";
import {
  BadgeList,
  PrinterDetailMetric,
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

interface PrinterListCardsProps {
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

function PrinterCard({
  categories,
  zones,
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
    <article
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md",
        row.is_active
          ? "border-border"
          : "border-destructive/50 bg-destructive/5",
      )}
    >
      <div className="flex min-w-0 items-center gap-3 p-3 sm:p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <PrinterIcon className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black sm:text-base">
            {row.printer_name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.device_code || row.agent_name || "-"}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <PrinterStatusBadge
            active={row.is_active}
            label={row.is_active ? statusLabels.active : statusLabels.inactive}
          />
          <Badge variant="outline" className="whitespace-nowrap">
            {mappingTypeOf(row) === "ZONE"
              ? t("printer.mappingTypeZone")
              : t("printer.mappingTypeCategory")}
          </Badge>
        </div>
      </div>

      <Separator />

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2">
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

        <div className="min-w-0 rounded-md bg-muted/15 p-2.5">
          <p className="text-xs text-muted-foreground">{t("printer.roles")}</p>
          <div className="mt-1.5">
            <BadgeList
              emptyLabel={t("printer.noRoles")}
              items={roleItemsByPrinter.get(row.print_config_uuid) ?? []}
              max={Infinity}
            />
          </div>
        </div>

        <div className="min-w-0 rounded-md bg-muted/15 p-2.5">
          <p className="text-xs text-muted-foreground">
            {t("printer.categories")}
          </p>
          <div className="mt-1.5">
            <BadgeList
              emptyLabel={t("printer.noCategories")}
              items={printerCategories(row, categories).map((category) => ({
                label: categoryLabel(category, language),
                value: category.cate_uuid,
              }))}
              max={Infinity}
            />
          </div>
        </div>

        <div className="min-w-0 rounded-md bg-muted/15 p-2.5">
          <p className="text-xs text-muted-foreground">{t("printer.zones")}</p>
          <div className="mt-1.5">
            {mappingTypeOf(row) === "ZONE" ? (
              <BadgeList
                emptyLabel={t("printer.noZones")}
                items={printerZones(row, zones).map((zone) => ({
                  label: zoneLabel(zone, language),
                  value: zone.zone_uuid,
                }))}
                max={Infinity}
              />
            ) : (
              <span className="text-xs text-muted-foreground">
                {t("printer.noZones")}
              </span>
            )}
          </div>
        </div>
      </div>

      <Separator />

      <div className="mt-auto flex items-center justify-end gap-1.5 p-3 sm:p-4">
        <Button
          size="icon-sm"
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
          size="icon-sm"
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
          size="icon-sm"
          variant="outline"
          aria-label={t("actions.edit")}
          onClick={() =>
            router.push(
              `/printers/form?print_config_uuid=${encodeURIComponent(
                row.print_config_uuid,
              )}`,
            )
          }
        >
          <Pencil />
        </Button>

        <Button
          size="icon-sm"
          variant="destructive"
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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-[calc(0.5rem+max(env(safe-area-inset-bottom),var(--app-shell-bottom-nav-height,0px)))] sm:p-3">
        <div className="grid gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {props.filteredRows.map((row) => (
            <PrinterCard key={row.print_config_uuid} row={row} {...props} />
          ))}
        </div>
      </div>
    </div>
  );
}
