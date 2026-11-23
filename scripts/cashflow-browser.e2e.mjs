import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, readdir, writeFile, copyFile, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(frontend, "../back-end");
const requireBackend = createRequire(join(backend, "package.json"));
const express = requireBackend("express");
const { fixture, id, STORE, BRANCH, SIBLING, ACTOR } = requireBackend("./api/v1/cashflow/test-fixture.js");
const { createCashflowRouter } = requireBackend("./api/v1/cashflow/router.js");
const { getReportingBusinessDateYMD } = requireBackend("./api/v1/shared/reporting-business-day.js");
assert(!Object.keys(requireBackend.cache).some((name) => name === join(backend, "config/db.js")), "Never import production database configuration");

const artifacts = resolve(frontend, "../.work/cashflow-browser");
const apiOrigin = "http://127.0.0.1:3230", webOrigin = "http://127.0.0.1:3231";
const today = getReportingBusinessDateYMD();
const labels = JSON.parse(await readFile(join(frontend, "public/locales/en/common.json"), "utf8"));
const user = { uuid: ACTOR, email: "finance-fixture@example.test", name: "Finance fixture", status: 1, profile: "",
  branch_uuid: BRANCH, branch_name: "Branch A", branch_tel: "", branch_address: "", store_uuid: STORE,
  store_uuid_fk: STORE, store_name: "Fixture restaurant", store_logo: "", store_status: 2, store_table_status: 1 };
const errors = [], steps = [];
let database, apiServer, nextProcess, browser, page;
let nextOutput = "", serial = Promise.resolve();

async function until(test, description, timeout = 45_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (await test()) return; await delay(100); }
  throw new Error(`Timed out: ${description}`);
}
async function step(name, run) {
  console.log(`RUN ${name}`);
  await run();
  steps.push(name);
  console.log(`PASS ${name}`);
}
async function click(locator) { assert.equal(await locator.count(), 1); await locator.click(); }
async function choose(id, name) {
  await click(page.locator(`#${id}`));
  await click(page.getByRole("option", { name, exact: true }));
}

