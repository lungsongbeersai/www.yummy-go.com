import { app, BrowserWindow, ipcMain, screen } from "electron";
import { spawn, type ChildProcess } from "child_process";
import path from "path";

let mainWindow: BrowserWindow | null = null;
let customerWindow: BrowserWindow | null = null;
let nextProcess: ChildProcess | null = null;
let customerReady = false;
const pendingMessages: unknown[] = [];

const isDev = process.env.NODE_ENV !== "production" && !app.isPackaged;
const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;

function preloadPath() {
  return path.join(__dirname, "preload.js");
}

function createMainWindow() {
  const display = screen.getPrimaryDisplay();
  mainWindow = new BrowserWindow({
    width: display.workAreaSize.width,
    height: display.workAreaSize.height,
    x: display.bounds.x,
    y: display.bounds.y,
    title: "Yummy Go POS",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  void mainWindow.loadURL(BASE_URL);
  mainWindow.maximize();
  if (isDev) mainWindow.webContents.openDevTools({ mode: "detach" });
  mainWindow.on("closed", () => {
    mainWindow = null;
    customerWindow?.close();
  });
}

function openCustomerDisplay(targetDisplayId?: number) {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const target = targetDisplayId
    ? displays.find((display) => display.id === targetDisplayId) ?? primary
    : displays.find((display) => display.id !== primary.id) ?? primary;

  if (customerWindow && !customerWindow.isDestroyed()) {
    customerWindow.close();
    customerWindow = null;
  }

  customerReady = false;
  pendingMessages.length = 0;

  customerWindow = new BrowserWindow({
    width: target.bounds.width,
    height: target.bounds.height,
    x: target.bounds.x,
    y: target.bounds.y,
    frame: false,
    autoHideMenuBar: true,
    show: false,
    title: "Yummy Go Customer Display",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  void customerWindow.loadURL(`${BASE_URL}/customer-display`);
  customerWindow.once("ready-to-show", () => {
    customerWindow?.show();
    customerWindow?.setFullScreen(true);
  });
  customerWindow.on("closed", () => {
    customerWindow = null;
    customerReady = false;
    pendingMessages.length = 0;
  });
}

function closeCustomerDisplay() {
  customerWindow?.close();
  customerWindow = null;
}

function setupIpc() {
  ipcMain.handle("pos:open-display", (_event, targetDisplayId?: number) => {
    openCustomerDisplay(targetDisplayId);
    return true;
  });
  ipcMain.handle("pos:close-display", () => {
    closeCustomerDisplay();
    return true;
  });
  ipcMain.on("pos:send-to-display", (_event, data: unknown) => {
    if (!customerWindow || customerWindow.isDestroyed()) return;
    if (customerReady) customerWindow.webContents.send("display:receive", data);
    else pendingMessages.push(data);
  });
  ipcMain.on("display:ready", () => {
    customerReady = true;
    if (customerWindow && !customerWindow.isDestroyed()) {
      pendingMessages.forEach((message) => customerWindow?.webContents.send("display:receive", message));
    }
    pendingMessages.length = 0;
  });
  ipcMain.handle("pos:get-displays", () => {
    const displays = screen.getAllDisplays();
    const primary = screen.getPrimaryDisplay();
    return {
      count: displays.length,
      hasSecondary: displays.length > 1,
      primary: { id: primary.id, width: primary.bounds.width, height: primary.bounds.height },
      displays: displays.map((display) => ({
        id: display.id,
        isPrimary: display.id === primary.id,
        width: display.bounds.width,
        height: display.bounds.height
      }))
    };
  });
}

function startNextServer() {
  return new Promise<void>((resolve, reject) => {
    if (isDev) {
      resolve();
      return;
    }

    const nextBin = path.join(__dirname, "..", "node_modules", ".bin", "next");
    nextProcess = spawn(nextBin, ["start", "-p", String(PORT)], {
      cwd: path.join(__dirname, ".."),
      shell: true,
      stdio: "pipe"
    });

    nextProcess.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      if (text.includes("Ready") || text.includes("started")) resolve();
    });
    nextProcess.stderr?.on("data", (data: Buffer) => console.error(data.toString()));
    nextProcess.on("error", reject);
    setTimeout(resolve, 5000);
  });
}

app.whenReady().then(async () => {
  setupIpc();
  await startNextServer();
  createMainWindow();

  if (screen.getAllDisplays().length > 1) openCustomerDisplay();
  screen.on("display-added", () => {
    if (screen.getAllDisplays().length > 1) openCustomerDisplay();
  });
  screen.on("display-removed", () => {
    if (screen.getAllDisplays().length <= 1) closeCustomerDisplay();
  });
});

app.on("window-all-closed", () => {
  nextProcess?.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  nextProcess?.kill();
});
