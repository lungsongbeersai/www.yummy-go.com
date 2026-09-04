import { optionalString } from "./utils";

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