async function startApi() {
  ({ database } = await fixture());
  const scopedDatabase = { async connect() {
    const previous = serial;
    let release;
    serial = new Promise((done) => { release = done; });
    await previous;
    return { query: database.query.bind(database), release };
  } };
  const auth = (req, res, next) => {
    const role = Number(req.headers["x-access-token"]);
    if (![1, 3].includes(role)) return res.status(401).json({ status: "error", message: "Fixture session required" });
    Object.assign(req, { uuid: ACTOR, login_status: role, branch_uuid: BRANCH, store_uuid_fk: STORE });
    next();
  };
  const app = express();
  app.use((req, res, next) => {
    res.set({ "Access-Control-Allow-Origin": webOrigin, "Access-Control-Allow-Headers": "content-type,authorization,x-access-token", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" });
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.json());
  app.use("/api/v1", createCashflowRouter({ db: scopedDatabase, authenticate: auth }));
  app.post("/api/v1/access-data", auth, (req, res) => res.json({ status: "success", uuid: ACTOR,
    login_name: user.name, login_status: req.login_status, branch_uuid: BRANCH, store_uuid_fk: STORE, store_status: 2 }));
  app.get("/api/v1/branch/fetch_all", auth, (_req, res) => res.json({ status: "success", data: [
    { branch_uuid: BRANCH, branch_name: "Branch A", store_uuid_fk: STORE },
    { branch_uuid: SIBLING, branch_name: "Branch B", store_uuid_fk: STORE },
  ] }));
  app.get("/api/v1/permission/menu", auth, (req, res) => res.json({ status: "success", data: [{ role_id: req.login_status, menus: [{
    menu_id: id(80), menu_title: "Finance", menu_path: "/finance", menu_icon: "mdi:cash-multiple", menu_is_dropdown: true,
    sub_detail: ["/finance/entries", "/finance/categories", "/report/income-expenses"].map((path, index) => ({
      checked: true, sub_id: id(81 + index), sub_path: path, sub_title: ["Income and expenses", "Categories", "Income and expense report"][index], sub_status: 1,
    })),
  }] }] }));
  app.get("*", auth, (_req, res) => res.json({ status: "success", data: [] }));
  app.use((_req, res) => res.status(405).json({ status: "error", message: "Unsupported fixture mutation" }));
  apiServer = await new Promise((done, fail) => { const server = app.listen(3230, "127.0.0.1", () => done(server)); server.once("error", fail); });
  await database.exec(`INSERT INTO tb_orders VALUES('${id(100)}','${BRANCH}','SALE-1','0'),('${id(101)}','${BRANCH}','CREDIT-1','0');
    INSERT INTO tb_payment(payment_uuid,order_uuid_fk,payment_status,payment_method,cash_payment_amount,transfer_payment_amount,change_amount,paid_at)
    VALUES('${id(110)}','${id(100)}',1,3,1000,500,100,'${today} 01:00'),('${id(111)}','${id(101)}',1,4,0,0,0,'${today} 01:00');
    INSERT INTO tb_credit_receipt VALUES('${id(120)}','${BRANCH}','${today} 01:00');
    INSERT INTO tb_credit_receipt_detail VALUES('${id(121)}','${id(120)}','${id(111)}','${id(101)}',300);`);
}

async function startFrontend() {
  const project = join(artifacts, "frontend-workspace");
  await mkdir(project, { recursive: true });
  for (const file of ["package.json", "next.config.ts", "tsconfig.json", "next-env.d.ts", "postcss.config.mjs"]) {
    if (existsSync(join(frontend, file))) await copyFile(join(frontend, file), join(project, file));
  }
  const sync = async (from, to) => {
    await mkdir(to, { recursive: true });
    for (const entry of await readdir(from, { withFileTypes: true })) {
      if (entry.isDirectory()) await sync(join(from, entry.name), join(to, entry.name));
      else if (entry.isFile()) {
        const content = await readFile(join(from, entry.name));
        if (!existsSync(join(to, entry.name)) || !content.equals(await readFile(join(to, entry.name)))) await writeFile(join(to, entry.name), content);
      }
    }
  };
  await sync(join(frontend, "src"), join(project, "src"));
  for (const folder of ["public", "node_modules", "assets", "scripts"]) {
    if (existsSync(join(frontend, folder)) && !existsSync(join(project, folder))) await symlink(join(frontend, folder), join(project, folder), "dir");
  }
  // Native83's existing compatibility pass requires flattened CSS nesting.
  // Match production Tailwind optimization in this disposable dev workspace.
  const postcssFile = join(project, "postcss.config.mjs");
  const postcssConfig = await readFile(postcssFile, "utf8");
  assert(postcssConfig.includes('"@tailwindcss/postcss": {}'));
  await writeFile(postcssFile, postcssConfig.replace('"@tailwindcss/postcss": {}', '"@tailwindcss/postcss": { optimize: true }'));
  nextProcess = spawn(process.execPath, [join(frontend, "node_modules/next/dist/bin/next"), "dev", project, "--webpack", "--hostname", "127.0.0.1", "--port", "3231"], {
    cwd: project, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_BASE_URL: apiOrigin,
      NEXT_PUBLIC_API_URL: apiOrigin, NEXT_PUBLIC_SOCKET_URL: apiOrigin, NEXT_PUBLIC_PRINTER_AGENT_URL: apiOrigin }, stdio: ["ignore", "pipe", "pipe"],
  });
  const capture = (chunk) => { nextOutput = (nextOutput + chunk.toString()).slice(-12000); };
  nextProcess.stdout.on("data", capture); nextProcess.stderr.on("data", capture);
  await until(async () => {
    if (nextProcess.exitCode !== null) throw new Error(nextOutput);
    try { return (await fetch(`${webOrigin}/app-version.json`, { signal: AbortSignal.timeout(1000) })).ok; } catch { return false; }
  }, "local frontend", 60_000);
  const warmed = await fetch(`${webOrigin}/finance/categories`, { signal: AbortSignal.timeout(300_000) });
  assert.equal(warmed.status, 200, `Fixture route compilation failed: ${nextOutput}`);
}

async function context(role = 1, viewport = { width: 390, height: 844 }) {
  const active = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: viewport.width < 600 });
  await active.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return [webOrigin, apiOrigin].includes(url.origin) || ["data:", "blob:"].includes(url.protocol)
      ? route.continue() : route.abort("blockedbyclient");
  });
  await active.routeWebSocket("**/*", (socket) => {
    if (new URL(socket.url()).host === new URL(webOrigin).host) socket.connectToServer(); else socket.close();
  });
  await active.addCookies([{ name: "yummy-go-language", value: "en", url: webOrigin }]);
  await active.addInitScript(({ actor, token, origin }) => {
    if (window.location.origin !== origin) return;
    sessionStorage.setItem("yummy-go-auth", JSON.stringify({ state: { token, user: actor, isLoggedIn: true, rememberMe: false }, version: 0 }));
    localStorage.setItem("yummy-go-app", JSON.stringify({ state: { language: "en", theme: "light", themeColor: "emerald", fontScale: "md", decorBackground: false, laoFont: "noto-sans" }, version: 1 }));
  }, { actor: { ...user, status: role }, token: String(role), origin: webOrigin });
  active.on("page", (opened) => opened.on("pageerror", (error) => errors.push(error.message)));
  return active;
}

