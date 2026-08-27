"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clock, MapPinPlus, Plus, Search, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { HorizontalScrollArrows } from "@/components/common/horizontal-scroll-arrows";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { zoneOrderAlertCount } from "@/lib/pos/order-alerts";
import type { PosTable, PosZone } from "@/services/pos";
import type { TableStatusFilter } from "./types";
import {
  filterZones,
  tableCheckInTime,
  tableCount,
  tableHasOrderAlert,
  tableSeatCount,
  tableStatus,
  tableVisualStatus,
  type TableVisualStatus
} from "./utils";

// ToggleGroup (Radix) ไม่รับค่าว่าง "" เป็น item value ได้จริง (สงวนไว้แทน
// "ไม่มีอะไรถูกเลือก") จึงใช้ sentinel นี้แทนโซน "ทั้งหมด" แล้วแปลงกลับเป็น "" ตอน
// เรียก scrollToZone
const ZONE_ALL_VALUE = "__all__";

interface TableListSectionProps {
  loading: boolean;
  search: string;
  selectedTable: PosTable | null;
  statusFilter: TableStatusFilter;
  zoneOptions: PosZone[];
  zones: PosZone[];
  onSearchChange: (value: string) => void;
  onSelectTable: (table: PosTable) => void;
  onStatusFilterChange: (value: TableStatusFilter) => void;
}

