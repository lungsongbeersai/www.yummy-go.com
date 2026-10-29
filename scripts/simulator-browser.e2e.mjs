import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, readdir, writeFile, copyFile, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

// This executable test uses the real isolated router/repository/domain against
// disposable PostgreSQL in memory. It never imports production configuration.
const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(frontend, "../back-end");
const requireBackend = createRequire(join(backend, "package.json"));
const express = requireBackend("express");
const { PGlite } = requireBackend("@electric-sql/pglite");
const { createSimulatorRouter } = requireBackend("./api/v1/simulator/router.js");
const { bootstrap: fixtureBootstrap, ids } = requireBackend("./api/v1/simulator/fixtures.js");
const { liveFixtureSql, liveIds } = requireBackend("./api/v1/simulator/live-fixtures.js");
assert(!Object.keys(requireBackend.cache).some((name) => name === join(backend, "config/db.js")), "Production database configuration must never be imported by browser tests");

const frontendPort = Number(process.env.SIMULATOR_E2E_FRONTEND_PORT || 3109);
const backendPort = Number(process.env.SIMULATOR_E2E_BACKEND_PORT || 3108);
const frontendOrigin = `http://127.0.0.1:${frontendPort}`;
const backendOrigin = `http://127.0.0.1:${backendPort}`;
const artifactDirectory = process.env.SIMULATOR_E2E_ARTIFACTS || join(tmpdir(), "yummygo-simulator-online-e2e");
const chromePath = process.env.SIMULATOR_CHROME_PATH || (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : chromium.executablePath());
const fakeToken = "simulator-browser-fixture-token";
const liveOnly = process.env.SIMULATOR_E2E_LIVE_ONLY === "1";
const liveSteps = new Set([
  "Start disposable PostgreSQL backend and isolated local frontend",
  "Read actual orders in the default live view on a touch viewport",
  "Mirror newly submitted customer orders automatically without commands",
  "Mark stale live data offline and recover the actual paid/table state",
  "Pause live polling and WebGL while another window is active",
  "Switch modes and pause training before returning to actual restaurant data",
  "Verify isolation and browser error safety",
]);
const actor = {
  uuid: ids.login, email: "fixture@example.test", name: "Employee", status: 1, profile: "",
  branch_uuid: ids.branch, branch_name: "Training", branch_tel: "", branch_address: "",
  store_uuid: ids.store, store_uuid_fk: ids.store, store_name: "Fixture", store_logo: "",
  store_status: 2, store_table_status: 1, lak_rounding_version: 1,
};

let pg;
let server;
let router;
let nextProcess;
let browser;
let project;
let page;
let dropNextAction = null;
let interruptedAction = null;
let serial = Promise.resolve();
const queryLog = [];
const requests = [];
const uiRequests = [];
const pageErrors = [];
const blockedExternal = [];
const browserLog = [];
const pendingResources = new Set();
const steps = [];
let nextOutput = "";
const database = {
  async query(sql, values) { queryLog.push(sql); return pg.query(sql, values); },
  async connect() {
    let release;
    const previous = serial;
    serial = new Promise((done) => { release = done; });
    await previous;
    return { query: database.query, release };
  },
};
function bootstrap() {
  const value = fixtureBootstrap();
  value.branch.deposit_expire_days = 7;
  value.catalog.forEach((product) => { product.customer_visible = true; });
  return value;
}
const fixtureScope = async (_database, request, branch) => {
  if (request.uuid !== ids.login || branch !== ids.branch) throw Object.assign(new Error("Branch access denied"), { statusCode: 403 });
  return { ...bootstrap(), zone_uuids: [], english: ["en", "eng"].includes(request.query?.lang) };
};
const loadBootstrap = async (db, request, branch) => { await fixtureScope(db, request, branch); return bootstrap(); };
const auth = (request, response, next) => {
  if (request.headers["x-access-token"] !== fakeToken || request.headers.authorization !== `Bearer ${fakeToken}`) {
    return response.status(401).json({ status: "error", message: "Fixture authentication required" });
  }
  Object.assign(request, { uuid: ids.login, branch_uuid: ids.branch, store_uuid_fk: ids.store, login_status: 1 });
  next();
};

async function step(name, action) {
  if (liveOnly && !liveSteps.has(name)) return;
  const start = Date.now();
  console.log(`RUN ${name}`);
  await action();
  const result = { name, duration_ms: Date.now() - start, passed: true };
  steps.push(result);
  console.log(`PASS ${name} (${result.duration_ms} ms)`);
}

