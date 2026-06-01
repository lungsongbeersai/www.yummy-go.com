interface ElectronDisplayInfo {
  count: number;
  hasSecondary: boolean;
  primary: { id: number; width: number; height: number };
  displays: Array<{ id: number; isPrimary: boolean; width: number; height: number }>;
}

interface ElectronAPI {
  openDisplay: (targetDisplayId?: number) => Promise<boolean>;
  closeDisplay: () => Promise<boolean>;
  sendToDisplay: (data: unknown) => void;
  signalReady: () => void;
  onDisplayMessage: (callback: (data: unknown) => void) => () => void;
  getDisplays: () => Promise<ElectronDisplayInfo>;
}

interface Window {
  electronAPI?: ElectronAPI;
}