export function TableListSection({
  loading,
  onSearchChange,
  onSelectTable,
  onStatusFilterChange,
  search,
  selectedTable,
  statusFilter,
  zoneOptions,
  zones
}: TableListSectionProps) {
  const { t } = useTranslation();
  // ทุกโซนแสดงพร้อมกันเสมอ (ไม่ยิง fetch ซ้ำตอนเปลี่ยนโซน) — คลิกชิปแค่เลื่อน
  // จอไปยัง section ของโซนนั้น ค่านี้จึงเป็นแค่ state ไว้ไฮไลต์ชิปที่กดล่าสุด
  const [selectedZoneUuid, setSelectedZoneUuid] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const zoneSectionRefs = useRef(new Map<string, HTMLElement>());
  const zoneRailRef = useRef<HTMLDivElement | null>(null);
  const statusRailRef = useRef<HTMLDivElement | null>(null);
  const [zoneRailOverflowing, setZoneRailOverflowing] = useState(false);
  const [statusRailOverflowing, setStatusRailOverflowing] = useState(false);
  const visibleZones = useMemo(() => filterZones(zones, search, statusFilter), [search, statusFilter, zones]);
  const allTables = useMemo(() => zones.flatMap((zone) => zone.tables ?? []), [zones]);
  const filterOptions = zoneOptions.length ? zoneOptions : zones;
  const hasVisibleTables = tableCount(visibleZones) > 0;
  const totalOrderAlertCount = useMemo(
    () => filterOptions.reduce((sum, zone) => sum + zoneOrderAlertCount(zone), 0),
    [filterOptions]
  );
  const statusCounts = useMemo(() => {
    const busy = allTables.filter((table) => tableStatus(table) === "busy").length;
    const updates = allTables.filter((table) => Boolean(table.customer_order_state)).length;
    return { all: allTables.length, busy, free: allTables.length - busy, update: updates };
  }, [allTables]);

  const scrollToZone = useCallback((zoneUuid: string) => {
    setSelectedZoneUuid(zoneUuid);
    if (!zoneUuid) {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    zoneSectionRefs.current.get(zoneUuid)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-background px-0 py-3 shadow-sm sm:px-4 xl:px-5">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            {/* pl-8/pr-8 พอดีกับปุ่มลูกศร size-8 เป๊ะ (ไม่มี buffer เหลือ) เฉพาะตอนล้นจริง
                (zoneRailOverflowing) — ให้ชิปแรกชิดขอบซ้ายที่สุดเท่าที่ยังไม่โดนปุ่มลูกศร
                บังจนกดไม่ได้ ส่วน padding รอบนอกเอาออกหมด (px-0) บนจอเล็กตามที่แจ้งว่า
                ไม่ต้องการเว้นระยะเลย */}
            <div
              ref={zoneRailRef}
              className={cn(
                "-mx-1 overflow-x-auto px-1 py-1",
                zoneRailOverflowing && "pl-8 pr-8"
              )}
            >
              <ToggleGroup
                aria-label={t("pos.zoneJumpAria")}
                className="w-max justify-start"
                type="single"
                value={selectedZoneUuid || ZONE_ALL_VALUE}
                onValueChange={(value) => {
                  if (!value) return;
                  scrollToZone(value === ZONE_ALL_VALUE ? "" : value);
                }}
              >
                <ZoneToggleItem
                  active={!selectedZoneUuid}
                  alertAriaLabel={t("pos.zoneNewOrderAria", { zone: t("common.all"), count: totalOrderAlertCount })}
                  alertCount={totalOrderAlertCount}
                  label={t("common.all")}
                  value={ZONE_ALL_VALUE}
                />
                {filterOptions.map((zone) => {
                  const alertCount = zoneOrderAlertCount(zone);
                  return (
                    <ZoneToggleItem
                      key={zone.zone_uuid}
                      active={selectedZoneUuid === zone.zone_uuid}
                      alertAriaLabel={t("pos.zoneNewOrderAria", { zone: zone.zone_name, count: alertCount })}
                      alertCount={alertCount}
                      label={zone.zone_name}
                      value={zone.zone_uuid}
                    />
                  );
                })}
              </ToggleGroup>
            </div>
            <HorizontalScrollArrows
              className="size-8"
              scrollRef={zoneRailRef}
              onOverflowChange={setZoneRailOverflowing}
            />
          </div>
          <div className="flex shrink-0 gap-2">
            {/* ซ่อนทั้งปุ่มบนจอเล็ก (ไม่ใช่แค่ label) — งานเพิ่มโซน/โต๊ะเป็นงานตั้งค่าที่ไม่ได้ทำ
                บ่อยระหว่างขาย บนจอมือถือแถวนี้แน่นเกินไปแล้วจากแถบเลื่อนโซน */}
            <Button asChild aria-label={t("pos.addZone")} className="hidden h-10 rounded-full px-3.5 font-black shadow-sm sm:inline-flex" size="sm" type="button" variant="outline">
              <Link href="/settings/zone">
                <MapPinPlus aria-hidden="true" data-icon="inline-start" />
                <span aria-hidden="true">{t("pos.addZone")}</span>
              </Link>
            </Button>
            <Button asChild aria-label={t("pos.addTable")} className="hidden h-10 rounded-full px-3.5 font-black shadow-sm sm:inline-flex" size="sm" type="button" variant="outline">
              <Link href="/settings/table">
                <Plus aria-hidden="true" data-icon="inline-start" />
                <span aria-hidden="true">{t("pos.addTable")}</span>
              </Link>
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative min-w-0">
            <div
              ref={statusRailRef}
              className={cn(
                "-mx-1 overflow-x-auto px-1 py-1",
                statusRailOverflowing && "pl-8 pr-8"
              )}
            >
              <ToggleGroup
                aria-label={t("pos.statusFilterAria")}
                className="w-max justify-start"
                type="single"
                value={statusFilter}
                onValueChange={(value) => {
                  if (value) onStatusFilterChange(value as TableStatusFilter);
                }}
              >
                <StatusToggleItem active={statusFilter === "all"} label={t("common.all")} value="all" valueCount={statusCounts.all} />
                <StatusToggleItem active={statusFilter === "free"} dot="free" label={t("common.free")} value="free" valueCount={statusCounts.free} />
                <StatusToggleItem active={statusFilter === "busy"} dot="busy" label={t("common.busy")} value="busy" valueCount={statusCounts.busy} />
                <StatusToggleItem active={statusFilter === "update"} dot="update" label={t("pos.tableSelectionNewOrder")} value="update" valueCount={statusCounts.update} />
              </ToggleGroup>
            </div>
            <HorizontalScrollArrows
              className="size-8"
              scrollRef={statusRailRef}
              onOverflowChange={setStatusRailOverflowing}
            />
          </div>
          <div className="relative min-w-0 w-full xl:w-[320px]">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label={t("actions.search")} className="h-10.5 rounded-full border-border bg-muted/35 pl-9 shadow-none" placeholder={t("actions.search")} type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} />
          </div>
        </div>
      </div>
      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 xl:p-5">
        {loading ? (
          <LoadingState label={t("pos.loadingTables")} variant="posGrid" />
        ) : hasVisibleTables ? (
          <div className="flex min-w-0 flex-col gap-4 pb-4">
            {visibleZones.map((zone) => (
              <section
                key={zone.zone_uuid}
                ref={(el) => {
                  if (el) zoneSectionRefs.current.set(zone.zone_uuid, el);
                  else zoneSectionRefs.current.delete(zone.zone_uuid);
                }}
                className="flex flex-col gap-3"
              >
                {filterOptions.length > 1 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-black text-muted-foreground">{zone.zone_name}</h2>
                    <Badge>{(zone.tables ?? []).length}</Badge>
                  </div>
                ) : null}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(min(150px,100%),1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(min(164px,100%),1fr))] lg:grid-cols-[repeat(auto-fill,minmax(min(180px,100%),1fr))] xl:grid-cols-[repeat(auto-fill,minmax(min(200px,100%),1fr))]">
                  {(zone.tables ?? []).map((table) => (
                    <TableCard key={table.table_uuid} selected={selectedTable?.table_uuid === table.table_uuid} table={table} onOpen={onSelectTable} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState title={t("common.noData")} description={t("empty.adjustSearch")} />
        )}
      </div>
      <StatusLegend />
    </div>
  );
}

// ToggleGroupItem แทน Button+active-prop แบบเดิม (shadcn rule: option set 2-7
// ตัวเลือกใช้ ToggleGroup แทนการ loop Button คุม active เอง) — ได้ roving-tabindex
// และ keyboard nav (arrow key ระหว่างตัวเลือก) มาฟรีจาก Radix โดยไม่ต้องเขียนเอง
function ZoneToggleItem({
  active,
  alertAriaLabel,
  alertCount = 0,
  label,
  value
}: {
  active: boolean;
  alertAriaLabel?: string;
  alertCount?: number;
  label: string;
  value: string;
}) {
  const hasAlert = alertCount > 0;

  return (
    <ToggleGroupItem
      className={cn(
        "h-10 gap-1 rounded-full border border-transparent px-3.5 font-black shadow-sm transition data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-primary/20",
        !active && "border-border bg-card hover:border-primary/30 hover:bg-primary/5",
        // ใช้ ring กะพริบแทนพื้นหลังกะพริบ — พื้นหลังกะพริบชนสี text-destructive จนคอนทราสต์ไม่ผ่าน WCAG AA
        hasAlert && "pos-chip-alert-ring"
      )}
      value={value}
    >
      {active ? <Check aria-hidden="true" data-icon="inline-start" /> : null}
      <span className="max-w-40 truncate">{label}</span>
      {hasAlert ? (
        <Badge
          aria-label={alertAriaLabel}
          className="ml-1 min-w-4.5 justify-center border-transparent bg-destructive px-1 text-2xs tabular-nums text-destructive-foreground"
        >
          {alertCount}
        </Badge>
      ) : null}
    </ToggleGroupItem>
  );
}

function StatusToggleItem({
  active,
  dot,
  label,
  value,
  valueCount
}: {
  active: boolean;
  dot?: "free" | "busy" | "update";
  label: string;
  value: TableStatusFilter;
  valueCount: number;
}) {
  return (
    <ToggleGroupItem
      className={cn(
        "h-10 gap-1 rounded-full border border-transparent px-3.5 font-black shadow-sm transition data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-primary/20",
        !active && "border-border bg-card hover:border-primary/30 hover:bg-primary/5"
      )}
      value={value}
    >
      {dot ? <span aria-hidden="true" className={cn("size-2.5 rounded-full", active ? "bg-primary-foreground" : dotClass(dot))} /> : null}
      <span>{label}</span>
      <Badge className={cn("ml-1 border-transparent px-1.5 tabular-nums", active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground")}>
        {valueCount}
      </Badge>
    </ToggleGroupItem>
  );
}

function dotClass(status: "free" | "busy" | "update") {
  if (status === "busy") return "bg-destructive";
  if (status === "update") return "bg-warning";
  return "bg-success";
}

// สไตล์ต่อสถานะ 6 แบบ ผูกกับ table_status ล้วน ๆ (ดู tableVisualStatus() ใน
// table-zones.ts) — พื้นใช้สีฮิวหลักผสมความโปร่งใสต่ำ (/12-/15) แทนขั้นพาสเทลทึบ
// (100/200) ให้ได้โทนหม่น ๆ ออกเกรย์ตามที่อ้างอิงไว้ ตัวอักษรใช้เฉด 900 ให้ contrast
// สูงกับพื้น จุดกลมมุมขวายังคงสีเข้มไว้ให้กวาดสายตาแยกสถานะได้ไว
// `card` ไม่มี ring สีต่อสถานะแล้ว — ขอบใช้สีเทา/ดำกลาง ๆ ตัวเดียวร่วมกันทุกสถานะ
// (ring-border ใน TableCard) ให้พื้นหลังเป็นตัวสื่อสถานะอย่างเดียว ไม่ให้ขอบแย่งซีน
// ทุกคู่สีมี dark: กำกับเสมอ — ค่า raw ({color}-600/15 + text-{color}-900) ที่ไม่มี
// dark: จะจางจนแยกไม่ออกบนพื้นเข้ม (bg blend เป็นเกือบดำ + ตัวอักษรก็เกือบดำ ⇒ กลืนกัน)
// รอบแรกลอง dark:bg-{color}-500/20 แต่ 500 เป็นเฉดกลางที่ยังสดเกินไป ผสมแล้วกลายเป็น
// บล็อกสีทึบดูหนักตา จึงเปลี่ยนมาใช้เฉดเข้มสุด (950) ที่ opacity ต่ำแทน ให้ยังคงหม่น
// รอบสอง: ตัวอักษรยังใช้ dark:text-{color}-300 ซึ่งเป็นฮิวเดียวกับพื้น (แค่ต่าง shade)
// — ฮิวเดียวกันทั้งคู่เสี่ยง contrast ตกได้ง่ายมาก (สังเกตุจาก UI จริง) จึงเลิกให้ตัวอักษร
// สถานะใช้สีต่อฮิวในโหมดมืด เปลี่ยนเป็น text-foreground กลาง ๆ แทน (เหมือนชื่อโต๊ะ/label
// "โต๊ะ" ที่อ่านออกชัดอยู่แล้ว) ให้สีสถานะสื่อผ่านพื้นหลัง + จุดกลมมุมขวาสองจุดนี้พอ
interface TableCardStyle {
  card: string;
  body: string;
  footer: string;
  dot: string;
  text: string;
  ring?: string;
}

const STATUS_STYLE: Record<TableVisualStatus, TableCardStyle> = {
  available: {
    card: "bg-background",
    body: "bg-background",
    footer: "border-green-200 bg-muted/50 dark:border-green-800/50",
    dot: "bg-green-600 dark:bg-green-500",
    text: "text-green-600 dark:text-green-400"
  },
  occupied: {
    card: "bg-green-600/15 dark:bg-green-950/40",
    body: "bg-green-600/15 dark:bg-green-950/40",
    footer: "border-green-600/25 bg-green-600/10 dark:border-green-800/40 dark:bg-green-900/25",
    dot: "bg-red-700 dark:bg-red-400",
    text: "text-red-700 dark:text-foreground"
  },
  // ring: คลาสสี "--ring-rgb" สำหรับ pos-status-ring-pulse (การ์ดสถานะนี้ต้องรอ
  // "คนอื่น" กดยืนยันก่อนถึงจะไปต่อได้ — วงแหวนกะพริบช่วยดึงสายตาว่ายังค้างอยู่)
  // ตั้งใจไม่ใช้ currentColor/text-{hue} ตรง ๆ — ทดสอบจริงแล้วพบว่า
  // color-mix(in oklch, currentColor ...) ไม่ interpolate ต่อเนื่องในเบราว์เซอร์นี้
  // (ดูรายละเอียดที่ .pos-ring-* ใน globals.css) ต้องแยกเป็นคลาสตั้งค่า --ring-rgb
  // เป็นเลข r g b ตรง ๆ แทน
  cashierOrder: {
    card: "bg-blue-600/15 dark:bg-blue-950/40",
    body: "bg-blue-600/15 dark:bg-blue-950/40",
    footer: "border-blue-600/25 bg-blue-600/10 dark:border-blue-800/40 dark:bg-blue-900/25",
    dot: "bg-blue-600 dark:bg-blue-400",
    text: "text-blue-900 dark:text-foreground",
    ring: "pos-ring-cashier-order"
  },
  // ใช้เฉดแดงเดียวกับ ORDER_ALERT_STYLE ตรงตัว (การ์ด/จุด/ตัวอักษร) — ตามที่ตกลงไว้ว่า
  // "รอลูกค้ายืนยัน" เป็นสีแดงล้วน แยกจากป้ายเตือน "ออเดอร์ใหม่" ด้วยจังหวะกะพริบ
  // (pos-table-card-alert) เท่านั้น ไม่ใช้เฉดต่างกันเพื่อกันชน
  awaitingConfirm: {
    card: "bg-red-600/15 dark:bg-red-950/40",
    body: "bg-red-600/15 dark:bg-red-950/40",
    footer: "border-red-600/25 bg-red-600/10 dark:border-red-800/40 dark:bg-red-900/25",
    dot: "bg-red-700 dark:bg-red-400",
    text: "text-red-700 dark:text-foreground",
    ring: "pos-ring-awaiting-confirm"
  },
  callStaff: {
    card: "bg-purple-600/15 dark:bg-purple-950/40",
    body: "bg-purple-600/15 dark:bg-purple-950/40",
    footer: "border-purple-600/25 bg-purple-600/10 dark:border-purple-800/40 dark:bg-purple-900/25",
    dot: "bg-purple-600 dark:bg-purple-400",
    text: "text-purple-900 dark:text-foreground"
  },
  // เดิมใช้ orange ซึ่งอยู่ใกล้ amber ของ awaitingConfirm บน color wheel มากเกินไป
  // (~20°) ตอนนี้ awaitingConfirm ย้ายไปแดงแล้ว orange ก็ยังใกล้แดงอยู่ดี (~25°) จึง
  // ย้ายมาใช้ teal แทนเพื่อให้ห่างจากทุกฮิวอื่นในชุดสถานะจริง ๆ
  awaitingPayment: {
    card: "bg-teal-600/15 dark:bg-teal-950/40",
    body: "bg-teal-600/15 dark:bg-teal-950/40",
    footer: "border-teal-600/25 bg-teal-600/10 dark:border-teal-800/40 dark:bg-teal-900/25",
    dot: "bg-teal-600 dark:bg-teal-400",
    text: "text-teal-900 dark:text-foreground"
  }
};

// customer_order_state: true ต้องแดงเสมอ ไม่ว่า table_status จะเป็นอะไร — ทับ
// STATUS_STYLE ทั้งก้อนแทนการเรียงสี ring ไว้ข้างบนแบบเดิม (ดู hasOrderAlert ใน TableCard)
const ORDER_ALERT_STYLE: TableCardStyle = {
  card: "bg-red-600/15 dark:bg-red-950/40",
  body: "bg-red-600/15 dark:bg-red-950/40",
  footer: "border-red-600/30 bg-red-600/10 dark:border-red-800/40 dark:bg-red-900/25",
  dot: "bg-red-700 dark:bg-red-400",
  text: "text-red-700 dark:text-foreground"
};

// เรียงตามลำดับ 1-6 ที่กำหนดไว้ (ดู TableStatus ใน pos-constants.ts) — ใช้ร่วมกัน
// ทั้งป้ายสถานะบนการ์ดและ legend สีที่ sticky footer ด้านล่าง
const STATUS_LABEL_KEY: Record<TableVisualStatus, string> = {
  available: "common.free",
  occupied: "common.busy",
  cashierOrder: "pos.tableStatusCashierOrder",
  awaitingConfirm: "pos.tableSelectionNewOrder",
  callStaff: "pos.tableStatusCallStaff",
  awaitingPayment: "pos.tableStatusAwaitingPayment"
};

const STATUS_LEGEND_ORDER: TableVisualStatus[] = [
  "available",
  "occupied",
  "cashierOrder",
  "awaitingConfirm",
  "callStaff",
  "awaitingPayment"
];

// grid 2 คอลัมน์บนจอเล็ก แถวเรียงตรงกันอ่านง่ายกว่า flex-wrap เดิมที่ตัดบรรทัดมั่ว
// ตามความยาวป้ายแต่ละอัน — จอกว้าง (sm+) พอมีที่ก็กลับไปเป็นแถวเดียวแบบเดิม
// ไม่มี pos-status-ring-pulse ที่จุดกลม legend อีกต่อไป — จุดกะพริบมีความหมายเฉพาะบน
// การ์ดโต๊ะจริงที่ต้องดึงสายตาว่า "ยังค้างอยู่" ส่วน legend แค่อธิบายว่าสีไหนคืออะไร
// เฉย ๆ ไม่ใช่รายการที่ต้องรีบดู กะพริบตรงนี้เลยเป็นแค่ noise รบกวนสายตาเปล่า ๆ
function StatusLegend() {
  const { t } = useTranslation();

  return (
    <div className="grid shrink-0 grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border bg-background/95 px-4 py-2.5 text-xs text-muted-foreground backdrop-blur-sm sm:flex sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1.5 xl:px-5">
      {STATUS_LEGEND_ORDER.map((status) => (
        <span key={status} className="flex min-w-0 items-center gap-1.5">
          <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", STATUS_STYLE[status].dot)} />
          <span className="truncate">{t(STATUS_LABEL_KEY[status])}</span>
        </span>
      ))}
    </div>
  );
}

function TableCard({
  selected,
  table,
  onOpen
}: {
  selected: boolean;
  table: PosTable;
  onOpen: (table: PosTable) => void;
}) {
  const { t } = useTranslation();
  const visualStatus = tableVisualStatus(table);
  const busy = tableStatus(table) === "busy";
  const seats = tableSeatCount(table);
  const checkInTime = busy ? tableCheckInTime(table) : null;
  const hasOrderAlert = tableHasOrderAlert(table);
  const style = hasOrderAlert ? ORDER_ALERT_STYLE : STATUS_STYLE[visualStatus];
  const statusLabel = hasOrderAlert ? t("pos.tableStatusNewOrderAlert") : t(STATUS_LABEL_KEY[visualStatus]);
  // cashierOrder/awaitingConfirm ทั้งคู่ค้างรอ "อีกฝ่าย" กดยืนยันอยู่ (พนักงาน/ลูกค้า
  // ตามลำดับ) — ใช้วงแหวนกะพริบสีเดียวกับ dot สถานะช่วยดึงสายตาว่ายังไม่จบ ไม่ใช้ตอนมี
  // hasOrderAlert ซ้อนอยู่แล้วเพราะอันนั้นมี pulse สีแดงของตัวเองซึ่งด่วนกว่า
  const hasRingPulse = !hasOrderAlert && Boolean(style.ring);

  return (
    // wrapper แยกไว้ถือ ring-pulse โดยเฉพาะ — Card ข้างในมี overflow-hidden (บังคับมุมโค้ง)
    // ทำให้ box-shadow ปกติที่ล้นออกนอกกรอบโดนตัดจนมองไม่เห็นถ้าใส่ตรง Card เลย wrapper
    // นี้ไม่มี overflow ครอบเลยเรืองแสงออกมาได้เต็มที่ ไม่ไปกลืนกับพื้นการ์ดที่ทาสีทับ
    // เป็นโทนเดียวกันอยู่แล้ว (bg-blue-600/15 เป็นต้น) ด้วย
    <div className={cn("relative rounded-xl", hasRingPulse && cn("pos-status-ring-pulse", style.ring))}>
      <Card
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        className={cn(
          "cursor-pointer overflow-hidden rounded-xl bg-card p-0 shadow-sm outline-none ring-border transition hover:ring-primary/70 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/30",
          style.card,
          // ring กะพริบซ้อนทับสีสถานะเดิม — บอกว่ามีออเดอร์ใหม่เข้ามาสด ๆ โดยไม่เปลี่ยนสีการ์ด
          hasOrderAlert && "pos-table-card-alert",
          selected && "bg-primary/10 shadow-lg shadow-primary/15 ring-2 ring-primary ring-offset-2 ring-offset-background"
        )}
        onClick={() => onOpen(table)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onOpen(table);
        }}
      >
        <CardContent className="flex min-h-36 w-full flex-col p-0 sm:min-h-38 lg:min-h-40 xl:min-h-44">
          <div
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center px-2 py-3 sm:px-3 sm:py-4",
              style.body
            )}
          >
            {selected ? (
              <Badge className="absolute left-2 top-2 z-10 max-w-[calc(100%-4rem)] gap-1 rounded-full border-primary/30 bg-primary px-2 py-0.5 text-2xs font-black text-primary-foreground shadow-sm [&_svg]:size-3 [&_svg]:shrink-0 sm:left-3 sm:top-3">
                <Check aria-hidden="true" />
                <span className="truncate">{t("pos.selectedTable")}</span>
              </Badge>
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "absolute right-2.5 top-2.5 size-3 rounded-full border-[3px] border-background shadow-sm sm:right-3 sm:top-3",
                style.dot
              )}
            />
            <span className="text-xs font-medium text-muted-foreground">
              {t("nav.table")}
            </span>
            <span className="mt-1 text-xl font-bold leading-none tracking-normal text-foreground sm:text-2xl">
              {table.table_name}
            </span>
            <span className={cn("mt-1.5 text-xs font-semibold sm:mt-2", style.text)}>
              {statusLabel}
            </span>
          </div>
          <div
            className={cn(
              "flex h-8 items-center gap-1.5 border-t px-3 text-xs text-muted-foreground sm:h-8.5",
              style.footer
            )}
          >
            <UserRound aria-hidden="true" className="size-3.5" />
            <span>{seats || "-"}</span>
            {checkInTime ? (
              <span className="ml-auto flex items-center gap-1">
                <Clock aria-hidden="true" className="size-3.5" />
                {checkInTime}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
