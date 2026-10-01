"use client";

import { useLayoutEffect, useRef, useState } from "react";

// ล็อกคอลัมน์ให้ค้างซ้ายตอนเลื่อนตารางแนวนอน — ตารางรายงานเขียนเองทั้งหมด (จัดกลุ่มแถวตามบิล,
// colSpan/rowSpan ในหัวตาราง, แถวรวมที่รวมหลายคอลัมน์) จึงคำนวณจาก DOM จริงแทนการให้ทุก cell ส่ง
// offset เอง: ตารางแค่ติด data-col="<id>" ที่หัวคอลัมน์ แล้ว hook นี้วัดความกว้าง ไล่ตำแหน่งคอลัมน์
// ของทุก cell (นับ colSpan/rowSpan) แล้วใส่ position: sticky + left ให้ cell ที่อยู่ในคอลัมน์ที่ล็อก
// คอลัมน์นำหน้าที่ไม่มี data-col (ช่องติ๊กเลือก, ลำดับ) ค้างตามไปด้วยเมื่อมีคอลัมน์ใดถูกล็อก
//
// ล็อกแถวแนวตั้ง: แถวที่กดหมุด (ReportRowPinToggle — [data-row-pin][aria-pressed=true]) ค้างใต้หัวตารางตอนเลื่อน
// ขึ้นลง แยกจาก checkbox เลือกแถว (ที่กรองสรุป/ส่งออก) — ดู docs/Decisions.md 2026-09-30

/** ล็อกรวมกันกว้างเกินสัดส่วนนี้ของพื้นที่ตาราง = ไม่เหลือที่ให้เลื่อนดู จึงไม่ล็อก (เช่นบนมือถือ) */
const MAX_PINNED_SHARE = 0.6;

/** แถวที่ล็อกรวมกันสูงเกินสัดส่วนนี้ของพื้นที่ตาราง = แถวที่เหลือไม่ล็อก ให้ยังเหลือที่เลื่อนดูข้อมูล */
const MAX_PINNED_ROW_SHARE = 0.4;

// พื้นหลังทึบของ cell ที่ค้าง (ไม่งั้นคอลัมน์ที่เลื่อนผ่านจะโผล่ทะลุ): พื้น background แล้ววางสีของแถว
// (--pinned-row-bg ที่ hook อ่านจากแถวจริง เช่นแถวบิลยกเลิกสีแดงจาง) เป็นชั้น gradient ทับ
// hover = muted/50 แบบเดียวกับ TableRow, เลือกแล้ว = muted
// แถวรวม (ค้างขอบล่างอยู่แล้ว) มีพื้นของตัวเอง จึงถูกทำเครื่องหมายแยกเป็น "sticky" และไม่ถูกแตะ
export const STICKY_TABLE_CLASS = [
  "[&_th[data-pinned=head]]:bg-muted",
  "[&_td[data-pinned=cell]]:bg-background",
  "[&_td[data-pinned=cell]]:bg-[linear-gradient(var(--pinned-row-bg,transparent),var(--pinned-row-bg,transparent))]",
  "[&_tr:hover>td[data-pinned=cell]]:bg-linear-to-r [&_tr:hover>td[data-pinned=cell]]:from-muted/50 [&_tr:hover>td[data-pinned=cell]]:to-muted/50",
  "[&_tr[data-state=selected]>td[data-pinned=cell]]:bg-muted",
  // เส้นขอบขวาของคอลัมน์สุดท้ายที่ค้าง บอกว่าข้อมูลเลื่อนลอดใต้ตรงนี้
  "[&_[data-pinned-edge]]:shadow-[inset_-1px_0_0_var(--border)]",
  // แถวที่ค้าง: พื้นทึบ + สีจริงของแถว (--pinned-row-bg: สีเลือก, บิลยกเลิก, ค้างชำระ) + เส้นขอบล่างของแถวสุดท้าย
  "[&_td[data-pinned-row]]:bg-background",
  "[&_td[data-pinned-row]]:bg-[linear-gradient(var(--pinned-row-bg,transparent),var(--pinned-row-bg,transparent))]",
  // ชี้แถวที่ค้าง = สี hover แบบเดียวกับ TableRow (สีที่อ่านไว้เป็นค่าคงที่ จึงต้องทับเอง)
  "[&_tr:hover>td[data-pinned-row]]:bg-linear-to-r [&_tr:hover>td[data-pinned-row]]:from-muted/50 [&_tr:hover>td[data-pinned-row]]:to-muted/50",
  "[&_td[data-pinned-row-edge]]:shadow-[inset_0_-1px_0_var(--border)]",
  "[&_td[data-pinned-row-edge][data-pinned-edge]]:shadow-[inset_-1px_0_0_var(--border),inset_0_-1px_0_var(--border)]",
].join(" ");