async function unique(locator) {
  await locator.waitFor({ state: "visible", timeout: 45_000 });
  assert.equal(await locator.count(), 1, "Every interaction must target exactly one visible control");
  return locator;
}
async function click(locator) { await (await unique(locator)).click(); }
async function fill(locator, value) { await (await unique(locator)).fill(value); }
async function actionClick(type, locator, target = page) {
  const response = target.waitForResponse((entry) => entry.request().method() === "POST" &&
    entry.url().startsWith(`${backendOrigin}/api/v1/simulator/sessions/`) && entry.url().endsWith("/actions") &&
    entry.request().postDataJSON()?.type === type, { timeout: 45_000 });
  // If a click fails, cleanup closes the browser before this listener resolves.
  // Register a handler now so its eventual cancellation cannot abort cleanup.
  void response.catch(() => {});
  await click(locator);
  const result = await response;
  const envelope = await result.json();
  assert.equal(result.status(), 200, envelope.message);
  assert.equal(envelope.status, "success", envelope.message);
  return envelope.data;
}
async function state() {
  const result = await pg.query("SELECT state FROM simulator_sessions ORDER BY created_at DESC LIMIT 1");
  return result.rows[0]?.state;
}
async function waitUntil(check, label, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(80);
  }
  throw new Error(`Timed out: ${label}`);
}
async function startFixtureServer() {
  pg = new PGlite();
  await pg.exec(await readFile(join(backend, "migrations/20261027_simulator_online.sql"), "utf8"));
  await pg.exec(liveFixtureSql(ids));
  await pg.exec("CREATE TABLE production_sentinel (id integer PRIMARY KEY, value text); INSERT INTO production_sentinel VALUES (1,'untouched production order/payment/print/stock sentinel');");
  const app = express();
  app.use((request, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", frontendOrigin);
    response.setHeader("Access-Control-Allow-Headers", "authorization,content-type,x-access-token");
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    if (request.method === "OPTIONS") return response.sendStatus(204);
    next();
  });
  app.use(express.json());
  app.use((request, response, next) => {
    requests.push({ method: request.method, path: request.path, action: request.body?.type });
    if (request.path.endsWith("/actions") && request.body?.type === dropNextAction) {
      dropNextAction = null;
      interruptedAction = structuredClone(request.body);
      const json = response.json.bind(response);
      response.json = (body) => {
        // A gateway can lose the upstream success after a commit. Return 502
        // rather than closing a socket, which Chrome may transparently retry.
        if (body.status === "success") {
          response.status(502);
          return json({ status: "error", message: "Fixture gateway lost the committed response" });
        }
        return json(body);
      };
    }
    next();
  });
  app.post("/api/v1/access-data", auth, (_request, response) => response.json({
    uuid: ids.login, login_email: actor.email, login_name: actor.name,
    branch_uuid: ids.branch, store_uuid_fk: ids.store, login_status: 1, store_status: 2,
  }));
  router = createSimulatorRouter({ database, auth, bootstrap: loadBootstrap, authorize: fixtureScope });
  app.use("/api/v1", router);
  // Read-only fixtures let the actual authorized POS render its launcher. Any
  // unexpected production mutation is rejected even inside this test server.
  app.get("/api/v1/permission/menu", auth, (_request, response) => response.json({ status: "success", data: [{ role_id: 1,
    menus: [{ menu_id: "training-pos", menu_title: "POS", menu_path: "/posAll/tables", menu_icon: "mdi:silverware-fork-knife", menu_is_dropdown: false }] }] }));
  app.get("/api/v1/posAll/fetch_table", auth, (_request, response) => response.json({ status: "success", message: "success", data: [{
    zone_uuid: "fixture-zone", zone_name: "Dining", tables: [{ table_uuid: ids.table, table_name: "A1", table_status: 1, number_of_seats: 4 }],
  }] }));
  app.get("*", (_request, response) => response.json({ status: "success", message: "fixture read", data: [] }));
  app.use((_request, response) => response.status(405).json({ status: "error", message: "Production writes are forbidden in browser fixtures" }));
  server = await new Promise((done, fail) => {
    const active = app.listen(backendPort, "127.0.0.1", () => done(active));
    active.once("error", fail);
  });
}

