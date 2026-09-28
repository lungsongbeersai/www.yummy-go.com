"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Banknote,
  EllipsisVertical,
  Info,
  Pencil,
  Power,
  PowerOff,
  Printer as PrinterIcon,
  Trash2,
  Usb,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Category } from "@/services/category";
import type { Printer } from "@/services/printer";
import type { Zone } from "@/services/zone";
import {
  BadgeList,
  PrinterAvailabilityBadge,
  PrinterOwnershipBadge,
  PrinterStatusBadge,
} from "./printer-list-shared";
import {
  canDeletePrinter,
  canEditPrinter,
  categoryLabel,
  isOwnedPrinter,
  mappingTypeOf,
  printerCategories,
  printerHealth,
  printerReachable,
  printerZones,
  zoneLabel,
  type PrinterHealth,
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
  testingDrawerUuid: string;
  togglingUuid: string;
  userUuid?: string;
  onDelete: (row: Printer) => void;
  onTest: (row: Printer) => void;
  onTestDrawer: (row: Printer) => void;
  onToggle: (row: Printer) => void;
}

// สีเฉพาะที่แถบบน/ไอคอน — ตัวการ์ดคุมโทนกลางไว้ (เดิมทั้งใบเป็นพื้นแดง/เหลือง/ฟ้าอ่อนตามสถานะ
// จนการ์ดที่ปิดใช้ตั้งใจดูเหมือน error และแยกไม่ออกว่าสีไหนแปลว่าอะไร)
const HEALTH_EDGE: Record<PrinterHealth, string> = {
  ready: "bg-primary",
  disabled: "bg-border",
  unreachable: "bg-warning",
};

const HEALTH_ICON: Record<PrinterHealth, string> = {
  ready: "bg-primary/10 text-primary",
  disabled: "bg-muted text-muted-foreground",
  unreachable: "bg-warning/15 text-warning",
};