type CellSpan = { cell: HTMLTableCellElement; end: number; start: number };

// ตำแหน่งคอลัมน์ของทุก cell แบบที่เบราว์เซอร์วาง: cell ที่ rowSpan จากแถวบนจองช่องไว้ แถวล่างต้องข้าม
// rowSpan ไม่ข้ามส่วน thead/tbody/tfoot จึงเริ่มนับช่องที่จองใหม่ทุกครั้งที่เปลี่ยนส่วน
function cellSpans(table: HTMLTableElement) {
  const spans: CellSpan[] = [];
  let section: Element | null = null;
  let occupied: number[] = [];

  for (const row of Array.from(table.rows)) {
    if (row.parentElement !== section) {
      section = row.parentElement;
      occupied = [];
    }
    let column = 0;
    for (const cell of Array.from(row.cells)) {
      while ((occupied[column] ?? 0) > 0) column += 1;
      const width = Math.max(1, cell.colSpan);
      const height = Math.max(1, cell.rowSpan);
      spans.push({ cell, end: column + width - 1, start: column });
      for (let index = column; index < column + width; index += 1) {
        occupied[index] = Math.max(occupied[index] ?? 0, height);
      }
      column += width;
    }
    occupied = occupied.map((rows) => Math.max(0, rows - 1));
  }

  return spans;
}

function clearPinned(table: HTMLTableElement) {
  for (const cell of Array.from(table.querySelectorAll<HTMLTableCellElement>("[data-pinned]"))) {
    cell.style.removeProperty("position");
    cell.style.removeProperty("left");
    cell.style.removeProperty("z-index");
    cell.style.removeProperty("clip-path");
    cell.removeAttribute("data-pinned");
    cell.removeAttribute("data-pinned-edge");
    cell.removeAttribute("data-pinned-clip");
    cell.removeAttribute("data-pinned-from");
  }
}

// cell ที่ค้างแค่บางส่วน: เลื่อนไปเท่าไร ตัดขอบขวาออกเท่านั้น (ไม่เกินส่วนที่อยู่นอกคอลัมน์ที่ล็อก)
function updateClips(container: HTMLElement, table: HTMLTableElement) {
  for (const cell of Array.from(table.querySelectorAll<HTMLTableCellElement>("[data-pinned-clip]"))) {
    const maxClip = Number(cell.dataset.pinnedClip) || 0;
    const shifted = Math.max(0, container.scrollLeft - (Number(cell.dataset.pinnedFrom) || 0));
    const clip = Math.min(maxClip, shifted);
    if (clip > 0) cell.style.clipPath = `inset(0 ${clip}px 0 0)`;
    else cell.style.removeProperty("clip-path");
  }
}

function clearPinnedRows(table: HTMLTableElement) {
  for (const cell of Array.from(table.querySelectorAll<HTMLTableCellElement>("[data-pinned-row]"))) {
    cell.style.removeProperty("top");
    // cell ที่ค้างคอลัมน์ด้วย: position/z-index เป็นของ clearPinned
    if (cell.dataset.pinned === undefined) {
      cell.style.removeProperty("position");
      cell.style.removeProperty("z-index");
    }
    cell.removeAttribute("data-pinned-row");
    cell.removeAttribute("data-pinned-row-edge");
  }
}

const ROW_PIN_SELECTOR = '[data-row-pin][aria-pressed="true"]';

/**
 * แถวที่กดหมุดค้างใต้หัวตาราง เรียงตามลำดับในตาราง จนเต็มงบความสูง — แถวที่เกินงบไม่ค้าง และติด
 * data-row-pin-unfit ที่ปุ่มหมุดของแถวนั้น ให้ปุ่มแสดงว่า "ล็อกเต็มแล้ว" แทนการไม่ล็อกเฉยๆ
 */
