"use client";

import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { formatQueueWait } from "@/features/pos/order-queue/order-queue-view";

/**
 * ตารางคิวออเดอร์มีทั้งหมด 9 คอลัมน์เท่ากันทุกที่ที่ใช้ (order-queue-page.tsx และ
 * order-queue-manage-panel.tsx) — position: sticky บน <thead>/<tfoot> (หรือแม้แต่บน
 * <th>/<td> ของมัน) ไม่เสถียรข้ามเบราว์เซอร์ตามที่ยืนยันจากการทดสอบจริงมาแล้ว 2 รอบ
 * (หัวตาราง/ท้ายตารางหลุดตำแหน่ง ไม่ล็อกอยู่ที่ขอบจริง) จึงเลิกพึ่ง sticky ทั้งหมด —
 * แยกหัวและท้ายออกเป็นคนละ <table> ที่อยู่นอกกล่องเลื่อน (ไม่มีวันเลื่อนหลุดเพราะมันไม่ได้
 * อยู่ในกล่องเลื่อนตั้งแต่แรก) แล้วบังคับความกว้างคอลัมน์ให้ตรงกันเป๊ะทั้ง 3 ตารางด้วย
 * colgroup + table-layout:fixed ชุดเดียวกัน เพื่อให้แนวคอลัมน์ของหัว/เนื้อหา/ท้ายตรงกัน
 */
// สถานะ/ปุ่ม action วัดความกว้างจากป้ายภาษาลาวตอนแรก (สั้นกว่าอังกฤษมาก) — พอสลับเป็น EN
// ("Waiting for customer" 21 ตัวอักษร, "Send to kitchen" + "Cancel" สองปุ่มเรียงกัน)
// ตัวหนังสือ/ปุ่มล้นออกนอกคอลัมน์ตัวเองไปทับคอลัมน์ข้าง ๆ เพราะ table-layout:fixed ไม่ยอม
// ให้คอลัมน์ขยายตามเนื้อหา — วัดความกว้างจากภาษาที่ยาวที่สุด (อังกฤษ) แทนเผื่อทุกภาษาพอดี
const COLUMN_WIDTHS: ReadonlyArray<string | undefined> = [
  "2.5rem", // checkbox
  "6rem", // wait
  "5rem", // table
  undefined, // product — กินพื้นที่ที่เหลือทั้งหมด (col ที่ไม่ระบุ width ใน table-layout:fixed)
  "4rem", // qty
  "5rem", // order number
  "5rem", // arrived
  "10rem", // status — พอดี "Waiting for customer" (ยาวสุดในทุกภาษาที่รองรับ)
  "18rem" // action — พอดีปุ่ม "Send to kitchen" + "Cancel" เรียงกันในแถวเดียว
];

export const ORDER_QUEUE_TABLE_COLUMN_COUNT = COLUMN_WIDTHS.length;

function OrderQueueColGroup() {
  return (
    <colgroup>
      {COLUMN_WIDTHS.map((width, index) => (
        <col key={index} style={width ? { width } : undefined} />
      ))}
    </colgroup>
  );
}

interface OrderQueueTableHeadProps {
  headerChecked: boolean | "indeterminate";
  showCheckbox: boolean;
  onToggleAll: (checked: boolean) => void;
  /** ใช้ sync ตำแหน่งเลื่อนแนวนอนจากตารางเนื้อหา (ดู useOrderQueueTableScrollSync) */
  scrollContainerRef?: React.Ref<HTMLDivElement>;
}

/** ตารางหัว — อยู่นอกกล่องเลื่อนเสมอ ไม่ต้องพึ่ง sticky เพราะมันไม่ได้อยู่ในส่วนที่เลื่อนตั้งแต่แรก */
export function OrderQueueTableHead({
  headerChecked,
  showCheckbox,
  onToggleAll,
  scrollContainerRef
}: OrderQueueTableHeadProps) {
  const { t } = useTranslation();

  return (
    <Table
      className="table-fixed"
      containerClassName="shrink-0 overflow-hidden"
      containerRef={scrollContainerRef}
    >
      <OrderQueueColGroup />
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            {showCheckbox ? (
              <Checkbox
                aria-label={t("common.selectAll")}
                checked={headerChecked}
                onCheckedChange={(checked) => onToggleAll(checked === true)}
              />
            ) : null}
          </TableHead>
          <TableHead>{t("orderQueue.wait")}</TableHead>
          <TableHead>{t("pos.table")}</TableHead>
          <TableHead>{t("pos.product")}</TableHead>
          <TableHead>{t("pos.qty")}</TableHead>
          <TableHead>{t("orderQueue.orderNumber")}</TableHead>
          <TableHead>{t("orderQueue.arrived")}</TableHead>
          <TableHead>{t("common.status")}</TableHead>
          <TableHead className="text-right">{t("orderQueue.actionColumn")}</TableHead>
        </TableRow>
      </TableHeader>
    </Table>
  );
}

