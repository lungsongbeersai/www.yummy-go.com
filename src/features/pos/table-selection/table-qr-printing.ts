import { optionalString } from "./utils";
import {
  WINDOW_OPEN_FONT_CLASS_NAME,
  WINDOW_OPEN_FONT_STYLESHEET_LINK,
  WINDOW_OPEN_PRINT_ON_LOAD_SCRIPT,
} from "@/lib/window-open-fonts";

type DeviceIdentity = {
  agent_id: string;
  device_code?: string | null;
};

export type TableQrPrinterContext = {
  agent_id?: string;
  device_code?: string;
  print_mode?: string;
};

export async function resolveTableQrPrinterContext({
  loginUuid,
  resolveDeviceContext,
  resolveDeviceIdentity,
}: {
  loginUuid: string;
  resolveDeviceContext: (input: {
    login_uuid_fk: string;
    agent_id?: string;
    device_code?: string;
  }) => Promise<TableQrPrinterContext>;
  resolveDeviceIdentity: () => Promise<DeviceIdentity>;
}): Promise<TableQrPrinterContext | null> {
  const identity = await resolveDeviceIdentity().catch(() => null);
  const deviceCode = String(identity?.device_code ?? "").trim();
  if (!identity || !deviceCode) return null;

  return resolveDeviceContext({
    login_uuid_fk: loginUuid,
    device_code: deviceCode,
    agent_id: identity.agent_id,
  }).catch(() => ({
    device_code: deviceCode,
    agent_id: identity.agent_id,
  }));
}

export function tableQrPrintOutcome(result: {
  failedCount: number;
  pending?: boolean;
  successCount: number;
}) {
  if (result.pending) return "pending" as const;
  if (result.successCount > 0 && result.failedCount === 0) return "success" as const;
  return "fallback" as const;
}

// Both QR dialogs read the queued job the same way: a print_job_uuid means Backend
// put a real job on the printer queue, so the browser print window is the fallback
// rather than the first choice.
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
