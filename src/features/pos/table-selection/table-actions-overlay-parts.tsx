"use client";

import type { ReactNode } from "react";
import { ArrowRight, Check, Plus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { TableActionMode, TableActionTable } from "./types";

// ภาพ "ต้นทาง → ปลายทาง" ของการย้าย/รวมโต๊ะ — ย้าย: โต๊ะนี้ → โต๊ะที่เลือก, รวม: โต๊ะที่เลือก → โต๊ะนี้
// ช่องที่ยังไม่ได้เลือกเป็นกรอบประ ให้เห็นทันทีว่ายังขาดอะไรก่อนกดปุ่มยืนยัน
export function TableActionFlow({
  joinSources,
  mode,
  moveTarget,
  sourceTableName
}: {
  joinSources: TableActionTable[];
  mode: TableActionMode;
  moveTarget: TableActionTable | null;
  sourceTableName: string;
}) {
  const current = <FlowChip tone="current">{sourceTableName}</FlowChip>;
  const selected =
    mode === "move" ? (
      moveTarget ? <FlowChip tone="selected">{moveTarget.name}</FlowChip> : <FlowChip tone="empty" />
    ) : joinSources.length ? (
      <FlowChip tone="selected">
        {joinSources.slice(0, 3).map((source) => source.name).join(", ")}
        {joinSources.length > 3 ? ` +${joinSources.length - 3}` : ""}
      </FlowChip>
    ) : (
      <FlowChip tone="empty" />
    );

  return (
    <div className="flex min-w-0 items-center gap-2">
      {mode === "move" ? current : selected}
      <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      {mode === "move" ? selected : current}
    </div>
  );
}

function FlowChip({ children, tone }: { children?: ReactNode; tone: "current" | "selected" | "empty" }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 min-w-12 max-w-48 items-center justify-center rounded-lg border px-3 text-sm font-semibold tabular-nums",
        tone === "current" && "border-border bg-muted text-foreground",
        tone === "selected" && "border-primary bg-primary/10 text-primary-text",
        tone === "empty" && "border-dashed border-border text-muted-foreground"
      )}
    >
      <span className="truncate">{tone === "empty" ? "?" : children}</span>
    </span>
  );
}

// ไทล์โต๊ะขนาดกะทัดรัดแบบหน้าเลือกโต๊ะ — ไม่มีป้าย "ว่าง/ไม่ว่าง" ต่อการ์ดแล้ว เพราะแต่ละโหมดกรอง
// เหลือสถานะเดียวอยู่แล้ว (ย้าย = ว่างทั้งหมด, รวม = ไม่ว่างทั้งหมด) ป้ายซ้ำทุกใบเป็นแค่ noise
export function TableActionOptionCard({
  mode,
  onClick,
  selected,
  table
}: {
  mode: TableActionMode;
  onClick: () => void;
  selected: boolean;
  table: TableActionTable;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={selected}
      className={cn(
        "relative h-auto min-h-16 min-w-0 touch-manipulation flex-col items-start justify-center gap-1 whitespace-normal rounded-lg bg-card p-3 text-left hover:bg-accent/50",
        selected && "border-primary bg-primary/5 ring-1 ring-primary hover:bg-primary/5"
      )}
      onClick={onClick}
    >
      <span title={table.name} className="block w-full truncate pr-6 text-lg font-bold leading-6 text-foreground">
        {table.name}
      </span>
      {/* API ย้าย/รวมโต๊ะไม่ส่งจำนวนที่นั่งมาทุกร้าน — ไม่มีก็ไม่โชว์ แทนที่จะขึ้น "-" ทุกใบ */}
      {table.seats !== null ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <UsersRound aria-hidden="true" className="size-3.5" />
          <span className="tabular-nums">{table.seats}</span>
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className={cn(
          "absolute right-2 top-2 grid size-5 place-items-center rounded-full [&_svg]:size-3",
          selected ? "bg-primary text-primary-foreground" : "text-muted-foreground"
        )}
      >
        {selected ? <Check /> : mode === "join" ? <Plus /> : null}
      </span>
    </Button>
  );
}

export function TableActionsLoading() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 12 }).map((_, index) => (
        <Skeleton key={index} className="h-16 rounded-lg" />
      ))}
    </div>
  );
}
