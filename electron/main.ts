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
  createCustomerDisplayWindowController,
  resolveCustomerDisplayTarget,
} from "../src/platform/electron/customer-display-window";
import {
  assertNextServerPortAvailable,
  createNextServerEnvironment,
  createNextServerPaths,
  materializeNextServer,
  waitForNextServer,
  waitForNextServerStartup,
} from "../src/platform/electron/next-server-contract";

let mainWindow: BrowserWindow | null = null;
let nextProcess: UtilityProcess | null = null;

const isDev = process.env.NODE_ENV !== "production" && !app.isPackaged;
const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const customerDisplay = createCustomerDisplayWindowController((target) => {
  const window = new BrowserWindow({
    ...target.bounds,
    frame: false,
    autoHideMenuBar: true,
    show: false,
    title: "Yummy Go Customer Display",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  void window.loadURL(`${BASE_URL}/customer-display`);
  return window;
}, process.platform === "darwin");

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
    customerDisplay.close();
  });
}

function displayInfo(display: Display, primary: Display) {
  const active = customerDisplay.activeDisplayId === display.id;
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
    activeCustomerDisplayId: customerDisplay.activeDisplayId,
    cashierDisplayId: cashierDisplay().id,
    count: displays.length,
    hasSecondary: displays.length > 1,
    primary: displayInfo(primary, primary),
    displays: displays.map((display) => displayInfo(display, primary))
  };
}

function cashierDisplay() {
  return mainWindow && !mainWindow.isDestroyed()
    ? screen.getDisplayMatching(mainWindow.getBounds())
    : screen.getPrimaryDisplay();
}

function openCustomerDisplay(targetDisplayId?: number) {
  const target = resolveCustomerDisplayTarget(screen.getAllDisplays(), cashierDisplay().id, targetDisplayId);
  customerDisplay.open(target);

  return {
    displayId: target.id,
    ok: true
  };
}

function closeCustomerDisplay() {
  customerDisplay.close();
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
    customerDisplay.send(data);
  });
  ipcMain.on("display:ready", (event) => {
    customerDisplay.signalReady(event.sender.id);
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

async function startApplication() {
  setupIpc();
  try {
    await startNextServer();
    createMainWindow();

    screen.on("display-removed", () => {
      const activeCustomerDisplayId = customerDisplay.activeDisplayId;
      if (activeCustomerDisplayId === null) return;
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
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  void app.whenReady().then(startApplication);
}

app.on("window-all-closed", () => {
  nextProcess?.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  nextProcess?.kill();
});
