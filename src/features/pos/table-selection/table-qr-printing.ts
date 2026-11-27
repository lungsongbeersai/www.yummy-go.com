import { optionalString } from "./utils";
import type { PrintProgress } from "@/services/printer";
import { createMutationUuid } from "@/lib/pos/mutation-identity";
import {
  WINDOW_OPEN_FONT_CLASS_NAME,
  WINDOW_OPEN_FONT_STYLESHEET_LINK,
  WINDOW_OPEN_PRINT_ON_LOAD_SCRIPT,
} from "@/lib/window-open-fonts";

interface QrQueueResponse {
  pending_query?: { print_job_uuid?: string } | null;
  print_job?: { print_job_uuid?: string } | null;
}

export function createQrPrintRound<T extends QrQueueResponse>(
  createOperationUuid = createMutationUuid,
  isCurrent: () => boolean = () => true,
) {
  let active = false;
  let round: { operationUuid: string; response: T | null; terminal: boolean; copies: number } | null = null;

  return {
    isActive: () => active,
    begin(copies = 1) {
      if (active || !isCurrent()) return null;
      if (!round || round.terminal) {
        if (!Number.isSafeInteger(copies) || copies < 1 || copies > 20) {
          throw new RangeError("QR print copies must be between 1 and 20");
        }
        round = { operationUuid: createOperationUuid(), response: null, terminal: false, copies };
      }
      active = true;
      const current = round;
      let released = false;
      return {
        operationUuid: current.operationUuid,
        copies: current.copies,
        response: current.response,
        remember(response: T) {
          // No queue identity can also mean its response was lost. Keep the
          // operation UUID so Backend can recover the same physical print.
          if (tableQrPendingJobUuid(response)) current.response = response;
        },
        settle(outcome: ReturnType<typeof tableQrPrintOutcome>) {
          current.terminal = outcome !== "pending";
        },
        release() {
          if (released) return;
          released = true;
          active = false;
        },
      };
    },
  };
}

export function tableQrPrintOutcome(result: {
  failedCount: number;
  pending?: boolean;
  successCount: number;
  total?: number;
  errorMessage?: string;
}, expectedCopies = 1) {
  if (result.failedCount > 0 || result.errorMessage) return "error" as const;
  if (result.pending) return "pending" as const;
  const total = result.total ?? expectedCopies;
  if (total === expectedCopies && result.successCount === expectedCopies) return "success" as const;
  return "error" as const;
}

export function tableQrPrintProgress(result: {
  successCount?: number;
  failedCount?: number;
  total?: number;
}, expectedCopies = 1) {
  const count = (value: number | undefined) => typeof value === "number" &&
    Number.isSafeInteger(value) && value > 0 ? value : 0;
  const printed = count(result.successCount);
  return {
    printed,
    // Keep requested sheets visible before preparation returns a total. Never
    // infer delivery from a queue count, a phase, or elapsed time.
    total: Math.max(1, count(expectedCopies), count(result.total), printed + count(result.failedCount)),
  };
}

export function tableQrPrintProgressUpdate(previous: PrintProgress | null, progress: PrintProgress, observing: boolean) {
  if (!observing || !previous) return progress;
  if (progress.phase === "fetching") return previous;
  return {
    ...progress,
    total: Math.max(previous.total, progress.total),
    successCount: Math.max(previous.successCount, progress.successCount),
  };
}

export async function tableQrPrintAttemptResponse<T>({
  refreshQueue,
  requestQueue,
  response,
  isCurrent,
}: {
  refreshQueue: boolean;
  requestQueue: () => Promise<T>;
  response: T | null;
  isCurrent?: () => boolean;
}) {
  const assertCurrent = () => { if (isCurrent?.() === false) throw new DOMException("QR print cancelled", "AbortError"); };
  assertCurrent();
  const result = refreshQueue ? await requestQueue() : response;
  assertCurrent();
  return result;
}

// Both QR dialogs require a real job selected by Backend's configured QR role.
// Missing queue metadata is not permission to print through another transport.
export function tableQrPendingJobUuid(
  response: {
    pending_query?: { print_job_uuid?: string } | null;
    print_job?: { print_job_uuid?: string } | null;
  } | null,
) {
  return (
    optionalString(response?.pending_query?.print_job_uuid) ??
    optionalString(response?.print_job?.print_job_uuid) ??
    ""
  );
}

export function buildQrPrintDocument({
  autoPrint,
  imageUrl,
  layout,
  title,
}: {
  autoPrint: boolean;
  imageUrl: string;
  layout: "page" | "receipt";
  title: string;
}) {
  const safeTitle = escapeHtml(title);
  const safeImage = escapeHtml(imageUrl);
  const receipt = layout === "receipt";
  const layoutStyles = receipt
    ? `
      @page { size: 57mm 90mm; margin: 0; }
      html, body { width: 57mm; min-height: 90mm; margin: 0; }
      body { color: #111; text-align: center; }
      .paper { width: 57mm; min-height: 90mm; padding: 4mm 3mm; }
      .title { font-size: 14pt; font-weight: 800; line-height: 1.1; margin: 0 0 2mm; }
      img { width: 46mm; height: 46mm; object-fit: contain; margin: 0 auto 2mm; }
      @media print {
        html, body, .paper { width: 57mm; min-height: 90mm; }
      }`
    : `
      html, body { margin: 0; }
      body { color: #111; text-align: center; padding: 16mm; }
      .title { font-size: 18pt; font-weight: 800; margin: 0 0 8mm; }
      img { width: 70mm; height: 70mm; object-fit: contain; margin: 0 auto; }`;

  return `<!doctype html>
<html>
  <head>
    ${WINDOW_OPEN_FONT_STYLESHEET_LINK}
    <title>${safeTitle} QR</title>
    <style>
      * { box-sizing: border-box; }
      ${layoutStyles}
    </style>
  </head>
  <body class="${WINDOW_OPEN_FONT_CLASS_NAME}">
    <main class="paper">
      <p class="title">${safeTitle}</p>
      <img src="${safeImage}" alt="${safeTitle} QR" />
    </main>
    ${autoPrint ? `<script>${WINDOW_OPEN_PRINT_ON_LOAD_SCRIPT}</script>` : ""}
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