function applyPinnedRows(container: HTMLElement, table: HTMLTableElement): HTMLTableRowElement[] {
  for (const toggle of Array.from(table.querySelectorAll("[data-row-pin-unfit]"))) {
    toggle.removeAttribute("data-row-pin-unfit");
  }
  const rows = Array.from(table.tBodies).flatMap((body) =>
    Array.from(body.rows).filter((row) => row.querySelector(ROW_PIN_SELECTOR)),
  );
  if (!rows.length) return [];

  const headHeight = table.tHead?.getBoundingClientRect().height ?? 0;
  const budget = container.clientHeight * MAX_PINNED_ROW_SHARE;
  const pinned: Array<{ row: HTMLTableRowElement; top: number }> = [];
  let used = 0;
  for (const row of rows) {
    const height = row.getBoundingClientRect().height;
    // แถวแรกที่ไม่พอดี แถวถัดไปก็ไม่ล็อกทั้งหมด ให้แถวที่ค้างติดกันเป็นก้อนเดียวตามลำดับ
    if (pinned.length < rows.indexOf(row) || used + height > budget) {
      row.querySelector(ROW_PIN_SELECTOR)?.setAttribute("data-row-pin-unfit", "");
      continue;
    }
    pinned.push({ row, top: headHeight + used });
    used += height;
  }

  pinned.forEach(({ row, top }, index) => {
    const rowBackground = window.getComputedStyle(row).backgroundColor;
    for (const cell of Array.from(row.cells)) {
      cell.style.setProperty("--pinned-row-bg", rowBackground);
      cell.dataset.pinnedRow = "";
      if (index === pinned.length - 1) cell.dataset.pinnedRowEdge = "";
      cell.style.position = "sticky";
      cell.style.top = `${top}px`;
      // เหนือ cell ที่เลื่อนผ่านและคอลัมน์ที่ค้าง (5) — มุมที่ค้างทั้งแถวและคอลัมน์อยู่บนสุด ใต้หัวตาราง (z-30)
      cell.style.zIndex = cell.dataset.pinned === undefined ? "10" : "12";
    }
  });
  return pinned.map(({ row }) => row);
}

