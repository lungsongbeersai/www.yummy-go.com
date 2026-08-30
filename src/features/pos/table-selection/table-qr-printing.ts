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
