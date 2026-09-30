"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown, Columns3, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReportColumnPinning } from "@/features/report/shared/report-sticky-table";

// เลือกคอลัมน์ที่จะแสดงในตารางรายงาน — UX เดียวกับเมนู "Columns" ของ shadcn Data Table
// (DropdownMenuCheckboxItem ต่อคอลัมน์) แต่ไม่ใช้ TanStack Table: ตารางรายงานบางตัวจัดกลุ่มแถวตามบิล
// และคำนวณ colSpan เอง ซึ่ง TanStack ไม่ได้ช่วยอะไร จึงเก็บแค่ "ชุดคอลัมน์ที่ซ่อน" ไว้ต่อรายงาน
// คอลัมน์ที่ "ล็อก" (ค้างซ้ายตอนเลื่อนแนวนอน) เก็บแบบเดียวกันในอีก key หนึ่ง ติ๊กที่หัวคอลัมน์ — ดู report-column-head.tsx
// ค่าจำไว้ใน localStorage ต่อเครื่อง (ความชอบส่วนตัว ไม่ใช่ข้อมูลที่ต้องแชร์) — อ่าน/เขียนพังได้เสมอ จึงห่อ try/catch

export type ReportColumnOption = {
  id: string;
  label: string;
  /** false = คอลัมน์หลักที่ซ่อนไม่ได้ (เช่นเลขบิล) — ยังล็อกได้ */
  hideable?: boolean;
  /** false = ล็อกไม่ได้ */
  pinnable?: boolean;
};

export type ReportColumnVisibility = {
  isVisible: (id: string) => boolean;
  setVisible: (id: string, visible: boolean) => void;
  reset: () => void;
  hiddenCount: number;
  /** ส่งให้ตาราง (useStickyTable + ตัวติ๊กที่หัวคอลัมน์) — ตารางแจ้งกลับว่าตัวไหนจอแคบเกินจะล็อก */
  pinning: ReportColumnPinning;
};

const CHANGE_EVENT = "report-column-visibility-change";

function storageKeyFor(reportId: string) {
  return `yummy-go:report-columns:${reportId}`;
}

function pinnedStorageKeyFor(reportId: string) {
  return `yummy-go:report-pinned-columns:${reportId}`;
}

// ยังไม่เคยบันทึกค่าเลย (แยกจาก "บันทึกว่าไม่ล็อกอะไร" = "[]") — คอลัมน์ที่ล็อกใช้ค่าเริ่มต้นเฉพาะกรณีนี้
const UNSET = "";

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key) ?? UNSET;
  } catch {
    return UNSET;
  }
}

// ค่าล่าสุดต่อ key ในหน่วยความจำ — ใช้ตอน localStorage เขียนไม่ได้ ให้การซ่อน/ล็อกคอลัมน์ยังทำงานในรอบนี้
const memoryIds = new Map<string, string>();

