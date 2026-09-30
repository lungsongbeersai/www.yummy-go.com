"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Pin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TableHead } from "@/components/ui/table";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useToastStore } from "@/stores/toast-store";
import type { ReportColumnPinning } from "@/features/report/shared/report-sticky-table";

// ปุ่มหมุดล็อกคอลัมน์ (หัวตาราง) และล็อกแถว (ช่องลำดับ) — useStickyTable อ่านผลจาก DOM เอง
// หัวตารางรายงานมีหลายแบบ (ปุ่มเรียง, หัวธรรมดา, หัวที่มีปุ่มพับกลุ่ม) จึงส่งสถานะผ่าน context ที่ครอบ
// <TableHeader> แทนการส่ง prop ทีละหัวคอลัมน์ — หัวคอลัมน์ใหม่ที่ติด columnId จะได้ปุ่มหมุดเอง
//
// เป็นปุ่มไอคอนหมุด (aria-pressed) ไม่ใช่ checkbox — หัวตาราง/ช่องลำดับมี checkbox เลือกแถวอยู่แล้ว
// ถ้าหน้าตาเหมือนกันผู้ใช้แยกไม่ออกว่าอันไหนเลือกไปส่งออก อันไหนล็อก
// ซ่อนไว้จนชี้/โฟกัส (จองที่ไว้ ไม่ขยับ) — คอลัมน์หลักกับแถวแรกล็อกไว้ให้เห็นเป็นค่าเริ่มต้นแล้ว จึงไม่ต้อง
// โชว์หมุดทุกช่องให้รก ส่วนจอสัมผัสที่ชี้ไม่ได้แสดงจางๆ ไว้ตลอด

const PIN_TOGGLE_CLASS =
  "size-6 min-w-6 shrink-0 p-0 text-muted-foreground aria-pressed:bg-primary/10 aria-pressed:text-primary";
const PIN_REVEAL_CLASS =
  "opacity-0 transition-opacity focus-visible:opacity-100 pointer-coarse:opacity-60 motion-reduce:transition-none";

const ReportColumnPinningContext = createContext<ReportColumnPinning | null>(null);

export function ReportColumnPinningProvider({
  children,
  pinning,
}: {
  children: ReactNode;
  pinning: ReportColumnPinning;
}) {
  return <ReportColumnPinningContext value={pinning}>{children}</ReportColumnPinningContext>;
}