function PrinterCard({
  categories,
  zones,
  language,
  printing,
  roleItemsByPrinter,
  row,
  statusLabels,
  testingUuid,
  testingDrawerUuid,
  togglingUuid,
  userUuid,
  onDelete,
  onTest,
  onTestDrawer,
  onToggle,
}: Omit<PrinterListCardsProps, "filteredRows"> & { row: PrinterTableRow }) {
  const { t } = useTranslation();
  const router = useRouter();
  const health = printerHealth(row);
  const editable = canEditPrinter(row);
  const deletable = canDeletePrinter(row);
  const toggling = togglingUuid === row.print_config_uuid;
  const testing = testingUuid === row.print_config_uuid;
  const testingDrawer = testingDrawerUuid === row.print_config_uuid;
  // เงื่อนไขเดิมของปุ่มทดสอบทุกข้อ (ดู printer-list-table.tsx) — printerReachable แทนสองเงื่อนไข shared/local ท้ายสุด
  const testDisabled =
    printing || Boolean(testingUuid) || Boolean(togglingUuid) || !userUuid || !row.print_config_uuid || !printerReachable(row);
  const drawerDisabled = testDisabled || Boolean(testingDrawerUuid);
  const zoneMapped = mappingTypeOf(row) === "ZONE";
  const targets = zoneMapped
    ? printerZones(row, zones).map((zone) => ({ label: zoneLabel(zone, language), value: zone.zone_uuid }))
    : [];
  const categoryItems = printerCategories(row, categories).map((category) => ({
    label: categoryLabel(category, language),
    value: category.cate_uuid,
  }));
  const switchId = `printer-active-${row.print_config_uuid}`;
  const ConnectionIcon = row.connect_type === "usb" ? Usb : Wifi;

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-shadow hover:shadow-md">
      <span aria-hidden="true" className={cn("h-1 w-full shrink-0", HEALTH_EDGE[health])} />

      <header className="flex min-w-0 items-start gap-3 p-4 pb-3">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", HEALTH_ICON[health])}>
          <PrinterIcon className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-base font-black leading-6", health === "disabled" && "text-muted-foreground")}>
            {row.printer_name}
          </p>
          <p className="truncate text-xs text-muted-foreground">{row.device_code || row.agent_name || "-"}</p>
        </div>

        {/* สวิตช์เปิด/ปิดใช้แทนปุ่มไอคอน Power ที่อ่านไม่ออกว่ากดแล้วจะเปิดหรือปิด — เครื่องที่แก้ไม่ได้โชว์เป็น badge */}
        {editable ? (
          <div className="flex shrink-0 items-center gap-2">
            <Label htmlFor={switchId} className="text-xs font-semibold text-muted-foreground">
              {row.is_active ? statusLabels.active : statusLabels.inactive}
            </Label>
            {toggling ? <Spinner className="size-4" /> : null}
            <Switch
              id={switchId}
              checked={row.is_active}
              disabled={Boolean(togglingUuid) || !row.print_config_uuid}
              aria-label={row.is_active ? t("printer.disablePrinter") : t("printer.activatePrinter")}
              onCheckedChange={() => void onToggle(row)}
            />
          </div>
        ) : (
          <PrinterStatusBadge active={row.is_active} label={row.is_active ? statusLabels.active : statusLabels.inactive} />
        )}
      </header>

      <div className="flex min-w-0 flex-1 flex-col gap-3 px-4 pb-4">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="gap-1 rounded-full font-bold">
            <ConnectionIcon className="size-3" />
            {row.connect_type === "usb" ? t("printer.usbPrinter") : t("printer.tcpPrinter")}
          </Badge>
          <PrinterOwnershipBadge
            isOwner={isOwnedPrinter(row)}
            ownerDeviceCode={row.owner_device_code}
            ownerLabel={t("printer.ownerBadge")}
            sharedLabel={t("printer.sharedBadgeWithDevice", { device: row.owner_device_code })}
            sharedFallbackLabel={t("printer.sharedBadge")}
          />
          {row.is_shared ? (
            <PrinterAvailabilityBadge
              online={row.agent_online !== false}
              onlineLabel={t("printer.sharedOnline")}
              offlineLabel={t("printer.sharedOffline")}
            />
          ) : row.is_local_device === false ? (
            <PrinterAvailabilityBadge online={false} onlineLabel="" offlineLabel={t("printer.notLocalDevice")} />
          ) : null}
        </div>

        <div className="min-w-0 rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-2xs font-medium text-muted-foreground">{t("fields.interfaceValue")}</p>
          <p className="truncate font-mono text-sm text-foreground" title={row.interface_value}>
            {row.interface_value || "-"}
          </p>
          {row.endpoint_duplicate ? (
            <Badge className="mt-1 gap-1 border-warning/30 bg-warning/10 text-warning">
              <AlertTriangle className="size-3" />
              {t("printer.duplicateAddress")}
            </Badge>
          ) : null}
        </div>

        <dl className="grid gap-2.5 text-sm">
          <div className="grid min-w-0 gap-1">
            <dt className="text-xs font-medium text-muted-foreground">{t("printer.roles")}</dt>
            <dd>
              <BadgeList emptyLabel={t("printer.noRoles")} items={roleItemsByPrinter.get(row.print_config_uuid) ?? []} />
            </dd>
          </div>
          <div className="grid min-w-0 gap-1">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {t("printer.printsFor")}
              <Badge variant="outline" className="px-1.5 py-0 text-2xs">
                {zoneMapped ? t("printer.mappingTypeZone") : t("printer.mappingTypeCategory")}
              </Badge>
            </dt>
            <dd className="flex flex-col gap-1.5">
              {zoneMapped ? <BadgeList emptyLabel={t("printer.noZones")} items={targets} /> : null}
              {/* บิล/ใบเสร็จ/รายงานไม่ผูกหมวดเมนู — เดิมขึ้น "ไม่มีหมวดหมู่" ซึ่งฟังเหมือนตั้งค่าไม่ครบ */}
              {categoryItems.length || zoneMapped ? (
                <BadgeList emptyLabel={t("printer.noCategories")} items={categoryItems} />
              ) : (
                <span className="text-xs text-muted-foreground">{t("printer.notMenuLinked")}</span>
              )}
            </dd>
          </div>
        </dl>

        {health !== "ready" ? (
          <p
            className={cn(
              "flex items-start gap-1.5 rounded-md px-2.5 py-2 text-xs",
              health === "unreachable" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground",
            )}
          >
            {health === "unreachable" ? (
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
            ) : (
              <Info className="mt-px size-3.5 shrink-0" />
            )}
            {health === "unreachable" ? t("printer.unreachableHint") : t("printer.disabledHint")}
          </p>
        ) : null}
      </div>

      <footer className="mt-auto flex items-center gap-2 border-t border-border bg-muted/20 px-4 py-3">
        {/* ทดสอบพิมพ์คือสิ่งที่ทำบ่อยที่สุดในหน้านี้ — เป็นปุ่มมีข้อความเต็ม ส่วนคำสั่งอื่นรวมในเมนู ⋮ */}
        <Button type="button" variant="outline" className="h-10 flex-1" disabled={testDisabled} onClick={() => void onTest(row)}>
          {testing ? <Spinner data-icon="inline-start" /> : <PrinterIcon data-icon="inline-start" />}
          {testing ? t("printer.testingPrinter") : t("printer.testPrinter")}
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex" tabIndex={drawerDisabled ? 0 : -1}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10"
                aria-label={t("printer.testDrawer")}
                disabled={drawerDisabled}
                onClick={() => void onTestDrawer(row)}
              >
                {testingDrawer ? <Spinner /> : <Banknote />}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>{testingDrawer ? t("printer.testingDrawer") : t("printer.testDrawer")}</TooltipContent>
        </Tooltip>

        {editable || deletable ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="size-10" aria-label={t("printer.moreActions")}>
                <EllipsisVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                {editable ? (
                  <>
                    <DropdownMenuItem onSelect={() =>
                        router.push(`/printers/form?print_config_uuid=${encodeURIComponent(row.print_config_uuid)}`)
                      }>
                      <Pencil />
                      {t("printer.edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled={Boolean(togglingUuid)} onSelect={() => void onToggle(row)}>
                      {row.is_active ? <PowerOff /> : <Power />}
                      {row.is_active ? t("printer.disablePrinter") : t("printer.activatePrinter")}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuGroup>
              {deletable ? (
                <>
                  {editable ? <DropdownMenuSeparator /> : null}
                  {/* ลบผ่าน ConfirmDialog (AlertDialog) ใน printer-page.tsx เสมอ */}
                  <DropdownMenuItem variant="destructive" onSelect={() => onDelete(row)}>
                    <Trash2 />
                    {t("actions.delete")}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </footer>
    </article>
  );
}

export function PrinterListCards(props: PrinterListCardsProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-[calc(0.75rem+max(var(--pos-system-bottom-safe-area,0px),var(--app-shell-bottom-nav-height,0px)))] sm:p-4 lg:px-5">
        <div className="grid items-start gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {props.filteredRows.map((row) => (
            <PrinterCard key={row.print_config_uuid} row={row} {...props} />
          ))}
        </div>
      </div>
    </div>
  );
}
