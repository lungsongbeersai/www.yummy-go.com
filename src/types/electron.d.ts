interface ElectronDisplayInfo {
  activeCustomerDisplayId: number | null;
  count: number;
  hasSecondary: boolean;
  primary: ElectronDisplay;
  displays: ElectronDisplay[];
}

interface ElectronDisplay {
  id: number;
  isActive: boolean;
  isPrimary: boolean;
  label: string;
  scaleFactor: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

interface ElectronOpenDisplayResult {
  displayId: number;
  ok: boolean;
}

interface ElectronCloseDisplayResult {
  ok: boolean;
}

interface ElectronAPI {
  openDisplay: (targetDisplayId?: number) => Promise<ElectronOpenDisplayResult>;
  closeDisplay: () => Promise<ElectronCloseDisplayResult>;
  sendToDisplay: (data: unknown) => void;
  signalReady: () => void;
  onDisplayMessage: (callback: (data: unknown) => void) => () => void;
  getDisplays: () => Promise<ElectronDisplayInfo>;
}

interface Window {
  electronAPI?: ElectronAPI;
}