async function startFrontend() {
  // Keep only disposable build/source artifacts between runs so a failed browser
  // assertion does not require another full cold compilation. No database or env
  // files are written here; all simulation persistence remains in the Node test DB.
  project = join(artifactDirectory, "frontend-workspace");
  await mkdir(project, { recursive: true });
  for (const file of ["package.json", "next.config.ts", "tsconfig.json", "next-env.d.ts", "postcss.config.mjs"]) {
    if (existsSync(join(frontend, file))) await copyFile(join(frontend, file), join(project, file));
  }
  // Next's route watcher does not discover an app directory through a symlink.
  // Copy only source (no env files); dependencies and public assets stay shared.
  const sync = async (source, target) => {
    await mkdir(target, { recursive: true });
    for (const entry of await readdir(source, { withFileTypes: true })) {
      const from = join(source, entry.name), to = join(target, entry.name);
      if (entry.isDirectory()) await sync(from, to);
      else if (entry.isFile()) {
        const content = await readFile(from);
        if (!existsSync(to) || !content.equals(await readFile(to))) await writeFile(to, content);
      }
    }
  };
  await sync(join(frontend, "src"), join(project, "src"));
  for (const folder of ["public", "node_modules", "assets"]) {
    if (existsSync(join(frontend, folder)) && !existsSync(join(project, folder))) await symlink(join(frontend, folder), join(project, folder), "dir");
  }
  // PostCSS imports this local helper while the temporary project owns all build output.
  if (!existsSync(join(project, "scripts"))) await symlink(join(frontend, "scripts"), join(project, "scripts"), "dir");
  nextProcess = spawn(process.execPath, [join(frontend, "node_modules/next/dist/bin/next"), "dev", project, "--webpack", "--hostname", "127.0.0.1", "--port", String(frontendPort)], {
    cwd: project,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_BASE_URL: backendOrigin,
      NEXT_PUBLIC_SOCKET_URL: backendOrigin, NEXT_PUBLIC_API_URL: backendOrigin, NEXT_PUBLIC_PRINTER_AGENT_URL: backendOrigin },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const capture = (chunk) => { nextOutput = (nextOutput + chunk.toString()).slice(-18000); };
  nextProcess.stdout.on("data", capture); nextProcess.stderr.on("data", capture);
  await waitUntil(async () => {
    if (nextProcess.exitCode !== null) throw new Error(`Fixture Next server exited (${nextProcess.exitCode}): ${nextOutput}`);
    try { return (await fetch(`${frontendOrigin}/app-version.json`, { signal: AbortSignal.timeout(1000) })).status === 200; }
    catch { return false; }
  }, "fixture frontend readiness", 120_000);
  const warmed = await fetch(`${frontendOrigin}/simulator`, { signal: AbortSignal.timeout(300_000) });
  assert.equal(warmed.status, 200, `Simulator route warm-up failed: ${nextOutput}`);
}

async function createBrowserContext(viewport = { width: 1480, height: 1040 }, mobile = false) {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin === backendOrigin && url.pathname.startsWith("/api/v1/")) {
      let source = "";
      try { source = new URL(route.request().frame().page().url()).pathname; } catch {}
      uiRequests.push({ source, method: route.request().method(), path: url.pathname });
    }
    if ([frontendOrigin, backendOrigin].includes(url.origin) || ["data:", "blob:"].includes(url.protocol)) return route.continue();
    blockedExternal.push(`${url.origin}${url.pathname}`);
    return route.abort("blockedbyclient");
  });
  await context.routeWebSocket("**/*", (socket) => {
    // Next's local HMR channel is part of its development bootstrap. Closing it
    // forces repeated reloads; every backend/external socket remains blocked.
    const url = new URL(socket.url());
    if (url.host === new URL(frontendOrigin).host) socket.connectToServer();
    else socket.close();
  });
  await context.addCookies([{ name: "yummy-go-language", value: "en", url: frontendOrigin }]);
  await context.addInitScript(({ user, token, origin }) => {
    if (window.location.origin !== origin) return;
    window.__simulatorDraws = 0;
    for (const type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
      if (!type) continue;
      for (const method of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
        const original = type.prototype[method];
        if (typeof original !== "function") continue;
        type.prototype[method] = function (...args) {
          window.__simulatorDraws += 1;
          return original.apply(this, args);
        };
      }
    }
    if (window.opener) return;
    sessionStorage.setItem("yummy-go-auth", JSON.stringify({ state: { token, user, isLoggedIn: true, rememberMe: false }, version: 0 }));
    localStorage.setItem("yummy-go-app", JSON.stringify({ state: { language: "en", theme: "light", themeColor: "emerald", fontScale: "md", decorBackground: false, laoFont: "noto-sans" }, version: 1 }));
  }, { user: actor, token: fakeToken, origin: frontendOrigin });
  context.on("page", (active) => {
    active.on("pageerror", (error) => pageErrors.push(`${active.url()}: ${error.stack || error.message}`));
    active.on("console", (entry) => { if (["error", "warning"].includes(entry.type())) browserLog.push({ kind: entry.type(), message: entry.text().slice(0, 1500) }); });
    active.on("request", (request) => pendingResources.add(request.url()));
    active.on("requestfinished", (request) => pendingResources.delete(request.url()));
    active.on("requestfailed", (request) => { pendingResources.delete(request.url()); browserLog.push({ kind: "requestfailed", path: request.url(), error: request.failure()?.errorText }); });
    active.on("response", (response) => {
      if (response.status() >= 400 || (response.url().includes("/_next/") && response.request().resourceType() === "script")) {
        browserLog.push({ kind: "response", status: response.status(), path: response.url(), type: response.headers()["content-type"] });
      }
    });
  });
  return context;
}

async function openTableAndAdd(targetPage, tableName = "A1") {
  const tables = targetPage.locator("aside").filter({ has: targetPage.getByRole("heading", { name: "Tables", exact: true }) });
  await click(tables.getByRole("button").filter({ hasText: tableName }));
  const operations = targetPage.getByRole("complementary", { name: "Operations", exact: true });
  await fill(operations.getByRole("textbox", { name: "Customer name", exact: true }), "Browser guest");
  await actionClick("open_table", operations.getByRole("button", { name: "Open table", exact: true }), targetPage);
  await click(operations.getByRole("tab", { name: "Menu", exact: true }));
  await click(operations.getByRole("button").filter({ hasText: "Noodles" }));
  const dialog = targetPage.getByRole("dialog");
  await fill(dialog.getByRole("spinbutton", { name: "Quantity", exact: true }), "2");
  await fill(dialog.getByRole("textbox", { name: "Item note", exact: true }), "Browser smoke note");
  await actionClick("add_item", dialog.getByRole("button", { name: "Add to bill", exact: true }), targetPage);
  await dialog.waitFor({ state: "hidden" });
  await click(operations.getByRole("tab", { name: "Bill", exact: true }));
  return operations;
}

