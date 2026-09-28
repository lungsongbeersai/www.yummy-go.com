"use client";

import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

/**
 * มุมมองรายการ (ตาราง 9 คอลัมน์) ของ order-queue-page.tsx — position: sticky บน <thead>
 * (หรือแม้แต่บน <th>) ไม่เสถียรข้ามเบราว์เซอร์ตามที่ยืนยันจากการทดสอบจริงมาแล้ว 2 รอบ
 * (หัวตารางหลุดตำแหน่ง ไม่ล็อกอยู่ที่ขอบจริง) จึงเลิกพึ่ง sticky ทั้งหมด — แยกหัวออกเป็น
 * คนละ <table> ที่อยู่นอกกล่องเลื่อน แล้วบังคับความกว้างคอลัมน์ให้ตรงกันเป๊ะทั้งสองตารางด้วย
 * colgroup + table-layout:fixed ชุดเดียวกัน (ตัวเลขสรุปท้ายตารางเดิมย้ายไปอยู่ที่
 * order-queue-summary-bar.tsx เหนือรายการแล้ว)
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

/**
 * ตารางเนื้อหา — ตัวเดียวที่อยู่ในกล่องเลื่อนจริง มีแค่ tbody ไม่มี thead ปนอยู่
 * ตั้งใจไม่ใส่ flex-1 (ไม่บังคับให้ยืดเต็มพื้นที่ที่เหลือ) — ถ้ามีแค่ 1-2 แถว กล่องนี้จะ
 * หด (shrink) ลงตามเนื้อหาจริงแทน Card จะไม่มีช่องว่างขาวยาวใต้แถวสุดท้าย
 * ส่วนตอนข้อมูลเยอะเกินพื้นที่ Card (ซึ่งมี flex-1 ของตัวมันเอง
 * อยู่แล้ว) flexbox จะบีบกล่องนี้ลง (shrink ค่าเริ่มต้น = 1) จนพอดีพื้นที่ที่เหลือแล้วเลื่อนแทน
 * เหมือนเดิม — min-h-0 จำเป็นเพื่อให้บีบลงต่ำกว่าความสูงเนื้อหาจริงได้
 */
export function OrderQueueTableBody({
  children,
  onScroll
}: {
  children: React.ReactNode;
  /** ใช้ sync ตำแหน่งเลื่อนแนวนอนไปยังตารางหัว (ดู useOrderQueueTableScrollSync) */
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
 * คอลัมน์สินค้าที่ยืดได้) มักเกินความกว้างจอ — ตารางหัว/เนื้อหาเป็นคนละ <table> แยกกัน
 * (ดูเหตุผลด้านบนสุดของไฟล์) จึงต้อง sync ตำแหน่งเลื่อนแนวนอนเองด้วย JS แทนที่จะพึ่ง
 * table เดียวเลื่อนตามธรรมชาติ — ตารางหัวไม่มี scrollbar ของตัวเอง (overflow-hidden)
 * แต่ยังรับค่า scrollLeft ที่ตั้งผ่าน JS ได้ปกติ (overflow:hidden ไม่ได้ปิดกั้น scrollLeft
 * แค่ปิดกั้น scrollbar/การเลื่อนโต้ตอบโดยตรงเท่านั้น) จึงเลื่อนตามตารางเนื้อหาได้พอดีโดยไม่มี
 * scrollbar ซ้ำซ้อนสองอัน
 */
export function useOrderQueueTableScrollSync() {
  const headRef = useRef<HTMLDivElement>(null);

  const handleBodyScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (headRef.current) headRef.current.scrollLeft = event.currentTarget.scrollLeft;
  }, []);

  return { headRef, handleBodyScroll };
}
