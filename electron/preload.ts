import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  openDisplay: (targetDisplayId?: number): Promise<boolean> =>
    ipcRenderer.invoke("pos:open-display", targetDisplayId),
  closeDisplay: (): Promise<boolean> => ipcRenderer.invoke("pos:close-display"),
  sendToDisplay: (data: unknown) => {
    ipcRenderer.send("pos:send-to-display", data);
  },
  signalReady: () => {
    ipcRenderer.send("display:ready");
  },
  onDisplayMessage: (callback: (data: unknown) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on("display:receive", handler);
    return () => ipcRenderer.removeListener("display:receive", handler);
  },
  getDisplays: () => ipcRenderer.invoke("pos:get-displays")
});