/** keepEmpty = เก็บ "[]" แทนการลบ key — ใช้กับคอลัมน์ที่ล็อก ให้ "ปลดหมดแล้ว" ไม่ย้อนกลับไปเป็นค่าเริ่มต้น */
function writeStorage(key: string, ids: string[], keepEmpty = false) {
  const raw = ids.length || keepEmpty ? JSON.stringify(ids) : UNSET;
  memoryIds.set(key, raw);
  try {
    if (raw) window.localStorage.setItem(key, raw);
    else window.localStorage.removeItem(key);
  } catch {
    // บันทึกไม่ได้ (private mode/storage ถูกบล็อก) — ค่าใน memoryIds ยังใช้ได้จนปิดหน้า
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function parseIds(raw: string) {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function subscribe(callback: () => void) {
  // แท็บอื่นเปลี่ยนค่า → ทิ้งค่าในหน่วยความจำของ key นั้น แล้วอ่านจาก localStorage ใหม่
  function handleStorage(event: StorageEvent) {
    if (event.key) memoryIds.delete(event.key);
    callback();
  }

  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function useStoredIds(key: string) {
  return useSyncExternalStore(
    subscribe,
    () => memoryIds.get(key) ?? readStorage(key),
    () => UNSET,
  );
}

export function useReportColumnVisibility(
  reportId: string,
  options: ReportColumnOption[],
): ReportColumnVisibility {
  const key = storageKeyFor(reportId);
  const pinnedKey = pinnedStorageKeyFor(reportId);
  const raw = useStoredIds(key);
  const pinnedRaw = useStoredIds(pinnedKey);
  // กรองเฉพาะคอลัมน์ที่ยังมีอยู่และซ่อนได้ — กันค่าค้างจากเวอร์ชันเก่าไปซ่อนคอลัมน์หลัก
  const hidden = useMemo(() => {
    const hideable = new Set(options.filter((option) => option.hideable !== false).map((option) => option.id));
    return new Set(parseIds(raw).filter((id) => hideable.has(id)));
  }, [options, raw]);
  // คอลัมน์ที่ซ่อนอยู่ยังจำว่าล็อกไว้ แต่ไม่ส่งไปล็อกจนกว่าจะแสดงอีกครั้ง
  // ยังไม่เคยตั้งค่า = ล็อกคอลัมน์หลัก (คอลัมน์แรกที่ซ่อนไม่ได้ เช่นสินค้า/ลูกค้า/เลขบิล) ไว้ก่อน ให้ผู้ใช้เห็นทันทีว่า
  // ล็อกคอลัมน์ได้ — ติ๊กออกแล้วบันทึก "[]" จึงไม่กลับมาล็อกเองอีก
  const pinned = useMemo(() => {
    const pinnable = options.filter((option) => option.pinnable !== false);
    if (pinnedRaw === UNSET) {
      const primary = pinnable.find((option) => option.hideable === false) ?? pinnable[0];
      return new Set(primary ? [primary.id] : []);
    }
    const pinnableIds = new Set(pinnable.map((option) => option.id));
    return new Set(parseIds(pinnedRaw).filter((id) => pinnableIds.has(id)));
  }, [options, pinnedRaw]);
  const pinnedIds = useMemo(
    () => options.filter((option) => pinned.has(option.id) && !hidden.has(option.id)).map((option) => option.id),
    [hidden, options, pinned],
  );

  const setVisible = useCallback(
    (id: string, visible: boolean) => {
      const next = new Set(hidden);
      if (visible) next.delete(id);
      else next.add(id);
      writeStorage(key, [...next]);
    },
    [hidden, key],
  );

  const setPinned = useCallback(
    (id: string, value: boolean) => {
      const next = new Set(pinned);
      if (value) next.add(id);
      else next.delete(id);
      writeStorage(pinnedKey, [...next], true);
    },
    [pinned, pinnedKey],
  );

  const reset = useCallback(() => writeStorage(key, []), [key]);
  const isVisible = useCallback((id: string) => !hidden.has(id), [hidden]);
  const isPinned = useCallback((id: string) => pinned.has(id), [pinned]);

  // ตารางวัดจริงแล้วแจ้งกลับว่าตัวไหนจอแคบเกินจะล็อก — ตัวติ๊กที่หัวคอลัมน์บอกผู้ใช้ แทนที่ติ๊กแล้วเงียบ
  const [reportedUnfit, setReportedUnfit] = useState<string[]>([]);
  const onFitChange = useCallback((ids: string[]) => {
    setReportedUnfit((current) => (current.join("\u0000") === ids.join("\u0000") ? current : ids));
  }, []);
  // กรองกับชุดที่ล็อกอยู่ตอนนี้ — ระหว่างรอตารางวัดใหม่หลังปลดล็อก จะไม่ค้างป้ายของคอลัมน์ที่ปลดไปแล้ว
  const unfitPinnedIds = useMemo(
    () => reportedUnfit.filter((id) => pinnedIds.includes(id)),
    [pinnedIds, reportedUnfit],
  );
  const pinnableIds = useMemo(
    () => new Set(options.filter((option) => option.pinnable !== false).map((option) => option.id)),
    [options],
  );
  const pinning = useMemo<ReportColumnPinning>(
    () => ({
      ids: pinnedIds,
      onFitChange,
      controls: {
        canPin: (id) => pinnableIds.has(id) && !hidden.has(id),
        isPinned,
        isUnfit: (id) => unfitPinnedIds.includes(id),
        setPinned,
      },
    }),
    [hidden, isPinned, onFitChange, pinnableIds, pinnedIds, setPinned, unfitPinnedIds],
  );

  return {
    hiddenCount: hidden.size,
    isVisible,
    pinning,
    reset,
    setVisible,
  };
}

export function ReportColumnsMenu({
  disabled = false,
  heading,
  label,
  options,
  visibility,
}: {
  disabled?: boolean;
  /** หัวข้อในเมนู (ค่าเริ่มต้น "แสดงคอลัมน์") */
  heading?: string;
  /** ข้อความปุ่ม — รายงานที่ตารางกลับแกน (แถว = ตัวชี้วัด) ใช้ "ตัวชี้วัด" แทน "คอลัมน์" */
  label?: string;
  options: ReportColumnOption[];
  visibility: ReportColumnVisibility;
}) {
  const { t } = useTranslation();
  const buttonLabel = label ?? t("report.columnsMenu");

  // ล็อกคอลัมน์ติ๊กที่หัวคอลัมน์ของตารางเอง (report-column-head.tsx) เมนูนี้จึงเหลือแค่แสดง/ซ่อน
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} aria-label={buttonLabel}>
          <Columns3 data-icon="inline-start" />
          <span className="hidden sm:inline">{buttonLabel}</span>
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-56 [scrollbar-width:thin]">
        <DropdownMenuLabel>{heading ?? t("report.toggleColumns")}</DropdownMenuLabel>
        <DropdownMenuItem disabled={!visibility.hiddenCount} onSelect={visibility.reset}>
          <RotateCcw />
          {t("report.resetColumns")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {options
            .filter((option) => option.hideable !== false)
            .map((option) => (
              <DropdownMenuCheckboxItem
                key={option.id}
                checked={visibility.isVisible(option.id)}
                // ค้างเมนูไว้ ติ๊กหลายคอลัมน์ต่อกันได้โดยไม่ต้องเปิดใหม่ทุกครั้ง
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) => visibility.setVisible(option.id, checked === true)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