/** ล็อกคอลัมน์ที่ขอ แล้วคืน id ที่ขอไว้แต่จอแคบเกินจะล็อก */
function applyPinned(container: HTMLElement, table: HTMLTableElement, pinnedIds: ReadonlySet<string>) {
  clearPinned(table);
  if (!pinnedIds.size) return [];

  const spans = cellSpans(table);
  const widths: number[] = [];
  let firstLabelled = Number.POSITIVE_INFINITY;
  const requested: Array<{ end: number; id: string; start: number }> = [];

  for (const span of spans) {
    if (span.start === span.end && widths[span.start] === undefined) {
      widths[span.start] = span.cell.getBoundingClientRect().width;
    }
    const id = span.cell.dataset.col;
    if (!id || span.cell.tagName !== "TH") continue;
    firstLabelled = Math.min(firstLabelled, span.start);
    if (pinnedIds.has(id)) requested.push({ end: span.end, id, start: span.start });
  }
  if (!requested.length) return [];

  // ล็อกไล่จากซ้ายไปจนเต็มงบความกว้าง แทนที่จะยกเลิกทั้งหมดเมื่อรวมกันเกิน (จอมือถือยังล็อกเลขบิลได้
  // แม้จะติ๊กวันที่ไว้ด้วย) — ตัวแรกที่ไม่พอดี ตัวถัดไปทั้งหมดก็ไม่ล็อก ให้คอลัมน์ที่ค้างติดกันเป็นก้อนเดียว
  // คอลัมน์นำหน้า (ช่องติ๊ก, ลำดับ) นับเข้างบด้วยเพราะค้างตามไปทุกครั้ง
  requested.sort((a, b) => a.start - b.start);
  const budget = container.clientWidth * MAX_PINNED_SHARE;
  const pinned = new Set<number>();
  let used = 0;
  for (let index = 0; index < firstLabelled && index < widths.length; index += 1) used += widths[index] ?? 0;
  const unfit: string[] = [];
  for (const column of requested) {
    let width = 0;
    for (let index = column.start; index <= column.end; index += 1) width += widths[index] ?? 0;
    if (unfit.length || used + width > budget) {
      unfit.push(column.id);
      continue;
    }
    used += width;
    for (let index = column.start; index <= column.end; index += 1) pinned.add(index);
  }
  if (!pinned.size) return unfit;
  for (let index = 0; index < firstLabelled && index < widths.length; index += 1) pinned.add(index);

  const columns = [...pinned].sort((a, b) => a - b);
  const offsets = new Map<number, number>();
  let total = 0;
  for (const column of columns) {
    offsets.set(column, total);
    total += widths[column] ?? 0;
  }

  const edge = columns[columns.length - 1];
  for (const span of spans) {
    let covered = true;
    for (let index = span.start; index <= span.end && covered; index += 1) covered = pinned.has(index);
    if (!covered && !pinned.has(span.start)) continue;

    const { cell } = span;
    // อ่านก่อนแตะ style: แถวรวมค้างขอบล่าง (sticky อยู่แล้ว, z-20) ต้องลอยเหนือ cell ข้างเคียงต่อไป
    const computed = window.getComputedStyle(cell);
    const baseZ = Number.parseInt(computed.zIndex, 10) || 0;
    const alreadySticky = computed.position === "sticky";

    if (!covered) {
      // cell ที่กินทั้งคอลัมน์ที่ล็อกและไม่ล็อก (ป้าย "สรุป" ของแถวรวม, หัวกลุ่ม) — ถ้าปล่อยเลื่อน ยอดของ
      // คอลัมน์ถัดไปจะไหลมาอยู่ใต้คอลัมน์ที่ล็อก ดูเหมือนเป็นยอดของคอลัมน์นั้น จึงค้างไว้ แล้วตัดส่วนที่เกิน
      // ความกว้างที่ล็อกออกตามระยะที่เลื่อน (updateClips) ให้ยอดที่เลื่อนเข้ามาโผล่ต่อได้ปกติ
      // หัวตาราง, แถวรวม และ cell ข้อมูลที่เริ่มในคอลัมน์ที่มีชื่อ (ชื่อสินค้าในแถวรายการของรายงานละเอียดที่กิน
      // คอลัมน์ข้อความทั้งหมด — ปล่อยเลื่อนแล้วชื่อสินค้าหายไปใต้คอลัมน์ที่ล็อก) ส่วน cell ที่กินเต็มแถวตั้งแต่ช่องนำหน้า
      // (รายละเอียดที่ขยาย) ต้องเลื่อนตามปกติ
      if (cell.tagName !== "TH" && !alreadySticky && span.start < firstLabelled) continue;
      let pinnedWidth = 0;
      for (let index = span.start; index <= span.end && pinned.has(index); index += 1) pinnedWidth += widths[index] ?? 0;
      const offset = offsets.get(span.start) ?? 0;
      cell.dataset.pinned = cell.tagName === "TH" ? "head" : alreadySticky ? "sticky" : "cell";
      const spanRow = cell.parentElement;
      if (cell.dataset.pinned === "cell" && spanRow && !spanRow.matches(":hover")) {
        cell.style.setProperty("--pinned-row-bg", window.getComputedStyle(spanRow).backgroundColor);
      }
      cell.dataset.pinnedClip = String(Math.max(0, cell.getBoundingClientRect().width - pinnedWidth));
      cell.dataset.pinnedFrom = String(cell.offsetLeft - offset);
      cell.style.position = "sticky";
      cell.style.left = `${offset}px`;
      cell.style.zIndex = String(baseZ + 5);
      continue;
    }

    cell.dataset.pinned = cell.tagName === "TH" ? "head" : alreadySticky ? "sticky" : "cell";
    // สีของแถวตอนไม่ได้ชี้ — แถวที่เมาส์ชี้อยู่ (เช่นเพิ่งคลิกติ๊กเลือก) คงค่าเดิมไว้ ไม่งั้นสี hover จะค้าง
    const row = cell.parentElement;
    if (cell.dataset.pinned === "cell" && row && !row.matches(":hover")) {
      cell.style.setProperty("--pinned-row-bg", window.getComputedStyle(row).backgroundColor);
    }
    if (span.end === edge) cell.dataset.pinnedEdge = "";
    cell.style.position = "sticky";
    cell.style.left = `${offsets.get(span.start) ?? 0}px`;
    cell.style.zIndex = String(baseZ + 5);
  }
  return unfit;
}

/** คอลัมน์ที่ล็อก + ช่องให้ตารางบอกกลับว่าตัวไหนจอแคบเกินจะล็อก (เมนูล็อกคอลัมน์เอาไปแสดง) */
export type ReportColumnPinning = {
  ids: readonly string[];
  onFitChange: (unfitIds: string[]) => void;
  /** ตัวติ๊กล็อกที่หัวคอลัมน์ (ReportColumnPinToggle) — ไม่มี = ตารางนี้ไม่มีตัวติ๊กที่หัวคอลัมน์ */
  controls?: ReportColumnPinControls;
};