export function ReportColumnPinToggle({ columnId, label }: { columnId: string; label: string }) {
  const { t } = useTranslation();
  const controls = useContext(ReportColumnPinningContext)?.controls;
  if (!controls?.canPin(columnId)) return null;

  const pinned = controls.isPinned(columnId);
  const unfit = pinned && controls.isUnfit(columnId);
  const hint = unfit
    ? t("report.pinColumnsTooNarrow")
    : pinned
      ? t("report.unpinColumn")
      : t("report.pinColumn");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          aria-label={`${t("report.pinColumn")}: ${label}`}
          className={cn(
            PIN_TOGGLE_CLASS,
            !pinned && cn(PIN_REVEAL_CLASS, "group-hover/col:opacity-100"),
            unfit && "opacity-50",
          )}
          pressed={pinned}
          size="sm"
          onPressedChange={(pressed) => controls.setPinned(columnId, pressed)}
        >
          <Pin aria-hidden="true" />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

// ---- ล็อกแถว ----
// แยกจาก checkbox เลือกแถว (ที่กรองสรุป/ส่งออก) — ล็อกแถวไม่มีผลกับข้อมูลเลย
// ค่าเริ่มต้น: แถวแรกของข้อมูลชุดนี้ล็อกไว้ให้ผู้ใช้เห็นว่าล็อกแถวได้ พอผู้ใช้ปลดแถวเริ่มต้นเองครั้งหนึ่ง
// (รู้จักฟีเจอร์แล้ว) จำไว้ในเครื่องและเลิกล็อกให้อัตโนมัติทุกรายงาน
// เป็นสถานะชั่วคราวต่อข้อมูลชุดนั้น (id แถวเปลี่ยนตามหน้า/ตัวกรอง) ไม่บันทึก

const ROW_PIN_DEFAULT_DISMISSED_KEY = "yummy-go:report-row-pin-default-dismissed";

function readRowPinDefaultDismissed() {
  try {
    return window.localStorage.getItem(ROW_PIN_DEFAULT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeRowPinDefaultDismissed() {
  try {
    window.localStorage.setItem(ROW_PIN_DEFAULT_DISMISSED_KEY, "1");
  } catch {
    // บันทึกไม่ได้ — แค่ล็อกแถวแรกให้อีกครั้งในรอบหน้า
  }
}

type RowPinning = {
  isPinned: (rowId: string, isDefault: boolean) => boolean;
  registerDefault: (rowId: string) => void;
  setPinned: (rowId: string, isDefault: boolean, pinned: boolean) => void;
};

const ReportRowPinningContext = createContext<RowPinning | null>(null);

type RowPinState = { defaultId: string | null; ids: ReadonlySet<string>; touched: boolean };

export function ReportRowPinningProvider({ children }: { children: ReactNode }) {
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && readRowPinDefaultDismissed(),
  );
  // touched = ผู้ใช้กดหมุดแล้วในข้อมูลชุดนี้ — จากนั้นใช้ ids ล้วน ไม่มีค่าเริ่มต้นอีก
  const [state, setState] = useState<RowPinState>(() => ({ defaultId: null, ids: new Set(), touched: false }));

  const registerDefault = useCallback((rowId: string) => {
    // แถวแรกเปลี่ยน = ข้อมูลชุดใหม่ (หน้าใหม่/ค้นหาใหม่/เรียงใหม่) — กลับไปใช้ค่าเริ่มต้น
    setState((current) =>
      current.defaultId === rowId ? current : { defaultId: rowId, ids: new Set(), touched: false },
    );
  }, []);

  const value = useMemo<RowPinning>(
    () => ({
      isPinned: (rowId, isDefault) => state.ids.has(rowId) || (!state.touched && isDefault && !dismissed),
      registerDefault,
      setPinned: (rowId, isDefault, pinned) => {
        if (isDefault && !pinned && !dismissed) {
          setDismissed(true);
          writeRowPinDefaultDismissed();
        }
        setState((current) => {
          const ids = new Set(current.ids);
          // กดครั้งแรก: แถวเริ่มต้นที่ล็อกอยู่ (ด้วยค่าเริ่มต้น) กลายเป็นล็อกจริง ไม่หายไปเพราะไปกดแถวอื่น
          if (!current.touched && current.defaultId && !dismissed) ids.add(current.defaultId);
          if (pinned) ids.add(rowId);
          else ids.delete(rowId);
          return { ...current, ids, touched: true };
        });
      },
    }),
    [dismissed, registerDefault, state],
  );

  return <ReportRowPinningContext value={value}>{children}</ReportRowPinningContext>;
}

/** ปุ่มหมุดล็อกแถว — วางในช่องลำดับข้าง checkbox เลือกแถว; isDefault = แถวแรกของข้อมูลที่แสดง */
export function ReportRowPinToggle({
  isDefault = false,
  label,
  rowId,
}: {
  isDefault?: boolean;
  label: string;
  rowId: string;
}) {
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.show);
  const pinning = useContext(ReportRowPinningContext);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const registerDefault = pinning?.registerDefault;

  useEffect(() => {
    if (isDefault) registerDefault?.(rowId);
  }, [isDefault, registerDefault, rowId]);

  if (!pinning) return null;
  const pinned = pinning.isPinned(rowId, isDefault);
  const hint = pinned ? t("report.unpinRow") : t("report.pinRow");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle
          ref={buttonRef}
          aria-label={`${hint}: ${label}`}
          className={cn(
            PIN_TOGGLE_CLASS,
            "data-row-pin-unfit:opacity-50",
            !pinned && cn(PIN_REVEAL_CLASS, "[tr:hover_&]:opacity-100"),
          )}
          data-row-pin=""
          pressed={pinned}
          size="sm"
          onPressedChange={(pressed) => {
            pinning.setPinned(rowId, isDefault, pressed);
            if (!pressed) return;
            // useStickyTable วัดใหม่หลัง aria-pressed เปลี่ยน (MutationObserver) — รอสองเฟรมแล้วดูว่าล็อกได้จริงไหม
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                if (buttonRef.current?.hasAttribute("data-row-pin-unfit")) {
                  // id คงที่ = กดเกินหลายครั้งติดกันแทนที่ toast เดิม ไม่ซ้อนเป็นกอง
                  showToast({ id: "report-row-pin-full", title: t("report.pinRowsFull"), tone: "info" });
                }
              }),
            );
          }}
        >
          <Pin aria-hidden="true" />
        </Toggle>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

/** ปุ่มหมุด + ชื่อคอลัมน์ติดกันเป็นก้อนเดียว — คอลัมน์ชิดขวา (ตัวเลข) ทั้งก้อนชิดขวา ไม่ให้หมุดไปค้างขอบซ้าย
    ห่างจากชื่อจนดูเหมือนเป็นของคอลัมน์ข้างๆ (ก้อนด้านในหดพอดีเนื้อหา ml-auto ของปุ่มเรียงจึงไม่ถ่างออก) */
export function ReportColumnHeadContent({ align, children }: { align?: "left" | "right"; children: ReactNode }) {
  return (
    <div className={cn("flex min-w-0", align === "right" && "justify-end")}>
      <div className="flex min-w-0 items-center gap-1">{children}</div>
    </div>
  );
}

/** หัวคอลัมน์ที่ล็อกได้: ติด data-col ให้ useStickyTable + ปุ่มหมุดไว้หน้าชื่อคอลัมน์ */
export function ReportColumnHead({
  align,
  children,
  className,
  columnId,
  label,
  ...props
}: Omit<ComponentProps<typeof TableHead>, "children"> & {
  align?: "left" | "right";
  children: ReactNode;
  columnId: string;
  /** ชื่อคอลัมน์สำหรับ aria-label ของปุ่มหมุด — ไม่ระบุ = ใช้ children ถ้าเป็นข้อความ */
  label?: string;
}) {
  const pinLabel = label ?? (typeof children === "string" ? children : columnId);

  return (
    <TableHead {...props} className={cn("group/col", className)} data-col={columnId}>
      <ReportColumnHeadContent align={align}>
        <ReportColumnPinToggle columnId={columnId} label={pinLabel} />
        <span className="min-w-0 truncate">{children}</span>
      </ReportColumnHeadContent>
    </TableHead>
  );
}