/** ตารางท้าย — อยู่นอกกล่องเลื่อนเช่นกัน จึงติดกับขอบล่างของ Card เสมอโดยไม่ต้องใช้ sticky */
export function OrderQueueTableFoot({
  count,
  oldestWait,
  scrollContainerRef
}: {
  count: number;
  oldestWait: number;
  /** ใช้ sync ตำแหน่งเลื่อนแนวนอนจากตารางเนื้อหา (ดู useOrderQueueTableScrollSync) */
  scrollContainerRef?: React.Ref<HTMLDivElement>;
}) {
  const { t } = useTranslation();

  return (
    <Table
      className="table-fixed"
      containerClassName="shrink-0 overflow-hidden"
      containerRef={scrollContainerRef}
    >
      <OrderQueueColGroup />
      <TableFooter>
        <TableRow>
          <TableCell
            colSpan={ORDER_QUEUE_TABLE_COLUMN_COUNT}
            className="text-xs text-muted-foreground"
          >
            <span className="tabular-nums">
              {t("orderQueue.activeOrders", { count })}
            </span>
            {oldestWait > 0 ? (
              <>
                <span aria-hidden="true"> · </span>
                <span className="tabular-nums">
                  {t("orderQueue.oldestWait", { wait: formatQueueWait(oldestWait, t) })}
                </span>
              </>
            ) : null}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}

/**
 * ตารางเนื้อหา — ตัวเดียวที่อยู่ในกล่องเลื่อนจริง มีแค่ tbody ไม่มี thead/tfoot ปนอยู่
 * ตั้งใจไม่ใส่ flex-1 (ไม่บังคับให้ยืดเต็มพื้นที่ที่เหลือ) — ถ้ามีแค่ 1-2 แถว กล่องนี้จะ
 * หด (shrink) ลงตามเนื้อหาจริงแทน ท้ายตาราง (OrderQueueTableFoot) จะได้ตามติดแถวสุดท้าย
 * ทันทีไม่มีช่องว่างขาวคั่นกลาง ส่วนตอนข้อมูลเยอะเกินพื้นที่ Card (ซึ่งมี flex-1 ของตัวมันเอง
 * อยู่แล้ว) flexbox จะบีบกล่องนี้ลง (shrink ค่าเริ่มต้น = 1) จนพอดีพื้นที่ที่เหลือแล้วเลื่อนแทน
 * เหมือนเดิม — min-h-0 จำเป็นเพื่อให้บีบลงต่ำกว่าความสูงเนื้อหาจริงได้
 */
export function OrderQueueTableBody({
  children,
  onScroll
}: {
  children: React.ReactNode;
  /** ใช้ sync ตำแหน่งเลื่อนแนวนอนไปยังตารางหัว/ท้าย (ดู useOrderQueueTableScrollSync) */
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}) {
  return (
    <Table
      className="table-fixed"
      containerClassName="min-h-0 overflow-y-auto overflow-x-auto order-queue-table-scroll-hidden"
      onContainerScroll={onScroll}
    >
      <OrderQueueColGroup />
      <TableBody>{children}</TableBody>
    </Table>
  );
}

/**
 * จอแคบ (แท็บเล็ตแนวตั้ง 768-900px) ความกว้างรวมของ 9 คอลัมน์ (fixed width ส่วนใหญ่ +
 * คอลัมน์สินค้าที่ยืดได้) มักเกินความกว้างจอ — ตารางหัว/เนื้อหา/ท้ายเป็นคนละ <table> แยกกัน
 * (ดูเหตุผลด้านบนสุดของไฟล์) จึงต้อง sync ตำแหน่งเลื่อนแนวนอนเองด้วย JS แทนที่จะพึ่ง
 * table เดียวเลื่อนตามธรรมชาติ — ตารางหัว/ท้ายไม่มี scrollbar ของตัวเอง (overflow-hidden)
 * แต่ยังรับค่า scrollLeft ที่ตั้งผ่าน JS ได้ปกติ (overflow:hidden ไม่ได้ปิดกั้น scrollLeft
 * แค่ปิดกั้น scrollbar/การเลื่อนโต้ตอบโดยตรงเท่านั้น) จึงเลื่อนตามตารางเนื้อหาได้พอดีโดยไม่มี
 * scrollbar ซ้ำซ้อนสามอัน
 */
export function useOrderQueueTableScrollSync() {
  const headRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);

  const handleBodyScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const { scrollLeft } = event.currentTarget;
    if (headRef.current) headRef.current.scrollLeft = scrollLeft;
    if (footRef.current) footRef.current.scrollLeft = scrollLeft;
  }, []);

  return { headRef, footRef, handleBodyScroll };
}