export type ReportColumnPinControls = {
  canPin: (id: string) => boolean;
  isPinned: (id: string) => boolean;
  /** ติ๊กไว้แต่จอแคบเกินจะล็อก */
  isUnfit: (id: string) => boolean;
  setPinned: (id: string, pinned: boolean) => void;
};

export const NO_COLUMN_PINNING: ReportColumnPinning = { ids: [], onFitChange: () => {} };

/**
 * คืน ref สำหรับ `containerRef` ของ `<Table>` — ตารางต้องติด `data-col` ที่หัวคอลัมน์ และใส่
 * `STICKY_TABLE_CLASS` ใน `containerClassName` ให้ cell ที่ค้างมีพื้นทึบ
 * ล็อกแถวที่กดหมุด (ReportRowPinToggle) ด้วยเสมอ ไม่ต้องตั้งค่า
 */
export function useStickyTable({ ids, onFitChange }: ReportColumnPinning) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const key = ids.join("\u0000");
  const onFitChangeRef = useRef(onFitChange);
  useLayoutEffect(() => {
    onFitChangeRef.current = onFitChange;
  }, [onFitChange]);

  useLayoutEffect(() => {
    const table = container?.querySelector("table");
    if (!container || !table) return;

    const pinned = new Set(key ? key.split("\u0000") : []);
    let reported = "";
    const clip = () => updateClips(container, table);
    // สีแถวที่อ่านตอนเมาส์ชี้อยู่เป็นสี hover (เพิ่งกดหมุด) — ออกจากแถวที่ค้างแล้ววัดใหม่ให้ได้สีจริง
    // ถอดตัวฟังจากแถวที่เลิกค้างทุกรอบ ไม่งั้นแถวของหน้าเก่าที่หลุดจาก DOM ค้างอยู่ในหน่วยความจำ
    let hoverRows = new Set<HTMLTableRowElement>();
    const apply = () => {
      clearPinnedRows(table);
      const unfit = applyPinned(container, table, pinned);
      const nextHoverRows = new Set(applyPinnedRows(container, table));
      for (const row of hoverRows) {
        if (!nextHoverRows.has(row)) row.removeEventListener("pointerleave", apply);
      }
      for (const row of nextHoverRows) row.addEventListener("pointerleave", apply);
      hoverRows = nextHoverRows;
      clip();
      // แจ้งเฉพาะตอนเปลี่ยน — apply วิ่งทุกครั้งที่แถว/ขนาดเปลี่ยน
      const next = unfit.join("\u0000");
      if (next !== reported) {
        reported = next;
        onFitChangeRef.current(unfit);
      }
    };
    apply();
    container.addEventListener("scroll", clip, { passive: true });

    // แถวเปลี่ยน (หน้าใหม่, ขยายบิล, ซ่อนคอลัมน์, กดหมุดแถว) หรือความกว้างเปลี่ยน = วัดใหม่ก่อนวาดเฟรมถัดไป
    // attribute ดูแค่ aria-pressed ของปุ่มหมุดแถว — style/data-pinned ที่ใส่เองไม่อยู่ในรายการ จึงไม่วนเรียกตัวเอง
    const mutations = new MutationObserver((records) => {
      const relevant = records.some(
        (record) =>
          record.type !== "attributes" ||
          (record.target instanceof Element && record.target.hasAttribute("data-row-pin")),
      );
      if (relevant) apply();
    });
    mutations.observe(table, {
      attributeFilter: ["aria-pressed"],
      characterData: true,
      childList: true,
      subtree: true,
    });
    const resize = new ResizeObserver(apply);
    resize.observe(container);
    resize.observe(table);

    return () => {
      container.removeEventListener("scroll", clip);
      mutations.disconnect();
      resize.disconnect();
      for (const row of hoverRows) row.removeEventListener("pointerleave", apply);
      clearPinnedRows(table);
      clearPinned(table);
      for (const cell of Array.from(table.querySelectorAll<HTMLTableCellElement>("td"))) {
        cell.style.removeProperty("--pinned-row-bg");
      }
      if (reported) onFitChangeRef.current([]);
    };
  }, [container, key]);

  return setContainer;
}