async function addEntry(direction, description, amount, group = "shop") {
  await click(page.getByRole("button", { name: direction === "income" ? labels.cashflow.addIncome : labels.cashflow.addExpense, exact: true }));
  await page.getByRole("dialog").waitFor();
  await choose("cashflow-form-category", "General operations");
  if (direction === "expense") await choose("cashflow-form-expense-group", labels.cashflow.expenseGroups[group]);
  await page.locator("#cashflow-form-date").fill(today);
  await page.locator("#cashflow-form-description").fill(description);
  await page.locator("#cashflow-form-amount").fill(String(amount));
  await click(page.getByRole("dialog").getByRole("button", { name: labels.actions.save, exact: true }));
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByRole("heading", { name: description, exact: true }).waitFor();
}

try {
  await step("Start disposable PostgreSQL and local frontend", async () => {
    await mkdir(artifacts, { recursive: true });
    await startApi();
    await startFrontend();
    browser = await chromium.launch({ headless: true, executablePath: process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : chromium.executablePath() });
    page = await (await context()).newPage();
  });
  await step("Create one shared income and expense category on mobile", async () => {
    await page.goto(`${webOrigin}/finance/categories`, { timeout: 120_000 });
    await page.getByRole("heading", { name: labels.cashflow.categoriesTitle, exact: true }).waitFor({ timeout: 90_000 });
    await click(page.getByRole("button", { name: labels.cashflow.addCategory, exact: true }));
    await page.locator("#cashflow-category-name").fill("General operations");
    await click(page.getByRole("dialog").getByRole("button", { name: labels.actions.save, exact: true }));
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    const category = (await database.query("SELECT direction FROM tb_cashflow_category WHERE name='General operations'")).rows[0];
    assert.equal(category.direction, "both");
  });
  await step("Record other income, shop expense and other expense", async () => {
    await page.goto(`${webOrigin}/finance/entries`, { timeout: 120_000 });
    await page.getByRole("button", { name: labels.cashflow.addIncome, exact: true }).waitFor({ timeout: 90_000 });
    await addEntry("income", "Other income fixture", 200);
    await addEntry("expense", "Shop expense fixture", 30);
    await addEntry("expense", "Other expense fixture", 20, "other");
    await page.screenshot({ path: join(artifacts, "entries-mobile.png"), fullPage: true });
  });
  await step("Report actual sales minus change and later debt collections once", async () => {
    await page.goto(`${webOrigin}/report/income-expenses`, { timeout: 120_000 });
    await page.getByText("1,900 LAK", { exact: true }).waitFor({ timeout: 90_000 });
    await page.getByText("1,850 LAK", { exact: true }).waitFor();
    const report = await fetch(`${apiOrigin}/api/v1/cashflow/report?branch_uuid=${BRANCH}&date_from=${today}&date_to=${today}`, { headers: { "x-access-token": "1" } }).then((response) => response.json());
    assert.deepEqual(report.data.summary, { sales_income: 1700, other_income: 200, income_total: 1900, shop_expense: 30, other_expense: 20, expense_total: 50, balance: 1850 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Mobile report must not overflow the page");
    await page.screenshot({ path: join(artifacts, "report-mobile.png"), fullPage: true });
  });
  await step("Switch branch and source filters without mixing financial data", async () => {
    await click(page.getByRole("button", { name: labels.report.filters.openFilters, exact: true }));
    await page.getByRole("dialog").waitFor();
    await choose("cashflow-report-mobile-source", labels.cashflow.sources.manual);
    await page.getByText("150 LAK", { exact: true }).waitFor();
    await choose("cashflow-report-mobile-source", labels.cashflow.sources.all);
    await click(page.getByRole("dialog").getByRole("button", { name: labels.report.apply, exact: true }));
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await page.getByText("1,900 LAK", { exact: true }).waitFor();
    await page.setViewportSize({ width: 1460, height: 1000 });
    await choose("cashflow-report-branch", "Branch B");
    await page.getByText(labels.cashflow.report.noActivity, { exact: true }).waitFor();
    await choose("cashflow-report-branch", "Branch A");
    await page.getByText("1,900 LAK", { exact: true }).waitFor();
    await choose("cashflow-report-source", labels.cashflow.sources.sales);
    await page.locator("p").filter({ hasText: "1,700 LAK" }).waitFor();
    assert.equal(await page.getByText("1,900 LAK", { exact: true }).count(), 0);
    await choose("cashflow-report-source", labels.cashflow.sources.all);
    await page.getByText("1,900 LAK", { exact: true }).waitFor();
  });
  await step("Export all selected-branch report sections to Excel", async () => {
    const download = page.waitForEvent("download");
    await click(page.getByRole("button", { name: labels.report.exportExcel, exact: true }));
    const file = await download;
    await file.saveAs(join(artifacts, "income-expenses.xlsx"));
    const XLSX = createRequire(join(frontend, "package.json"))("xlsx-js-style");
    const workbook = XLSX.readFile(join(artifacts, "income-expenses.xlsx"));
    assert.deepEqual(workbook.SheetNames, ["Summary", "Daily", "Categories"]);
    assert(XLSX.utils.sheet_to_json(workbook.Sheets.Summary, { header: 1 }).some((row) => row.includes(1850)));
    await page.setViewportSize({ width: 1460, height: 1000 });
    await page.screenshot({ path: join(artifacts, "report-desktop.png"), fullPage: true });
  });
  await step("Branch administrators remain locked to their own branch", async () => {
    const restricted = await (await context(3)).newPage();
    await restricted.goto(`${webOrigin}/finance/entries`, { timeout: 120_000 });
    await restricted.locator("#cashflow-entry-branch").waitFor({ timeout: 90_000 });
    assert.equal(await restricted.locator("#cashflow-entry-branch").isDisabled(), true);
    const denied = await fetch(`${apiOrigin}/api/v1/cashflow/entries?branch_uuid=${SIBLING}`, { headers: { "x-access-token": "3" } });
    assert.equal(denied.status, 403);
    await restricted.context().close();
  });
  assert.deepEqual(errors, [], "Browser must not report runtime errors");
  await writeFile(join(artifacts, "result.json"), JSON.stringify({ passed: true, steps, browser_errors: errors }, null, 2));
  console.log(`PASS all ${steps.length} cashflow browser checks; artifacts: ${artifacts}`);
} catch (error) {
  console.error(error);
  if (page && !page.isClosed()) await page.screenshot({ path: join(artifacts, "failure.png"), fullPage: true }).catch(() => {});
  await writeFile(join(artifacts, "failure.log"), `${error.stack || error}\n${nextOutput}`).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (nextProcess && nextProcess.exitCode === null) { nextProcess.kill("SIGTERM"); await new Promise((done) => nextProcess.once("exit", done)); }
  if (apiServer) await new Promise((done) => apiServer.close(done));
  await database?.close();
}
