import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  screen,
  utilityProcess,
  type Display,
  type UtilityProcess,
} from "electron";
import path from "path";
import {
  assertNextServerPortAvailable,
  createNextServerEnvironment,
  createNextServerPaths,
  materializeNextServer,
  waitForNextServer,
  waitForNextServerStartup,
} from "../src/platform/electron/next-server-contract";

let mainWindow: BrowserWindow | null = null;
let customerWindow: BrowserWindow | null = null;
let nextProcess: UtilityProcess | null = null;
let customerReady = false;
let activeCustomerDisplayId: number | null = null;
const pendingMessages: unknown[] = [];

const isDev = process.env.NODE_ENV !== "production" && !app.isPackaged;
const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = `http://127.0.0.1:${PORT}`;

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

function displayInfo(display: Display, primary: Display) {
  const active = activeCustomerDisplayId === display.id;
  return {
    id: display.id,
    isActive: active,
    isPrimary: display.id === primary.id,
    label: `${display.bounds.width} x ${display.bounds.height}`,
    scaleFactor: display.scaleFactor,
    width: display.bounds.width,
    height: display.bounds.height,
    x: display.bounds.x,
    y: display.bounds.y
  };
}

function displaySnapshot() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();

  return {
    activeCustomerDisplayId,
    count: displays.length,
    hasSecondary: displays.length > 1,
    primary: displayInfo(primary, primary),
    displays: displays.map((display) => displayInfo(display, primary))
  };
}

function openCustomerDisplay(targetDisplayId?: number) {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const target = typeof targetDisplayId === "number"
    ? displays.find((display) => display.id === targetDisplayId) ?? primary
    : displays.find((display) => display.id !== primary.id) ?? primary;

  if (customerWindow && !customerWindow.isDestroyed()) {
    customerWindow.close();
    customerWindow = null;
  }

  customerReady = false;
  pendingMessages.length = 0;

  activeCustomerDisplayId = target.id;

  const nextWindow = new BrowserWindow({
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
  customerWindow = nextWindow;

  void nextWindow.loadURL(`${BASE_URL}/customer-display`);
  nextWindow.once("ready-to-show", () => {
    if (customerWindow !== nextWindow || nextWindow.isDestroyed()) return;
    nextWindow.show();
    nextWindow.setFullScreen(true);
  });
  nextWindow.on("closed", () => {
    if (customerWindow !== nextWindow) return;
    customerWindow = null;
    customerReady = false;
    activeCustomerDisplayId = null;
    pendingMessages.length = 0;
  });

  return {
    displayId: target.id,
    ok: true
  };
}

function closeCustomerDisplay() {
  customerWindow?.close();
  customerWindow = null;
  activeCustomerDisplayId = null;
  customerReady = false;
  pendingMessages.length = 0;
}

function setupIpc() {
  ipcMain.handle("pos:open-display", (_event, targetDisplayId?: number) => {
    return openCustomerDisplay(targetDisplayId);
  });
  ipcMain.handle("pos:close-display", () => {
    closeCustomerDisplay();
    return { ok: true };
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
    return displaySnapshot();
  });
}

async function startNextServer() {
  if (isDev) return;

  const appVersion = app.getVersion();
  const paths = createNextServerPaths({
    appVersion,
    resourcesPath: process.resourcesPath,
    userDataPath: app.getPath("userData"),
  });
  await materializeNextServer(paths, appVersion);
  await assertNextServerPortAvailable(PORT);

  const child = utilityProcess.fork(paths.runtimeEntry, [], {
    cwd: paths.runtimeDirectory,
    env: createNextServerEnvironment(PORT),
    stdio: "pipe",
    serviceName: "Yummy Go Next Server",
  });
  nextProcess = child;

  child.stdout?.on("data", (data: Buffer) => {
    process.stdout.write(data);
  });
  child.stderr?.on("data", (data: Buffer) => {
    process.stderr.write(data);
  });

  try {
    await waitForNextServerStartup({
      subscribeError: (listener) => {
        child.once("error", listener);
        return () => child.removeListener("error", listener);
      },
      subscribeExit: (listener) => {
        child.once("exit", listener);
        return () => child.removeListener("exit", listener);
      },
      waitForReadiness: () => waitForNextServer(BASE_URL),
    });
  } catch (error) {
    child.kill();
    if (nextProcess === child) nextProcess = null;
    throw error;
  }
}

app.whenReady().then(async () => {
  setupIpc();
  try {
    await startNextServer();
    createMainWindow();

    screen.on("display-removed", () => {
      if (!activeCustomerDisplayId) return;
      const activeStillConnected = screen
        .getAllDisplays()
        .some((display) => display.id === activeCustomerDisplayId);
      if (!activeStillConnected) closeCustomerDisplay();
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox("Yummy Go could not start", message);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  nextProcess?.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  nextProcess?.kill();
});