try {
  await mkdir(artifactDirectory, { recursive: true });
  await step("Start disposable PostgreSQL backend and isolated local frontend", async () => { await startFixtureServer(); await startFrontend(); });
  browser = await chromium.launch({ executablePath: chromePath, headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-background-networking", "--disable-component-update", "--no-first-run", "--disable-sync"] });
  const context = await createBrowserContext();
  page = await context.newPage();
  await step("Authenticate and start an online server simulation", async () => {
    await page.goto(`${frontendOrigin}/simulator?branch_uuid=${ids.branch}&mode=training`, { waitUntil: "domcontentloaded" });
    const storage = await page.evaluate(() => ({ origin: location.origin, auth: Boolean(sessionStorage.getItem("yummy-go-auth")), preferences: Boolean(localStorage.getItem("yummy-go-app")) }));
    assert(storage.auth && storage.preferences, `Fixture authentication was not seeded: ${JSON.stringify(storage)}`);
    await fill(page.getByRole("textbox", { name: "Session name", exact: true }), "Browser operations");
    await actionClick("start", page.getByRole("button", { name: "Start simulation", exact: true }));
    await page.locator("canvas").waitFor({ state: "visible", timeout: 60_000 });
    assert.equal((await state()).status, "running");
    await writeFile(join(artifactDirectory, "initial-dom.yml"), await page.locator("main").ariaSnapshot());
  });
  let operations;
  await step("Open a real simulation table and add a product with a note", async () => {
    operations = await openTableAndAdd(page);
    const current = await state();
    assert.equal(current.orders.length, 1); assert.equal(current.orders[0].items[0].quantity, 2);
    assert.equal(current.orders[0].items[0].note, "Browser smoke note");
  });
  await step("Increase and decrease quantities through validated commands", async () => {
    await actionClick("edit_item", operations.getByRole("button", { name: "Quantity + Noodles", exact: true }));
    assert.equal((await state()).orders[0].items[0].quantity, 3);
    await actionClick("edit_item", operations.getByRole("button", { name: "Quantity − Noodles", exact: true }));
    assert.equal((await state()).orders[0].items[0].quantity, 2);
  });
  await step("Confirm, fail/retry a simulated printer, prepare and serve food", async () => {
    await actionClick("confirm", operations.getByRole("button", { name: "Send to kitchen", exact: true }));
    await click(page.getByRole("button", { name: "Simulate printer failure", exact: true }));
    await actionClick("printer_fail", page.getByRole("alertdialog").getByRole("button", { name: "Confirm", exact: true }));
    assert.equal((await state()).kitchen[0].print_status, "failed");
    await actionClick("printer_retry", page.getByRole("button", { name: "Retry print", exact: true }));
    await actionClick("kitchen_ready", page.getByRole("button", { name: "Mark ready", exact: true }));
    await actionClick("serve", page.getByRole("button", { name: "Serve food", exact: true }));
    assert.equal((await state()).orders[0].items[0].status, 4);
    assert.equal((await state()).inventory[ids.detail], 98);
    await page.screenshot({ path: join(artifactDirectory, "desktop-service.png"), fullPage: true });
  });
  await step("Pay, generate a simulated receipt, release the table and update sales", async () => {
    await click(operations.getByRole("button", { name: "Payment", exact: true }));
    await actionClick("pay", page.getByRole("dialog").getByRole("button", { name: "Complete simulated payment", exact: true }));
    const current = await state();
    assert.equal(current.orders[0].status, "paid"); assert.equal(current.tables[0].status, 1); assert.equal(current.sales.bills, 1);
    await click(page.getByRole("tab", { name: "Order history", exact: true }));
    await click(page.getByRole("tabpanel").getByRole("button").filter({ hasText: "Browser guest" }));
    await unique(page.getByRole("heading", { name: "Simulated receipt", exact: true }));
    assert(await page.getByRole("dialog").getByText("SIMULATION · NOT A TAX RECEIPT", { exact: true }).isVisible());
    await page.screenshot({ path: join(artifactDirectory, "simulated-receipt.png"), fullPage: true });
    await page.keyboard.press("Escape");
  });
  await step("Persist, reset and restore the server snapshot", async () => {
    await actionClick("save", page.getByRole("button", { name: "Save snapshot", exact: true }));
    await click(page.getByRole("button", { name: "Reset", exact: true }));
    await actionClick("reset", page.getByRole("alertdialog").getByRole("button", { name: "Confirm", exact: true }));
    assert.equal((await state()).orders.length, 0);
    await click(page.getByRole("button", { name: "Restore snapshot", exact: true }));
    await actionClick("restore", page.getByRole("alertdialog").getByRole("button", { name: "Confirm", exact: true }));
    assert.equal((await state()).sales.bills, 1); assert.equal((await state()).status, "paused");
    await actionClick("resume", page.getByRole("button", { name: "Resume", exact: true }));
  });
  await step("Stop transactions while disconnected and restore authenticated server state", async () => {
    const original = await state();
    await context.setOffline(true);
    await page.getByRole("alert").getByText("Connection interrupted", { exact: true }).waitFor({ state: "visible" });
    assert(await page.getByRole("button", { name: "Pause", exact: true }).isDisabled());
    assert.equal((await state()).version, original.version);
    await page.screenshot({ path: join(artifactDirectory, "connection-interrupted.png"), fullPage: true });
    await context.setOffline(false);
    await waitUntil(async () => await page.getByRole("button", { name: "Pause", exact: true }).isEnabled(), "online state recovery");
    assert.equal((await state()).version, original.version);
  });
  await step("Recover a committed payment after losing its response without charging twice", async () => {
    operations = await openTableAndAdd(page, "A2");
    await click(page.getByRole("tab", { name: "Kitchen queue", exact: false }));
    await actionClick("confirm", operations.getByRole("button", { name: "Send to kitchen", exact: true }));
    await actionClick("kitchen_ready", page.getByRole("button", { name: "Mark ready", exact: true }));
    await actionClick("serve", page.getByRole("button", { name: "Serve food", exact: true }));
    await click(operations.getByRole("button", { name: "Payment", exact: true }));
    dropNextAction = "pay";
    await click(page.getByRole("dialog").getByRole("button", { name: "Complete simulated payment", exact: true }));
    await waitUntil(async () => (await state()).sales.bills === 2, "interrupted payment committed once");
    await click(page.getByRole("dialog").getByRole("button", { name: "Back", exact: true }));
    await page.getByRole("alert").getByText("Connection interrupted", { exact: true }).waitFor({ state: "visible" });
    await click(page.getByRole("button", { name: "Reconnect", exact: true }));
    await waitUntil(async () => await page.getByRole("button", { name: "Pause", exact: true }).isEnabled(), "idempotent payment recovery");
    const current = await state();
    assert.equal(current.sales.bills, 2);
    assert.equal(current.orders.reduce((total, order) => total + order.payments.length, 0), 2);
    const operation = await pg.query("SELECT count(*)::integer AS count FROM simulator_operations WHERE operation_uuid=$1::uuid", [interruptedAction.operation_uuid]);
    assert.equal(operation.rows[0].count, 1);
  });
  await step("Restore the session after browser reload", async () => {
    const id = (await state()).session_uuid;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Pause", exact: true }).waitFor({ state: "visible" });
    assert(new URL(page.url()).searchParams.get("session_uuid") === id);
    assert.equal((await state()).sales.bills, 2);
  });
  await step("Manage isolated customer profiles, product deposits and zero-charge withdrawals", async () => {
    await click(page.getByRole("tab", { name: "Customers & product deposits", exact: true }));
    await click(page.getByRole("button", { name: "New customer", exact: true }));
    let dialog = page.getByRole("dialog");
    await fill(dialog.getByRole("textbox", { name: "Customer name", exact: true }), "Browser member");
    await fill(dialog.getByRole("textbox", { name: "Phone", exact: true }), "02000000000");
    await fill(dialog.getByRole("textbox", { name: "Member code", exact: true }), "E2E-MEMBER");
    await actionClick("customer_create", dialog.getByRole("button", { name: "Confirm", exact: true }));
    await dialog.waitFor({ state: "hidden" });
    await click(page.getByRole("button", { name: "Deposit products", exact: true }));
    dialog = page.getByRole("dialog");
    await click(dialog.getByRole("combobox", { name: "Customer name", exact: true }));
    await click(page.getByRole("option", { name: "Browser member", exact: true }));
    await click(dialog.getByRole("combobox", { name: "Menu", exact: true }));
    await click(page.getByRole("option", { name: "Noodles", exact: true }));
    await fill(dialog.getByRole("spinbutton", { name: "Quantity", exact: true }), "2.5");
    await actionClick("deposit_create", dialog.getByRole("button", { name: "Confirm", exact: true }));
    await dialog.waitFor({ state: "hidden" });
    const before = await state();
    assert.equal(before.deposits[0].remaining_qty, 2.5);
    await click(page.getByRole("button", { name: "Withdraw", exact: true }));
    dialog = page.getByRole("dialog");
    await fill(dialog.getByRole("spinbutton", { name: "Quantity", exact: true }), "0.5");
    await actionClick("deposit_withdraw", dialog.getByRole("button", { name: "Confirm", exact: true }));
    await dialog.waitFor({ state: "hidden" });
    const current = await state();
    assert.equal(current.deposits[0].remaining_qty, 2);
    assert.equal(current.deposit_withdrawals[0].chargeable, false);
    assert.equal(current.deposit_withdrawals[0].amount, 0);
    assert.deepEqual(current.sales, before.sales);
    assert.deepEqual(current.inventory, before.inventory);
  });
  await step("Create a simulated table QR and submit customer drafts for separate staff confirmation", async () => {
    const tables = page.locator("aside").filter({ has: page.getByRole("heading", { name: "Tables", exact: true }) });
    await click(tables.getByRole("button").filter({ hasText: "A1" }));
    operations = page.getByRole("complementary", { name: "Operations", exact: true });
    await actionClick("open_table", operations.getByRole("button", { name: "Open table", exact: true }));
    await actionClick("visit_create", operations.getByRole("button", { name: "Table QR", exact: true }));
    const visitDialog = page.getByRole("dialog", { name: "Simulated table visit", exact: true });
    await unique(visitDialog.getByRole("img", { name: "Table QR", exact: true }));
    const visit = (await state()).visits.find((entry) => entry.enabled);
    assert(visit.code.startsWith("SIM-"));
    assert(visit.token.startsWith("simvisit_"));
    await click(visitDialog.getByRole("tab", { name: "Customer ordering", exact: true }));
    await fill(visitDialog.getByRole("textbox", { name: "Simulation QR token or visit code", exact: true }), visit.code);
    await actionClick("visit_scan", visitDialog.getByRole("button", { name: "Scan code", exact: true }));
    await click(visitDialog.getByRole("button").filter({ hasText: "Noodles" }));
    const productDialog = page.getByRole("dialog", { name: "Noodles", exact: true });
    await fill(productDialog.getByRole("textbox", { name: "Item note", exact: true }), "Customer QR note");
    await actionClick("visit_add_item", productDialog.getByRole("button", { name: "Add to bill", exact: true }));
    await productDialog.waitFor({ state: "hidden" });
    let current = await state();
    assert.equal(current.orders.find((order) => order.order_uuid === visit.order_uuid).items[0].status, 0);
    await actionClick("visit_submit", visitDialog.getByRole("button", { name: "Submit customer order", exact: true }));
    current = await state();
    assert.equal(current.orders.find((order) => order.order_uuid === visit.order_uuid).items[0].status, 1);
    await page.screenshot({ path: join(artifactDirectory, "customer-visit.png"), fullPage: true });
    await page.keyboard.press("Escape");
    await actionClick("confirm", operations.getByRole("button", { name: "Send to kitchen", exact: true }));
    assert.equal((await state()).orders.find((order) => order.order_uuid === visit.order_uuid).items[0].status, 2);
  });
  await step("Settle a fully discounted zero-value bill and display its simulated receipt", async () => {
    operations = page.getByRole("complementary", { name: "Operations", exact: true });
    await click(operations.getByRole("button", { name: "% Discount", exact: true }));
    let dialog = page.getByRole("dialog");
    await fill(dialog.getByRole("spinbutton", { name: "Amount tendered", exact: true }), "100");
    await actionClick("discount", dialog.getByRole("button", { name: "Apply", exact: true }));
    await dialog.waitFor({ state: "hidden" });
    const discounted = (await state()).orders.find((order) => order.status === "open");
    assert.equal(discounted.totals.balance, 0);
    await click(operations.getByRole("button", { name: "Payment", exact: true }));
    dialog = page.getByRole("dialog");
    assert.equal(await dialog.getByRole("spinbutton", { name: "Amount tendered", exact: true }).inputValue(), "0");
    assert(await dialog.getByRole("button", { name: "Complete simulated payment", exact: true }).isEnabled());
    await actionClick("pay", dialog.getByRole("button", { name: "Complete simulated payment", exact: true }));
    const paid = (await state()).orders.find((order) => order.order_uuid === discounted.order_uuid);
    assert.equal(paid.status, "paid"); assert.equal(paid.receipt.totals.total, 0);
    assert.equal((await state()).tables.find((table) => table.table_uuid === ids.table).status, 1);
    await click(page.getByRole("tab", { name: "Order history", exact: true }));
    await click(page.getByRole("tabpanel").getByRole("button").filter({ hasText: paid.receipt.receipt_number }));
    await unique(page.getByRole("heading", { name: "Simulated receipt", exact: true }));
    await page.screenshot({ path: join(artifactDirectory, "zero-value-receipt.png"), fullPage: true });
    await page.keyboard.press("Escape");
  });
  await step("Advance autonomous customers using actual online simulation ticks", async () => {
    await page.bringToFront();
    await click(page.getByRole("combobox", { name: "Manual", exact: true }));
    await actionClick("mode", page.getByRole("option", { name: "Auto", exact: true }));
    await waitUntil(async () => (await state()).tick >= 2, "autonomous service ticks", 20_000);
    assert((await state()).customers.length > 0);
    // Playwright normally forces every page to report focus. Remove that
    // override while checking the real foreground/background transition.
    const focus = await context.newCDPSession(page);
    await focus.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    const inactive = await context.newPage();
    const inactiveFocus = await context.newCDPSession(inactive);
    await inactiveFocus.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    await inactive.goto(`${frontendOrigin}/app-version.json`);
    await inactive.bringToFront();
    await waitUntil(async () => !await page.evaluate(() => document.hasFocus()), "simulator window loses focus");
    await delay(400);
    const pausedTick = (await state()).tick;
    const pausedDraws = await page.evaluate(() => window.__simulatorDraws);
    assert(pausedDraws > 0, "WebGL instrumentation must observe real scene rendering before the inactivity check");
    await delay(2300);
    assert.equal((await state()).tick, pausedTick, "A visible but inactive simulator window must stop automatic transactions");
    assert.equal(await page.evaluate(() => window.__simulatorDraws), pausedDraws, "A visible but inactive simulator window must stop WebGL rendering");
    await page.bringToFront();
    await focus.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await waitUntil(async () => (await state()).tick > pausedTick, "automatic service resumes only after refocus", 20_000);
    await inactiveFocus.detach();
    await focus.detach();
    await inactive.close();
    await click(page.getByRole("combobox", { name: "Manual", exact: true }));
    await actionClick("mode", page.getByRole("option", { name: "Manual", exact: true }));
    assert.equal((await state()).mode, "manual");
    await page.screenshot({ path: join(artifactDirectory, "autonomous-customers.png"), fullPage: true });
  });
  await step("Verify a touch viewport and localized controls", async () => {
    const mobileContext = await createBrowserContext({ width: 390, height: 844 }, true);
    const mobile = await mobileContext.newPage();
    await mobile.goto(page.url(), { waitUntil: "domcontentloaded" });
    await mobile.getByRole("button", { name: "Pause", exact: true }).waitFor({ state: "visible" });
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow, false, "The simulator must not create horizontal overflow at phone width");
    await click(mobile.getByRole("combobox", { name: "Language", exact: true }));
    await click(mobile.getByRole("option", { name: "ไทย", exact: true }));
    await unique(mobile.getByRole("heading", { name: "เครื่องจำลองร้านอาหาร", exact: true }));
    await mobile.screenshot({ path: join(artifactDirectory, "mobile-thai.png"), fullPage: true });
    await mobileContext.close();
  });
  await step("Open the authenticated simulator in a separate POS window and close it independently", async () => {
    const main = await context.newPage();
    const mainRequests = [];
    main.on("request", (request) => mainRequests.push(request.url()));
    await main.goto(`${frontendOrigin}/posAll/tables`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const launcher = main.getByRole("button", { name: "3D Simulator", exact: true });
    await unique(launcher);
    assert(!mainRequests.some((url) => url.includes("restaurant-scene")), "The main POS must not load simulator 3D chunks");
    const popupPromise = main.waitForEvent("popup");
    await click(launcher);
    const popup = await popupPromise;
    await unique(popup.getByRole("heading", { name: "Live restaurant", exact: true }));
    assert.equal(await popup.getByRole("button", { name: "Start simulation", exact: true }).count(), 0);
    assert.equal(new URL(popup.url()).searchParams.get("branch_uuid"), ids.branch);
    await popup.close();
    assert.equal(main.isClosed(), false);
    assert.equal(new URL(main.url()).pathname, "/posAll/tables");
    await main.close();
  });
  const trainingPage = page;
  let liveContext = await createBrowserContext({ width: 390, height: 844 }, true);
  page = await liveContext.newPage();
  const liveRequestsStart = uiRequests.length;
  await step("Read actual orders in the default live view on a touch viewport", async () => {
    await page.goto(`${frontendOrigin}/simulator?branch_uuid=${ids.branch}`, { waitUntil: "domcontentloaded" });
    await unique(page.getByRole("heading", { name: "Live restaurant", exact: true }));
    const tables = page.locator("aside").filter({ has: page.getByRole("heading", { name: "Tables", exact: true }) });
    await click(tables.getByRole("button").filter({ hasText: "A1" }).filter({ hasText: "seats" }));
    await unique(page.getByTestId("live-order-items").getByText("Ordered noodles", { exact: true }));
    assert.equal(await page.getByRole("button", { name: "Start simulation", exact: true }).count(), 0);
    assert.equal(await page.getByRole("button", { name: "Send to kitchen", exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.locator("canvas").waitFor({ state: "visible" });
    await page.screenshot({ path: join(artifactDirectory, "live-mobile.png"), fullPage: true });
  });
  await step("Mirror newly submitted customer orders automatically without commands", async () => {
    await pg.query("UPDATE tb_table SET table_status=4 WHERE table_uuid=$1", [ids.table]);
    await pg.query("UPDATE tb_order_item SET order_it_qty=3,order_it_status=0,order_it_prod_name_eng='Fresh customer order' WHERE order_it_uuid=$1", [liveIds.item]);
    await unique(page.getByTestId("live-order-items").getByText("Fresh customer order", { exact: true }));
    assert.equal(await page.getByTestId("live-order-items").getByLabel("Quantity").innerText(), "× 3");
    await unique(page.getByTestId("live-order-items").getByText("Customer draft", { exact: true }));
    await pg.query("UPDATE tb_order_item SET order_it_status=2 WHERE order_it_uuid=$1", [liveIds.item]);
    await click(page.getByRole("button", { name: "Refresh now", exact: true }));
    await unique(page.getByTestId("live-order-items").getByText("Sent to kitchen", { exact: true }));
    const writes = uiRequests.slice(liveRequestsStart).filter((request) => !["GET", "OPTIONS"].includes(request.method) && request.path !== "/api/v1/access-data");
    assert.deepEqual(writes, [], "Live view must never create simulator or production commands");
  });
  await step("Mark stale live data offline and recover the actual paid/table state", async () => {
    await liveContext.setOffline(true);
    await unique(page.getByRole("alert").getByText("Updates unavailable — showing the last successful snapshot", { exact: true }));
    await unique(page.getByTestId("live-order-items").getByText("Fresh customer order", { exact: true }));
    await pg.query("UPDATE tb_orders SET order_check_bill=2 WHERE order_uuid=$1", [liveIds.order]);
    await pg.query("UPDATE tb_table SET table_status=1 WHERE table_uuid=$1", [ids.table]);
    await liveContext.setOffline(false);
    await unique(page.getByText("No open order on this table", { exact: true }));
    assert.equal(await page.getByTestId("live-order-items").count(), 0);
    // Mobile emulation can reload during a viewport reset. Use a separate
    // desktop context so that reload cannot race a subsequent language change.
    const mobileContext = liveContext;
    const liveUrl = page.url();
    liveContext = await createBrowserContext();
    page = await liveContext.newPage();
    await page.goto(liveUrl, { waitUntil: "domcontentloaded" });
    await page.locator("canvas").waitFor({ state: "visible" });
    await mobileContext.close();
    await page.screenshot({ path: join(artifactDirectory, "live-desktop.png"), fullPage: true });
    await click(page.getByRole("combobox", { name: "Language", exact: true }));
    await click(page.getByRole("option", { name: "ไทย", exact: true }));
    await unique(page.getByRole("heading", { name: "ร้านจริง", exact: true }));
    await page.screenshot({ path: join(artifactDirectory, "live-desktop-thai.png"), fullPage: true });
  });
  await step("Pause live polling and WebGL while another window is active", async () => {
    const focus = await liveContext.newCDPSession(page);
    await focus.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    const other = await liveContext.newPage();
    const otherFocus = await liveContext.newCDPSession(other);
    await otherFocus.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    await other.goto(`${frontendOrigin}/app-version.json`);
    await other.bringToFront();
    await waitUntil(async () => !await page.evaluate(() => document.hasFocus()), "live window loses focus");
    await delay(400);
    const reads = requests.filter((request) => request.path === "/api/v1/simulator/live").length;
    const draws = await page.evaluate(() => window.__simulatorDraws);
    await delay(10_500);
    assert.equal(requests.filter((request) => request.path === "/api/v1/simulator/live").length, reads, "Inactive live windows must stop querying the backend");
    assert.equal(await page.evaluate(() => window.__simulatorDraws), draws, "Inactive live windows must stop rendering");
    await page.bringToFront();
    await focus.send("Emulation.setFocusEmulationEnabled", { enabled: true });
    await waitUntil(async () => requests.filter((request) => request.path === "/api/v1/simulator/live").length > reads, "live refresh after focus");
    await otherFocus.detach(); await focus.detach(); await other.close();
  });
  await step("Switch modes and pause training before returning to actual restaurant data", async () => {
    await click(page.getByRole("combobox", { name: "ภาษา", exact: true }));
    await click(page.getByRole("option", { name: "English", exact: true }));
    await click(page.getByRole("button", { name: "Training", exact: true }));
    await unique(page.getByRole("heading", { name: "Restaurant simulator", exact: true }));
    if (liveOnly) {
      await fill(page.getByRole("textbox", { name: "Session name", exact: true }), "Browser operations");
      await actionClick("start", page.getByRole("button", { name: "Start simulation", exact: true }));
    } else await click(page.getByRole("button", { name: "Browser operations", exact: true }));
    await unique(page.getByRole("button", { name: "Pause", exact: true }));
    await actionClick("pause", page.getByRole("button", { name: "Live restaurant", exact: true }));
    await unique(page.getByRole("heading", { name: "Live restaurant", exact: true }));
    assert.equal((await state()).status, "paused");
    assert.equal(new URL(page.url()).searchParams.get("session_uuid"), null);
    assert.equal(new URL(page.url()).searchParams.get("mode"), "live");
  });
  await liveContext.close();
  page = trainingPage;
  await step("Verify isolation and browser error safety", async () => {
    const sentinel = await pg.query("SELECT value FROM production_sentinel WHERE id=1");
    assert.equal(sentinel.rows[0].value, "untouched production order/payment/print/stock sentinel");
    for (const query of queryLog.filter((sql) => /^\s*(INSERT|UPDATE|DELETE)/i.test(sql))) assert.match(query, /public\.simulator_/);
    const writes = uiRequests.filter((request) => request.source === "/simulator" && !["GET", "OPTIONS"].includes(request.method) && request.path !== "/api/v1/access-data");
    assert(writes.every((request) => request.path.startsWith("/api/v1/simulator/")), "UI must not call production transaction or printing endpoints");
    assert.deepEqual(pageErrors, [], "Browser must have no uncaught application errors");
  });
  console.log(JSON.stringify({ passed: true, steps: steps.length, artifacts: artifactDirectory, blocked_external_requests: blockedExternal.length, action_requests: requests.filter((request) => request.action).length }));
  await writeFile(join(artifactDirectory, "results.json"), JSON.stringify({ passed: true, scope: liveOnly ? "live" : "full", steps, pageErrors, blockedExternal }, null, 2));
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: join(artifactDirectory, "failure.png"), fullPage: true }).catch(() => {});
    await writeFile(join(artifactDirectory, "failure-dom.yml"), await page.locator("body").ariaSnapshot()).catch(() => {});
    await writeFile(join(artifactDirectory, "browser-diagnostic.json"), JSON.stringify(await page.evaluate(() => {
      const chunks = window.webpackChunk_N_E;
      let webpack;
      chunks?.push([[`fixture-debug-${Date.now()}`], {}, (runtime) => { webpack = runtime; }]);
      const moduleIds = webpack?.c ? Object.keys(webpack.c).filter((id) => id.includes("auth-store")) : [];
      const store = moduleIds.map((id) => webpack.c[id]?.exports?.useAuthStore).find(Boolean);
      const auth = store?.getState();
      return { href: location.href, readyState: document.readyState, scripts: document.scripts.length,
        webpackPresent: Boolean(webpack), moduleIds,
        auth: auth ? { hydrated: auth.hydrated, loggedIn: auth.isLoggedIn, token: Boolean(auth.token), error: auth.error, persisted: store.persist?.hasHydrated() } : null,
        authStorageVersion: JSON.parse(sessionStorage.getItem("yummy-go-auth") || "{}").version,
        nextFlightQueueLength: window.__next_f?.length,
      };
    }), null, 2)).catch(() => {});
  }
  await writeFile(join(artifactDirectory, "next-output.log"), nextOutput).catch(() => {});
  await writeFile(join(artifactDirectory, "results.json"), JSON.stringify({ passed: false, steps, pageErrors, error: String(error), blockedExternal, fixtureRequests: requests, browserLog, pendingResources: [...pendingResources] }, null, 2)).catch(() => {});
  console.error(error);
  console.error(`Browser verification artifacts: ${artifactDirectory}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  router?.simulatorRepository.close();
  if (server) { server.closeAllConnections(); await new Promise((done) => server.close(done)); }
  if (nextProcess && nextProcess.exitCode === null) {
    nextProcess.kill("SIGTERM");
    await Promise.race([new Promise((done) => nextProcess.once("exit", done)), delay(5000)]);
    if (nextProcess.exitCode === null) nextProcess.kill("SIGKILL");
  }
  await pg?.close();
}
