export const CONFIRM_ORDER_PROGRESS_TOTAL = 100;

export type ConfirmOrderProgressPhase =
  | "preparing"
  | "confirming"
  | "fetching"
  | "printing"
  | "group-complete"
  | "refreshing"
  | "done";

interface ConfirmOrderProgressStepInput {
  groupCount?: number;
  groupIndex?: number;
  phase: ConfirmOrderProgressPhase;
  printingCompleted?: number;
  printingTotal?: number;
}

interface ConfirmAllProgressPercentInput {
  completed: number;
  printSuccessCount?: number;
  printTotal?: number;
  total: number;
}

const PREPARING_STEP = 4;
const GROUPS_COMPLETE_STEP = 92;
const REFRESHING_STEP = 96;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function confirmAllProgressPercent({
  completed,
  printSuccessCount,
  printTotal,
  total,
}: ConfirmAllProgressPercentInput) {
  const safePrintTotal = Math.max(0, Math.floor(printTotal ?? 0));
  if (safePrintTotal > 0) {
    const safePrintSuccess = clamp(
      Math.floor(printSuccessCount ?? 0),
      0,
      safePrintTotal,
    );
    return Math.round((safePrintSuccess / safePrintTotal) * 100);
  }

  const safeTotal = Math.max(1, total);
  return Math.round((clamp(completed, 0, safeTotal) / safeTotal) * 100);
}

/**
 * แบ่ง progress การยืนยันออเดอร์เป็น 100 ขั้นสำหรับ UI เท่านั้น
 * ค่าจะอิง phase และงานพิมพ์จริง แต่ไม่แตะลำดับหรือเวลาของ business workflow
 */
export function confirmOrderProgressStep({
  groupCount = 1,
  groupIndex = 0,
  phase,
  printingCompleted = 0,
  printingTotal = 0,
}: ConfirmOrderProgressStepInput) {
  if (phase === "preparing") return PREPARING_STEP;
  if (phase === "refreshing") return REFRESHING_STEP;
  if (phase === "done") return CONFIRM_ORDER_PROGRESS_TOTAL;

  const safeGroupCount = Math.max(1, Math.floor(groupCount));
  const safeGroupIndex = clamp(
    Math.floor(groupIndex),
    0,
    safeGroupCount - 1,
  );
  const groupProgressTotal = GROUPS_COMPLETE_STEP - PREPARING_STEP;
  const groupStart =
    PREPARING_STEP +
    (groupProgressTotal * safeGroupIndex) / safeGroupCount;
  const groupEnd =
    PREPARING_STEP +
    (groupProgressTotal * (safeGroupIndex + 1)) / safeGroupCount;
  const groupSize = groupEnd - groupStart;

  if (phase === "confirming") {
    return Math.round(groupStart + groupSize * 0.3);
  }
  if (phase === "fetching") {
    return Math.round(groupStart + groupSize * 0.5);
  }
  if (phase === "group-complete") {
    return Math.round(groupEnd);
  }

  const printRatio =
    printingTotal > 0
      ? clamp(printingCompleted / printingTotal, 0, 1)
      : 0;
  return Math.round(groupStart + groupSize * (0.55 + printRatio * 0.45));
}
