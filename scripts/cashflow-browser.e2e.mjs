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
async function screenshot(name, resetScroll = true) {
  await until(async () => await page.locator("[data-sonner-toast]").count() === 0, "notification stack clears before visual review", 20_000);
  await until(async () => await page.locator('[data-slot="dialog-overlay"][data-state="closed"]').count() === 0,
    "dialog closing overlay clears before visual review", 10_000);
  if (resetScroll) await page.evaluate(() => {
    for (const element of document.querySelectorAll("*")) {
      if (element.scrollTop > 0 || element.scrollLeft > 0) {
        element.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
  if (resetScroll) await until(async () => page.evaluate(() => [...document.querySelectorAll("*")]
    .every((element) => element.scrollTop <= 1)), "app scroll containers reach the top before visual review", 5000);
  if (resetScroll && await page.getByRole("dialog").count() === 0) {
    const heading = await page.getByRole("heading", { level: 1 }).boundingBox();
    const workspace = await page.getByTestId("cashflow-workspace").boundingBox();
    assert(heading && workspace && heading.y >= workspace.y - 1 && heading.y + heading.height <= workspace.y + workspace.height,
      "The page title must be visible after the workspace scrolls to the top");
  }
  await page.screenshot({ path: join(artifacts, name), fullPage: true, animations: "disabled" });
}
async function verifyReportScrolling(name) {
  const workspace = page.getByTestId("cashflow-workspace");
  assert.equal(await workspace.evaluate((element) => getComputedStyle(element).overflowY), "auto");
  const bounds = await workspace.boundingBox();
  assert(bounds && bounds.height > 300, "The finance workspace needs its own visible scroll area");
  const chart = page.locator("#cashflow-expense-category-chart");
  const chartBounds = await chart.boundingBox();
  assert(chartBounds);
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, Math.max(100, chartBounds.y + chartBounds.height - bounds.y - bounds.height + 16));
  await until(async () => await workspace.evaluate((element) => element.scrollTop) > 0, "native wheel scrolls the finance workspace", 5000);
  await until(async () => {
    const visible = await chart.boundingBox();
    return visible && visible.y >= bounds.y - 1 && visible.y + visible.height <= bounds.y + bounds.height + 1;
  }, "native scrolling reaches the lower report category chart", 5000);
  assert(await workspace.evaluate((element) => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) if (parent.scrollTop > 1) return false;
    return true;
  }), "Report scrolling must stay inside the workspace, keeping the app shell fixed");
  await screenshot(name, false);
  await page.mouse.wheel(0, -100_000);
  await until(async () => await workspace.evaluate((element) => element.scrollTop) <= 1, "native wheel returns to the report title", 5000);
}
async function choose(id, name) {
  await click(page.locator(`#${id}`));
  await click(page.getByRole("option", { name, exact: true }));
}
async function navigate(section) {
  const routes = {
    entries: { path: "/finance/entries", label: labels.cashflow.entriesTitle },
    categories: { path: "/finance/categories", label: labels.cashflow.categoriesTitle },
    report: { path: "/report/income-expenses", label: labels.cashflow.reportTitle },
  };
  const route = routes[section];
  const link = page.getByRole("navigation", { name: labels.cashflow.navigation, exact: true })
    .getByRole("link", { name: route.label, exact: true });
  await click(link);
  await page.waitForURL((url) => url.pathname === route.path, { timeout: 120_000 });
  assert.equal(await link.getAttribute("aria-current"), "page");
}
async function reportFilters() {
  await click(page.getByRole("button", { name: labels.report.filters.openFilters, exact: true }));
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  return dialog;
}
async function applyReportFilters(dialog) {
  await click(dialog.getByRole("button", { name: labels.report.apply, exact: true }));
  await dialog.waitFor({ state: "hidden" });
}
async function summary(income, expense, balance) {
  for (const [kind, amount] of Object.entries({ income, expense, balance })) {
    const expected = `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount)} LAK`;
    await page.locator(`#cashflow-report-summary-${kind}`).filter({ hasText: expected }).waitFor({ timeout: 90_000 });
  }
}
async function addCategory(name, direction) {
  await click(page.getByRole("button", { name: labels.cashflow.addCategory, exact: true }));
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.locator("#cashflow-category-name").fill(name);
  await click(dialog.locator(`#cashflow-category-support-${direction}`));
  assert.equal(await dialog.locator(`#cashflow-category-support-${direction}`).getAttribute("aria-checked"), "true");
  if (name === "General operations") await screenshot("category-form-mobile.png");
  await click(dialog.getByRole("button", { name: labels.actions.save, exact: true }));
  await dialog.waitFor({ state: "hidden" });
  await page.getByText(name, { exact: true }).filter({ visible: true }).waitFor();
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

async function compactForm() {
  const dialog = page.getByRole("dialog");
  assert.equal(await dialog.count(), 1);
  assert.equal(await dialog.locator("input:not([type=hidden]), textarea, select").count(), 3,
    "The four-field form has date, amount, note, and category badge buttons");
  for (const control of ["description", "currency", "payment", "reference", "expense-group"]) {
    assert.equal(await dialog.locator(`#cashflow-form-${control}`).count(), 0, `${control} must not lengthen the compact form`);
  }
  for (const testId of ["cashflow-category-add", "cashflow-category-list", "cashflow-category-create"]) {
    assert.equal(await dialog.getByTestId(testId).count(), 0, "Entry forms select categories from the separate category page");
  }
  await dialog.locator("#cashflow-form-date").waitFor();
  await dialog.locator("#cashflow-form-amount").waitFor();
  await dialog.locator("#cashflow-form-note").waitFor();
  const bounds = await dialog.boundingBox();
  assert(bounds);
  for (const name of [labels.actions.cancel, labels.actions.save]) {
    const control = await dialog.getByRole("button", { name, exact: true }).boundingBox();
    assert(control && control.x >= bounds.x && control.x + control.width <= bounds.x + bounds.width,
      `${name} must stay inside the compact dialog without horizontal scrolling`);
  }
  return dialog;
}

async function addEntry(direction, note, amount) {
  await click(page.getByRole("button", { name: direction === "income" ? labels.cashflow.addIncome : labels.cashflow.addExpense, exact: true }));
  await page.getByRole("dialog").waitFor();
  const dialog = await compactForm();
  await dialog.getByRole("heading", { name: direction === "income" ? labels.cashflow.addIncome : labels.cashflow.addExpense, exact: true }).waitFor();
  for (const value of ["income", "expense"]) {
    assert.equal(await dialog.getByRole("button", { name: labels.cashflow.directions[value], exact: true }).count(), 0,
      "The create action determines the income or expense form");
  }
  await dialog.getByRole("button", { name: direction === "income" ? "Income-only category" : "Expense-only category", exact: true }).waitFor();
  assert.equal(await dialog.getByRole("button", { name: direction === "income" ? "Expense-only category" : "Income-only category", exact: true }).count(), 0,
    "Category choices must match the entry direction");
  await click(dialog.getByRole("button", { name: "General operations", exact: true }));
  await dialog.locator("#cashflow-form-date").fill(today);
  await dialog.locator("#cashflow-form-amount").fill(String(amount));
  await dialog.locator("#cashflow-form-note").fill(note);
  const box = await dialog.boundingBox();
  assert(box && box.height <= 740, "Compact entry dialog should fit the mobile portrait viewport");
  await screenshot(`${direction}-form-mobile.png`);
  if (direction === "income") await screenshot("entry-form-mobile.png");
  await click(dialog.getByRole("button", { name: labels.actions.save, exact: true }));
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.getByText(note, { exact: true }).filter({ visible: true }).waitFor();
}

try {
  await step("Start disposable PostgreSQL and local frontend", async () => {
    await mkdir(artifacts, { recursive: true });
    await writeFile(join(artifacts, "result.json"), JSON.stringify({ passed: false, status: "running", steps, browser_errors: errors }, null, 2));
    await startApi();
    await startFrontend();
    browser = await chromium.launch({ headless: true, executablePath: process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : chromium.executablePath() });
    page = await (await context()).newPage();
  });
  await step("Manage categories in their separate page and form", async () => {
    await page.goto(`${webOrigin}/finance/categories`, { timeout: 120_000 });
    await page.getByRole("button", { name: labels.cashflow.addCategory, exact: true }).waitFor({ timeout: 90_000 });
    await addCategory("General operations", "both");
    await addCategory("Income-only category", "income");
    await addCategory("Expense-only category", "expense");
    await addCategory("Temporary category", "both");
    await click(page.getByRole("button", { name: `${labels.actions.edit} Temporary category`, exact: true }).filter({ visible: true }));
    const dialog = page.getByRole("dialog");
    await dialog.locator("#cashflow-category-name").fill("Unused category");
    await click(dialog.getByRole("button", { name: labels.actions.save, exact: true }));
    await dialog.waitFor({ state: "hidden" });
    await page.getByText("Unused category", { exact: true }).filter({ visible: true }).waitFor();
    await click(page.getByRole("button", { name: `${labels.cashflow.archiveCategory} Unused category`, exact: true }).filter({ visible: true }));
    const confirmation = page.getByRole("alertdialog");
    await confirmation.waitFor();
    await click(confirmation.getByRole("button", { name: labels.cashflow.archive, exact: true }));
    await confirmation.waitFor({ state: "hidden" });
    await until(async () => (await database.query("SELECT is_active FROM tb_cashflow_category WHERE name='Unused category'")).rows[0]?.is_active === false,
      "unused category is archived, not erased");
    await until(async () => await page.getByText("Unused category", { exact: true }).filter({ visible: true }).count() === 0,
      "archived category leaves the active list");
    await screenshot("categories-mobile.png");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Mobile categories must not overflow");
    await page.setViewportSize({ width: 1460, height: 1000 });
    await page.getByText("General operations", { exact: true }).filter({ visible: true }).waitFor();
    await screenshot("categories-desktop.png");
    await page.setViewportSize({ width: 768, height: 1024 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Tablet categories must not overflow");
    assert(await page.getByRole("navigation", { name: labels.cashflow.navigation, exact: true }).evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
      "Tablet finance navigation must fit its container");
    await page.setViewportSize({ width: 1460, height: 1000 });
    await choose("cashflow-category-branch", "Branch B");
    await page.getByText(labels.cashflow.noCategories, { exact: true }).waitFor();
    assert.equal(await page.getByText("General operations", { exact: true }).filter({ visible: true }).count(), 0);
    const [branchEntries] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/cashflow/entries", { timeout: 120_000 }),
      navigate("entries"),
    ]);
    assert.equal(new URL(branchEntries.url()).searchParams.get("branch_uuid"), SIBLING, "Category navigation must retain the selected branch");
    assert.equal((await branchEntries.json()).pagination.total, 0);
    await page.getByText(labels.cashflow.noEntries, { exact: true }).waitFor();
    const [branchReport] = await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === "/api/v1/cashflow/report", { timeout: 120_000 }),
      navigate("report"),
    ]);
    assert.equal(new URL(branchReport.url()).searchParams.get("branch_uuid"), SIBLING, "Report navigation must retain the selected branch");
    assert.equal((await branchReport.json()).data.branch_uuid, SIBLING);
    await summary(0, 0, 0);
    await page.getByText(labels.cashflow.report.noActivity, { exact: true }).waitFor();
    await navigate("categories");
    await page.locator("#cashflow-category-branch").filter({ hasText: "Branch B" }).waitFor();
    await choose("cashflow-category-branch", "Branch A");
    await page.getByText("General operations", { exact: true }).filter({ visible: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    const category = (await database.query("SELECT direction FROM tb_cashflow_category WHERE name='General operations'")).rows[0];
    assert.equal(category.direction, "both");
    await navigate("entries");
    await page.locator("#cashflow-add-income").waitFor();
  });
  await step("Record income and expense in separate compact forms with compatible category badges", async () => {
    await addEntry("income", "Other income fixture", 200);
    await addEntry("expense", "Shop expense fixture", 30);
    await addEntry("expense", "Other expense fixture", 20);
    await screenshot("entries-mobile.png");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Mobile entries must not overflow");
    await page.setViewportSize({ width: 1460, height: 1000 });
    await page.getByText("Other income fixture", { exact: true }).filter({ visible: true }).waitFor();
    const headers = await page.getByRole("table").getByRole("columnheader").allTextContents();
    assert.deepEqual(headers.map((heading) => heading.trim()), [labels.cashflow.fields.date,
      labels.cashflow.fields.category, labels.cashflow.fields.amount, labels.cashflow.fields.note]);
    await screenshot("entries-desktop.png");
    await page.setViewportSize({ width: 390, height: 844 });
  });
  await step("Edit amount and note through the same compact form", async () => {
    await click(page.getByRole("button", { name: `${labels.actions.edit} Shop expense fixture`, exact: true }));
    let dialog = await compactForm();
    await dialog.locator("#cashflow-form-amount").fill("35");
    await dialog.locator("#cashflow-form-note").fill("Edited shop expense fixture");
    await page.setViewportSize({ width: 1460, height: 1000 });
    await compactForm();
    await screenshot("entry-form-desktop.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await compactForm();
    await click(dialog.getByRole("button", { name: labels.actions.save, exact: true }));
    await dialog.waitFor({ state: "hidden" });
    await page.getByText("Edited shop expense fixture", { exact: true }).filter({ visible: true }).waitFor();
    const saved = (await database.query("SELECT amount,note,version FROM tb_cashflow_entry WHERE note='Edited shop expense fixture'")).rows[0];
    assert.equal(Number(saved.amount), 35);
    assert.equal(saved.version, 2);
    await click(page.getByRole("button", { name: `${labels.actions.edit} Edited shop expense fixture`, exact: true }));
    dialog = await compactForm();
    await dialog.locator("#cashflow-form-amount").fill("30");
    await dialog.locator("#cashflow-form-note").fill("Shop expense fixture");
    await click(dialog.getByRole("button", { name: labels.actions.save, exact: true }));
    await dialog.waitFor({ state: "hidden" });
    await page.getByText("Shop expense fixture", { exact: true }).filter({ visible: true }).waitFor();
  });
  await step("Select category badges to display their records", async () => {
    const bar = page.getByTestId("cashflow-category-badges");
    const filtered = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/v1/cashflow/entries" && Boolean(url.searchParams.get("category_uuid_fk"));
    });
    await click(bar.getByRole("button", { name: "General operations", exact: true }));
    const result = await filtered.then((response) => response.json());
    assert.equal(result.pagination.total, 3);
    assert.equal(await bar.getByRole("button", { name: "General operations", exact: true }).getAttribute("aria-pressed"), "true");
    await click(bar.getByRole("button", { name: labels.common.all, exact: true }));
    await page.getByText("Other income fixture", { exact: true }).filter({ visible: true }).waitFor();
    const category = (await database.query("SELECT is_active FROM tb_cashflow_category WHERE name='General operations'")).rows[0];
    assert.equal(category.is_active, true);
    assert.equal((await database.query("SELECT COUNT(*)::int AS total FROM tb_cashflow_entry WHERE deleted_at IS NULL")).rows[0].total, 3);
  });
  await step("Switch income and expense list segments without mixing records", async () => {
    const group = page.getByRole("group", { name: labels.cashflow.directionLabel, exact: true });
    for (const [direction, count, note, absent] of [
      ["income", 1, "Other income fixture", "Shop expense fixture"],
      ["expense", 2, "Shop expense fixture", "Other income fixture"],
    ]) {
      const response = page.waitForResponse((result) => {
        const url = new URL(result.url());
        return url.pathname === "/api/v1/cashflow/entries" && url.searchParams.get("direction") === direction;
      });
      const control = group.getByRole("button", { name: labels.cashflow.directions[direction], exact: true });
      await click(control);
      assert.equal((await response.then((result) => result.json())).pagination.total, count);
      assert.equal(await control.getAttribute("aria-pressed"), "true");
      await page.getByText(note, { exact: true }).filter({ visible: true }).waitFor();
      assert.equal(await page.getByText(absent, { exact: true }).filter({ visible: true }).count(), 0);
    }
    await click(group.getByRole("button", { name: labels.common.all, exact: true }));
    await page.getByText("Other income fixture", { exact: true }).filter({ visible: true }).waitFor();
  });
  await step("Report actual sales minus change and later debt collections once", async () => {
    await navigate("report");
    await summary(1900, 50, 1850);
    const report = await fetch(`${apiOrigin}/api/v1/cashflow/report?branch_uuid=${BRANCH}&date_from=${today}&date_to=${today}`, { headers: { "x-access-token": "1" } }).then((response) => response.json());
    assert.deepEqual(report.data.summary, { sales_income: 1700, other_income: 200, income_total: 1900, shop_expense: 50, other_expense: 0, expense_total: 50, balance: 1850 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Mobile report must not overflow the page");
  });
  await step("Show category charts and filter records from each income or expense category", async () => {
    await page.locator("#cashflow-trend-chart svg.recharts-surface").waitFor();
    const category = (await database.query("SELECT category_uuid FROM tb_cashflow_category WHERE name='General operations'")).rows[0];
    assert.equal(Number(await page.locator('#cashflow-income-category-chart [data-report-category="sales"]').getAttribute("data-category-amount")), 1700);
    for (const [direction, amount] of [["income", 200], ["expense", 50]]) {
      const chart = page.locator(`#cashflow-${direction}-category-chart`);
      await chart.waitFor();
      const button = chart.locator(`[data-report-category="${category.category_uuid}"][data-report-direction="${direction}"]`);
      assert.equal(Number(await button.getAttribute("data-category-amount")), amount);
      const share = Number(await button.getAttribute("data-category-share"));
      assert(Math.abs(share - amount / (direction === "income" ? 1900 : 50) * 100) < 0.000001,
        "Category chart shares must match their income or expense totals");
      const filtered = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.pathname === "/api/v1/cashflow/report" && url.searchParams.get("category_uuid_fk") === category.category_uuid
          && url.searchParams.get("direction") === direction;
      });
      await click(button);
      const result = await filtered.then((response) => response.json());
      assert.equal(result.data.summary[`${direction}_total`], amount);
      await summary(direction === "income" ? 200 : 0, direction === "expense" ? 50 : 0, direction === "income" ? 200 : -50);
      await click(page.locator("#cashflow-report-clear-filters"));
      await summary(1900, 50, 1850);
    }
    await screenshot("report-mobile.png");
    await verifyReportScrolling("report-charts-mobile.png");
  });
  await step("Switch branch and source filters without mixing financial data", async () => {
    let dialog = await reportFilters();
    await choose("cashflow-report-mobile-source", labels.cashflow.sources.manual);
    await summary(200, 50, 150);
    await choose("cashflow-report-mobile-source", labels.cashflow.sources.all);
    await choose("cashflow-report-mobile-category", "General operations");
    await applyReportFilters(dialog);
    await summary(200, 50, 150);
    await click(page.locator("#cashflow-report-clear-filters"));
    await summary(1900, 50, 1850);
    await page.setViewportSize({ width: 1460, height: 1000 });
    dialog = await reportFilters();
    await choose("cashflow-report-mobile-branch", "Branch B");
    await applyReportFilters(dialog);
    await page.getByText(labels.cashflow.report.noActivity, { exact: true }).waitFor();
    await summary(0, 0, 0);
    dialog = await reportFilters();
    await choose("cashflow-report-mobile-branch", "Branch A");
    await choose("cashflow-report-mobile-source", labels.cashflow.sources.sales);
    await applyReportFilters(dialog);
    await summary(1700, 0, 1700);
    dialog = await reportFilters();
    await choose("cashflow-report-mobile-source", labels.cashflow.sources.all);
    await applyReportFilters(dialog);
    await summary(1900, 50, 1850);
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
    await screenshot("report-desktop.png");
    await verifyReportScrolling("report-charts-desktop.png");
  });
  await step("Branch administrators remain locked to their own branch", async () => {
    const restricted = await (await context(3)).newPage();
    await restricted.goto(`${webOrigin}/finance/entries`, { timeout: 120_000 });
    await restricted.locator("#cashflow-add-income").waitFor({ timeout: 90_000 });
    await click(restricted.getByRole("button", { name: labels.report.filters.openFilters, exact: true }));
    await restricted.getByRole("dialog").waitFor();
    assert.equal(await restricted.locator("#cashflow-entry-branch").count(), 0, "Restricted roles are not offered a branch switch");
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
  await writeFile(join(artifacts, "result.json"), JSON.stringify({ passed: false, steps, browser_errors: errors, error: String(error) }, null, 2)).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (nextProcess && nextProcess.exitCode === null) { nextProcess.kill("SIGTERM"); await new Promise((done) => nextProcess.once("exit", done)); }
  if (apiServer) await new Promise((done) => apiServer.close(done));
  await database?.close();
}
