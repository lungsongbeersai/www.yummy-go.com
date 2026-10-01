import { registerPlugin } from "@capacitor/core";
import type { CustomerDisplayPayload } from "@/features/customer-display/shared/customer-display-sync";

export interface SwanCustomerDisplayStatus {
  supported: boolean;
  connected?: boolean;
  active?: boolean;
  displayId?: number;
  width?: number;
  height?: number;
  label?: string;
  primaryWidth?: number;
  primaryHeight?: number;
}

interface SwanCustomerDisplayPlugin {
  getStatus(): Promise<SwanCustomerDisplayStatus>;
  open(options: { displayId: number; payload: CustomerDisplayPayload }): Promise<SwanCustomerDisplayStatus>;
  update(options: { payload: CustomerDisplayPayload }): Promise<void>;
  close(): Promise<SwanCustomerDisplayStatus>;
}

export const SwanCustomerDisplay = registerPlugin<SwanCustomerDisplayPlugin>("SwanCustomerDisplay");

export function swanStatusToDisplayInfo(status: SwanCustomerDisplayStatus): ElectronDisplayInfo {
  const primary: ElectronDisplay = {
    id: 0,
    isActive: false,
    isPrimary: true,
    label: "Main screen",
    scaleFactor: 1,
    width: status.primaryWidth ?? 0,
    height: status.primaryHeight ?? 0,
    x: 0,
    y: 0,
  };
  const secondary: ElectronDisplay | null = status.connected && status.displayId !== undefined
    ? {
        id: status.displayId,
        isActive: Boolean(status.active),
        isPrimary: false,
        label: status.label || "Customer display",
        scaleFactor: 1,
        width: status.width ?? 0,
        height: status.height ?? 0,
        x: 0,
        y: 0,
      }
    : null;

  return {
    activeCustomerDisplayId: secondary?.isActive ? secondary.id : null,
    count: secondary ? 2 : 1,
    hasSecondary: Boolean(secondary),
    primary,
    displays: secondary ? [primary, secondary] : [primary],
  };
}
