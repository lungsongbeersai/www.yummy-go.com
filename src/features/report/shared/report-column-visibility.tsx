"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { ChevronDown, Columns3 } from "lucide-react";
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

// เลือกคอลัมน์ที่จะแสดงในตารางรายงาน — UX เดียวกับเมนู "Columns" ของ shadcn Data Table
// (DropdownMenuCheckboxItem ต่อคอลัมน์) แต่ไม่ใช้ TanStack Table: ตารางรายงานบางตัวจัดกลุ่มแถวตามบิล
// และคำนวณ colSpan เอง ซึ่ง TanStack ไม่ได้ช่วยอะไร จึงเก็บแค่ "ชุดคอลัมน์ที่ซ่อน" ไว้ต่อรายงาน
// ค่าจำไว้ใน localStorage ต่อเครื่อง (ความชอบส่วนตัว ไม่ใช่ข้อมูลที่ต้องแชร์) — อ่าน/เขียนพังได้เสมอ จึงห่อ try/catch

export type ReportColumnOption = {
  id: string;
  label: string;
  /** false = คอลัมน์หลักที่ซ่อนไม่ได้ (เช่นเลขบิล) */
  hideable?: boolean;
};

export type ReportColumnVisibility = {
  isVisible: (id: string) => boolean;
  setVisible: (id: string, visible: boolean) => void;
  reset: () => void;
  hiddenCount: number;
};

const CHANGE_EVENT = "report-column-visibility-change";

function storageKeyFor(reportId: string) {
  return `yummy-go:report-columns:${reportId}`;
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

// ค่าล่าสุดต่อ key ในหน่วยความจำ — ใช้ตอน localStorage เขียนไม่ได้ ให้การซ่อนคอลัมน์ยังทำงานในรอบนี้
const memoryHidden = new Map<string, string>();

function writeStorage(key: string, hidden: string[]) {
  const raw = hidden.length ? JSON.stringify(hidden) : "";
  memoryHidden.set(key, raw);
  try {
    if (raw) window.localStorage.setItem(key, raw);
    else window.localStorage.removeItem(key);
  } catch {
    // บันทึกไม่ได้ (private mode/storage ถูกบล็อก) — ค่าใน memoryHidden ยังใช้ได้จนปิดหน้า
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function parseHidden(raw: string) {
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
    if (event.key) memoryHidden.delete(event.key);
    callback();
  }

  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", handleStorage);
  };
}

export function useReportColumnVisibility(
  reportId: string,
  options: ReportColumnOption[],
): ReportColumnVisibility {
  const key = storageKeyFor(reportId);
  const raw = useSyncExternalStore(
    subscribe,
    () => memoryHidden.get(key) ?? readStorage(key),
    () => "",
  );
  // กรองเฉพาะคอลัมน์ที่ยังมีอยู่และซ่อนได้ — กันค่าค้างจากเวอร์ชันเก่าไปซ่อนคอลัมน์หลัก
  const hidden = useMemo(() => {
    const hideable = new Set(options.filter((option) => option.hideable !== false).map((option) => option.id));
    return new Set(parseHidden(raw).filter((id) => hideable.has(id)));
  }, [options, raw]);

  const setVisible = useCallback(
    (id: string, visible: boolean) => {
      const next = new Set(hidden);
      if (visible) next.delete(id);
      else next.add(id);
      writeStorage(key, [...next]);
    },
    [hidden, key],
  );

  const reset = useCallback(() => writeStorage(key, []), [key]);
  const isVisible = useCallback((id: string) => !hidden.has(id), [hidden]);

  return {
    hiddenCount: hidden.size,
    isVisible,
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled} aria-label={buttonLabel}>
          <Columns3 data-icon="inline-start" />
          <span className="hidden sm:inline">{buttonLabel}</span>
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{heading ?? t("report.toggleColumns")}</DropdownMenuLabel>
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
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!visibility.hiddenCount} onSelect={visibility.reset}>
          {t("report.resetColumns")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
