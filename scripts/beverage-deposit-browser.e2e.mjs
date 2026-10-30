import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

// The production dialog runs against a loopback-only ledger and printer ACK
// fixture. No application API, database, physical printer, or real user is used.
const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireBackend = createRequire(resolve(frontend, "../back-end/package.json"));
const express = requireBackend("express");
const artifacts = process.env.DEPOSIT_E2E_ARTIFACTS || resolve(frontend, "../.work/beverage-deposit-ui-revision-20261030");
const project = join(artifacts, "frontend-workspace");
const apiPort = Number(process.env.DEPOSIT_E2E_API_PORT || 3140);
const webPort = Number(process.env.DEPOSIT_E2E_WEB_PORT || 3141);
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
const routePath = "/beverage-deposit-qa";
const id = (number) => `87000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const ids = { store: id(1), branch: id(2), login: id(3), customer: id(4), order: id(5), detail: id(10), variant: id(11), originalDeposit: id(20) };
const token = "beverage-deposit-isolated-fixture-token";
const customer = { customer_uuid: ids.customer, customer_name: "ສົມພອນ ວົງສີ", customer_phone: "020 5555 0188", store_uuid_fk: ids.store };
const dates = { deposit: "2026-10-30T06:00:00.000Z", expiry: "2026-11-06" };
const depositNote = "ຝາກຂວດເປີດແລ້ວ · QA 0.75";
const withdrawNote = "ຮັບຄືນ 0.5 ຂວດ · QA";
const requests = [], blockedExternal = [], pageErrors = [], steps = [];
let ledger, withdrawals, printEnabled, sequence, server, next, browser, nextOutput = "";

function resetLedger() {
  sequence = 100;
  printEnabled = false;
  withdrawals = [];
  ledger = [{
    deposit_uuid: ids.originalDeposit, deposit_no: "DP-261030-0042", request_uuid: id(21),
    branch_uuid_fk: ids.branch, customer_uuid_fk: ids.customer, customer_name: customer.customer_name,
    customer_phone: customer.customer_phone, pro_detail_uuid_fk: id(12), order_uuid_fk: id(30),
    product_name: "Hennessy VSOP (700 ml)", product_code: "DR-002", prod_code: "DR-002", size_name: "700 ml", unit_name: "ຂວດ",
    deposit_qty: 2, remaining_qty: 1.5, deposit_date: dates.deposit, expire_date: dates.expiry,
    status: "ACTIVE", status_text: "Active", is_expired: false, note: "ເຫຼືອ 3/4 ຂວດ",
    created_by: ids.login, created_at: dates.deposit, updated_at: dates.deposit,
  }];
}

function printResponse() {
  if (!printEnabled) return {
    print_status: "skipped", print_job: null, pending_query: null,
    print: { role_code: "deposit", document_type: "report", printer: null,
      reason_code: "DEPOSIT_PRINTER_NOT_CONFIGURED", reason: "No active printer configured for the deposit role" },
  };
  const job = id(++sequence);
  return {
    print_status: "queued",
    print_job: { print_job_uuid: job, requested_total: 1, job_status: "pending", device_code: "DESKTOP-QA", agent_id: "fixture-agent", print_mode: "windows_agent" },
    pending_query: { print_job_uuid: job, login_uuid_fk: ids.login, device_code: "DESKTOP-QA", agent_id: "fixture-agent", print_mode: "windows_agent" },
    print: { role_code: "deposit", document_type: "report", printer: { print_config_uuid: id(40), printer_name: "ໃບຝາກ · ເຄົາເຕີ", device_code: "DESKTOP-QA" }, reason: null },
  };
}

async function startFixtureApi() {
  resetLedger();
  const app = express();
  app.use((req, res, done) => {
    res.set({ "Access-Control-Allow-Origin": webOrigin, "Access-Control-Allow-Headers": "authorization,content-type,x-access-token,x-agent-secret", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" });
    if (req.method === "OPTIONS") return res.sendStatus(204);
    done();
  });
  app.use(express.json());
  app.use((req, _res, done) => { requests.push({ method: req.method, path: req.path, query: req.query, body: req.body }); done(); });
  app.post("/fixture/reset", (_req, res) => { resetLedger(); res.json({ ok: true }); });
  app.post("/fixture/enable-printer", (_req, res) => { printEnabled = true; res.json({ ok: true }); });
  app.get("/agent/info", (_req, res) => res.json({ ok: true, agent: {
    agent_id: "fixture-agent", agent_name: "Fixture printer", device_code: "DESKTOP-QA", platform: "win32", agent_url: apiOrigin,
  } }));
  app.use("/api", (req, res, done) => req.headers["x-access-token"] === token
    ? done() : res.status(401).json({ status: "error", message: "Only the isolated fixture identity is accepted" }));
  app.get("/api/v1/customer/list", (_req, res) => res.json({ status: "success", data: [customer], total: 1, page: 1, limit: 30, totalPages: 1 }));
  app.get("/api/v1/posAll/deposit/list", (req, res) => {
    let rows = ledger.filter((row) => row.branch_uuid_fk === req.query.branch_uuid);
    if (req.query.customer_uuid) rows = rows.filter((row) => row.customer_uuid_fk === req.query.customer_uuid);
    if (req.query.order_uuid) rows = rows.filter((row) => row.order_uuid_fk === req.query.order_uuid);
    if (req.query.status === "active") rows = rows.filter((row) => row.status === "ACTIVE");
    res.json({ status: "success", message: "success", lang: "la", data: rows, total: rows.length, totalPages: 1, page: 1, limit: 100 });
  });
  app.post("/api/v1/posAll/deposit/create", (req, res) => {
    const body = req.body;
    assert.equal(body.branch_uuid, ids.branch);
    assert.equal(body.customer_uuid, ids.customer);
    assert.equal(body.order_uuid, ids.order);
    assert.match(body.request_uuid, /^[0-9a-f-]{36}$/);
    assert.equal(body.device_code, "DESKTOP-QA");
    assert.equal(body.note, depositNote);
    assert(body.items.every((item) => [ids.detail, ids.variant].includes(item.pro_detail_uuid)));
    const existing = ledger.filter((row) => row.request_uuid === body.request_uuid);
    const deposits = existing.length ? existing : body.items.map((item) => ({
      ...ledger[0], deposit_uuid: id(++sequence), deposit_no: `DP-261030-${String(sequence).padStart(4, "0")}`,
      request_uuid: body.request_uuid, pro_detail_uuid_fk: item.pro_detail_uuid, order_uuid_fk: ids.order,
      product_name: item.pro_detail_uuid === ids.detail ? "Johnnie Walker Black Label (700 ml)" : "Johnnie Walker Black Label (1 L)",
      product_code: "DR-001", prod_code: "DR-001", size_name: item.pro_detail_uuid === ids.detail ? "700 ml" : "1 L",
      deposit_qty: item.deposit_qty, remaining_qty: item.deposit_qty, note: body.note || "",
    }));
    if (!existing.length) ledger.push(...deposits);
    res.json({ status: "success", message: "success", lang: "la", request_uuid: body.request_uuid,
      idempotent_replay: existing.length > 0, deposit_date: "2026-10-30", expire_date: dates.expiry, deposits, ...printResponse() });
  });
  app.post("/api/v1/posAll/deposit/withdraw", (req, res) => {
    const body = req.body;
    assert.equal(body.deposit_uuid, ids.originalDeposit);
    assert.equal(body.order_uuid, ids.order);
    assert.match(body.request_uuid, /^[0-9a-f-]{36}$/);
    assert.equal(body.device_code, "DESKTOP-QA");
    assert.equal(body.note, withdrawNote);
    const deposit = ledger.find((row) => row.deposit_uuid === body.deposit_uuid);
    const existing = withdrawals.find((row) => row.request_uuid === body.request_uuid);
    if (existing) return res.json({ status: "success", message: "success", lang: "la", idempotent_replay: true, deposit, withdrawal: existing, ...printResponse() });
    assert(body.qty_withdrawn > 0 && body.qty_withdrawn <= deposit.remaining_qty);
    const withdrawal = {
      withdrawal_uuid: id(++sequence), request_uuid: body.request_uuid, deposit_uuid_fk: deposit.deposit_uuid,
      order_uuid_fk: body.order_uuid, qty_withdrawn: body.qty_withdrawn, qty_before: deposit.remaining_qty,
      qty_after: Math.round((deposit.remaining_qty - body.qty_withdrawn) * 1000) / 1000,
      withdrawn_by: ids.login, withdrawn_at: "2026-10-30T06:15:00.000Z", note: body.note || "",
    };
    deposit.remaining_qty = withdrawal.qty_after;
    if (!deposit.remaining_qty) deposit.status = "WITHDRAWN";
    withdrawals.push(withdrawal);
    res.json({ status: "success", message: "success", lang: "la", idempotent_replay: false,
      request_uuid: body.request_uuid, deposit: { ...deposit }, withdrawal, ...printResponse() });
  });
  app.post("/api/v1/posAll/deposit/reprint", (req, res) => {
    const body = req.body;
    assert.equal(body.kind, "deposit");
    const deposits = ledger.filter((row) => row.request_uuid === body.deposit_request_uuid);
    assert(deposits.length > 0);
    assert.notEqual(body.request_uuid, body.deposit_request_uuid);
    res.json({ status: "success", message: "success", request_uuid: deposits[0].request_uuid, deposits, ...printResponse() });
  });
  app.get("/api/v1/printer/jobs/pending", (_req, res) => res.json({ status: "success", data: [], print_batch_payloads: [],
    print_summary: { requested_job_status: "success", requested_job_total: 1, requested_job_success_total: 1, requested_job_failed_total: 0 } }));
  app.get("/api/v1/printer/fetch", (_req, res) => res.json({ status: "success", data: [{
    print_config_uuid: id(40), device_code: "DESKTOP-QA", agent_id: "fixture-agent", print_mode: "windows_agent", is_active: true,
  }] }));
  app.get("*", (_req, res) => res.json({ status: "success", data: [] }));
  app.use((req, res) => res.status(405).json({ status: "error", message: `Unexpected mutation forbidden in fixture: ${req.path}` }));
  server = await new Promise((done, fail) => { const active = app.listen(apiPort, "127.0.0.1", () => done(active)); active.once("error", fail); });
}

async function waitFor(test, label, timeout = 45_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await test()) return; await delay(100); }
  throw new Error(`Timed out: ${label}`);
}

async function syncDirectory(source, target) {
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.name === ".env" || entry.name.startsWith(".env.")) continue;
    const from = join(source, entry.name), to = join(target, entry.name);
    if (entry.isDirectory()) await syncDirectory(from, to);
    else if (entry.isFile()) {
      const contents = await readFile(from);
      if (!existsSync(to) || !contents.equals(await readFile(to))) await writeFile(to, contents);
    }
  }
}

async function prepareFrontend() {
  await mkdir(project, { recursive: true });
  for (const name of ["package.json", "next.config.ts", "tsconfig.json", "next-env.d.ts", "postcss.config.mjs"]) {
    if (!existsSync(join(frontend, name))) continue;
    const contents = await readFile(join(frontend, name)), target = join(project, name);
    if (!existsSync(target) || !contents.equals(await readFile(target))) await writeFile(target, contents);
  }
  await syncDirectory(join(frontend, "src"), join(project, "src"));
  for (const name of ["public", "node_modules", "assets", "scripts"]) {
    if (existsSync(join(frontend, name)) && !existsSync(join(project, name))) await symlink(join(frontend, name), join(project, name), "dir");
  }
  const qa = join(project, "src/app", routePath.slice(1));
  await mkdir(qa, { recursive: true });
  const user = { uuid: ids.login, email: "fixture@example.test", name: "Cashier QA", status: 3, profile: "", branch_uuid: ids.branch,
    branch_name: "ສາຂາທົດສອບ", branch_tel: "020 5555 0100", branch_address: "Vientiane", store_uuid: ids.store,
    store_name: "Yummy Go", store_logo: "", store_status: 2, store_table_status: 1, deposit_expire_days: 7 };
  const items = [
    { pro_detail_uuid: ids.detail, prod_code: "DR-001", pro_detail_stock: 1, prod_name: "Johnnie Walker Black Label", unit_name: "ຂວດ", detail: { order_it_status: 2, order_it_qty: 2, size_name: "700 ml" } },
    { pro_detail_uuid: ids.variant, prod_code: "DR-001", pro_detail_stock: 1, prod_name: "Johnnie Walker Black Label", unit_name: "ຂວດ", detail: { order_it_status: 2, order_it_qty: 1, size_name: "1 L" } },
  ];
  await writeFile(join(qa, "page.tsx"), `"use client";
import { useEffect, useState } from "react";
import { DepositDialog, type DepositDialogTab } from "@/features/sales/deposit/deposit-dialog";
import { useAuthStore } from "@/stores/auth-store";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import type { CartItem } from "@/services/pos";
const fixtureUser = ${JSON.stringify(user)};
const items: CartItem[] = ${JSON.stringify(items)};
export default function BeverageDepositQa() {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<DepositDialogTab>("create");
  useEffect(() => {
    useAuthStore.setState({ token: ${JSON.stringify(token)}, user: fixtureUser, isLoggedIn: true, rememberMe: false });
    setReady(true);
  }, []);
  function show(value: DepositDialogTab) { setTab(value); setOpen(true); }
  return <main className="min-h-dvh bg-muted/30 p-6 font-lao">
    <div className="mx-auto max-w-5xl"><div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4"><div><p className="text-xs text-muted-foreground">YUMMY GO / POS</p><h1 className="mt-1 text-xl font-semibold">ໂຕະ T11</h1></div><span className="text-sm text-muted-foreground">ພະນັກງານ · Cashier QA</span></div>
      <div className="mt-6 flex flex-wrap gap-3"><Button disabled={!ready} onClick={() => show("create")}>Open deposit</Button><Button disabled={!ready} variant="outline" onClick={() => show("withdraw")}>Open withdrawal</Button><Button variant="ghost" onClick={() => useAppStore.getState().setTheme(useAppStore.getState().theme === "dark" ? "light" : "dark")}>Toggle theme</Button></div>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">{items.map((item) => <div key={String(item.pro_detail_uuid)} className="rounded-lg border bg-card p-5"><div className="mb-4 h-28 rounded-md bg-muted" /><p className="text-sm font-medium">{String(item.prod_name)}</p><p className="mt-2 text-xs text-muted-foreground">DR-001 · {String(item.detail?.size_name)}</p></div>)}</div>
    </div>
    <DepositDialog branchUuid=${JSON.stringify(ids.branch)} orderUuid=${JSON.stringify(ids.order)} orderInvoice="INV-261030-0011" tableName="T11" orderItems={items} open={open} defaultTab={tab} onOpenChange={setOpen} />
  </main>;
}
`);
}

async function startFrontend() {
  next = spawn(process.execPath, [join(frontend, "node_modules/next/dist/bin/next"), "dev", project, "--webpack", "--hostname", "127.0.0.1", "--port", String(webPort)], {
    cwd: project, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_BASE_URL: apiOrigin, NEXT_PUBLIC_API_URL: apiOrigin,
      NEXT_PUBLIC_SOCKET_URL: apiOrigin, NEXT_PUBLIC_PRINTER_AGENT_URL: apiOrigin, NEXT_PUBLIC_PRINTER_AGENT_SECRET: "" }, stdio: ["ignore", "pipe", "pipe"],
  });
  const capture = (chunk) => { nextOutput = (nextOutput + chunk).slice(-30_000); };
  next.stdout.on("data", capture); next.stderr.on("data", capture);
  await waitFor(async () => {
    if (next.exitCode !== null) throw new Error(nextOutput);
    try { return (await fetch(`${webOrigin}/app-version.json`)).status === 200; } catch { return false; }
  }, "isolated frontend readiness", 120_000);
  console.log("WARM beverage deposit fixture");
  const warm = await fetch(webOrigin + routePath, { signal: AbortSignal.timeout(180_000) });
  assert.equal(warm.status, 200, nextOutput);
}

async function step(name, work) {
  console.log(`RUN ${name}`); const started = Date.now();
  await work(); steps.push({ name, passed: true, durationMs: Date.now() - started }); console.log(`PASS ${name}`);
}

async function runViewport(viewport, language = "la") {
  await fetch(`${apiOrigin}/fixture/reset`, { method: "POST" });
  const copy = JSON.parse(await readFile(join(frontend, "public/locales", language, "common.json"), "utf8"));
  const t = (key) => {
    const value = key.split(".").reduce((parent, part) => parent?.[part], copy);
    assert.equal(typeof value, "string", `Translation required for UI regression: ${key}`);
    return value;
  };
  const context = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if ([webOrigin, apiOrigin].includes(url.origin) || ["data:", "blob:"].includes(url.protocol)) return route.continue();
    blockedExternal.push(url.origin + url.pathname); return route.abort("blockedbyclient");
  });
  await context.routeWebSocket("**/*", (socket) => {
    if (new URL(socket.url()).origin === webOrigin.replace("http:", "ws:")) socket.connectToServer(); else socket.close();
  });
  await context.addCookies([{ name: "yummy-go-language", value: language, url: webOrigin }]);
  await context.addInitScript(({ origin, language }) => {
    if (location.origin !== origin) return;
    localStorage.setItem("yummy-go-app", JSON.stringify({ state: { language, theme: "light", themeColor: "emerald", fontScale: "md", decorBackground: false, laoFont: "noto-sans" }, version: 1 }));
    localStorage.setItem("i18nextLng", language);
  }, { origin: webOrigin, language });
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const prefix = `${viewport.width}-${language}`;
  const screenshot = async (name, activeDialog) => {
    const dialog = activeDialog || page.getByRole("dialog", { name: t("deposit.dialogTitle"), exact: true });
    await dialog.evaluate(async (element) => {
      await document.fonts.ready;
      await Promise.all(element.getAnimations().filter((animation) =>
        animation.effect?.getComputedTiming().iterations !== Infinity
      ).map((animation) => animation.finished.catch(() => undefined)));
    });
    await waitFor(async () => await page.locator("[data-sonner-toast]").count() === 0,
      "transient notifications to finish before visual capture", 15_000);
    assert.equal(await dialog.evaluate((element) => getComputedStyle(element).opacity), "1", "Capture only a fully opaque dialog");
    const box = await dialog.boundingBox();
    assert(box && box.x >= -1 && box.y >= -1 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1, `Dialog must fit ${prefix}: ${JSON.stringify(box)}`);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), "No page horizontal overflow");
    await page.screenshot({ path: join(artifacts, `${prefix}-${name}.png`), fullPage: false, animations: "disabled" });
  };
  const chooseCustomer = async () => {
    await page.getByRole("combobox", { name: t("deposit.customer"), exact: true }).click();
    await page.getByRole("option", { name: new RegExp(customer.customer_name) }).click();
  };
  const count = (path) => requests.filter((request) => request.method === "POST" && request.path === path).length;
  const before = { create: count("/api/v1/posAll/deposit/create"), withdraw: count("/api/v1/posAll/deposit/withdraw"), reprint: count("/api/v1/posAll/deposit/reprint") };
  try {
    await page.goto(webOrigin + routePath, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.getByRole("button", { name: "Open deposit", exact: true }).click();
    await page.getByText("Johnnie Walker Black Label (700 ml)", { exact: true }).waitFor();
    await step(`${prefix}: quantities start empty and require a customer`, async () => {
      const inputs = page.getByRole("spinbutton");
      assert.equal(await inputs.count(), 2, "Both bill variants expose their own quantity");
      for (const input of await inputs.all()) {
        assert.equal(await input.inputValue(), "", "Opening a deposit never assumes all ordered drinks were received");
        assert.equal(await input.isEnabled(), false, "Select a customer before entering received quantities");
      }
      assert.equal(await page.getByRole("button", { name: t("deposit.reviewDeposit"), exact: true }).isEnabled(), false);
      assert.equal(await page.getByRole("checkbox").count(), 0, "Quantity entry replaces ambiguous item selection checkboxes");
      await page.getByText("INV-261030-0011", { exact: true }).waitFor();
      await screenshot("deposit-empty");
    });
    await step(`${prefix}: shared customer remains selected when switching deposit and collection`, async () => {
      await chooseCustomer();
      await page.getByRole("tab", { name: t("deposit.withdrawTitle"), exact: true }).click();
      await page.getByText("Hennessy VSOP (700 ml)", { exact: true }).waitFor();
      assert((await page.getByRole("combobox", { name: t("deposit.customer"), exact: true }).innerText()).includes(customer.customer_name));
      assert.equal(await page.getByRole("button", { name: t("deposit.reviewCollection"), exact: true }).isEnabled(), false);
      await screenshot("withdraw-shared-customer");
      await page.getByRole("tab", { name: t("deposit.createTitle"), exact: true }).click();
      await page.getByText("Johnnie Walker Black Label (700 ml)", { exact: true }).waitFor();
      assert((await page.getByRole("combobox", { name: t("deposit.customer"), exact: true }).innerText()).includes(customer.customer_name));
      for (const input of await page.getByRole("spinbutton").all()) {
        assert.equal(await input.inputValue(), "");
        assert.equal(await input.isEnabled(), true);
      }
    });
    await step(`${prefix}: enter actual fractional quantity, clear or zero it, then review SKU and variant`, async () => {
      const search = page.getByRole("searchbox", { name: t("deposit.searchBillItems"), exact: true });
      await search.fill("NO-SUCH-SKU");
      assert.equal(await page.getByRole("spinbutton").count(), 0);
      await search.fill("DR-001");
      await page.getByText("Johnnie Walker Black Label (700 ml)", { exact: true }).waitFor();
      assert.equal(await page.getByRole("spinbutton").count(), 2, "One master SKU can have two distinct size/variant UUIDs");
      const input = page.getByRole("spinbutton", { name: t("deposit.receivedQuantity") + " Johnnie Walker Black Label (700 ml)", exact: true });
      const review = page.getByRole("button", { name: t("deposit.reviewDeposit"), exact: true });
      await input.fill("0.75");
      assert.equal(await review.isEnabled(), true);
      await input.fill("0");
      assert.equal(await review.isEnabled(), false, "Zero quantity removes the item from this deposit");
      await input.fill("");
      assert.equal(await review.isEnabled(), false, "Cleared quantity never means the bill's maximum quantity");
      await input.fill("0.75");
      await search.fill("NO-SUCH-SKU");
      assert.equal(await review.isEnabled(), true, "Filtering the ledger must retain quantities already entered for another SKU");
      await search.fill("DR-001");
      assert.equal(await input.inputValue(), "0.75");
      await page.locator("#pos-deposit-note").fill(depositNote);
      await search.scrollIntoViewIfNeeded();
      await screenshot("deposit-selected");
      await review.click();
      const confirmation = page.getByRole("alertdialog");
      await confirmation.getByText("DR-001", { exact: true }).waitFor();
      const text = await confirmation.innerText();
      for (const expected of [customer.customer_name, customer.customer_phone, "Johnnie Walker Black Label (700 ml)", "0.75", depositNote]) {
        assert(text.includes(expected), `Deposit review must show ${expected}`);
      }
      assert.equal(count("/api/v1/posAll/deposit/create") - before.create, 0, "Reviewing does not save before explicit confirmation");
      await screenshot("deposit-confirm", confirmation);
      await confirmation.getByRole("button", { name: t("deposit.confirmAndPrint"), exact: true }).click();
      await page.getByText(t("deposit.receiptSavedPrintNeeded"), { exact: true }).waitFor();
      await screenshot("deposit-saved-printer-needed");
      const writes = requests.filter((request) => request.method === "POST" && request.path === "/api/v1/posAll/deposit/create").slice(before.create);
      assert.equal(writes.length, 1);
      assert.deepEqual(writes[0].body.items, [{ pro_detail_uuid: ids.detail, deposit_qty: 0.75 }]);
      assert.equal(ledger.filter((row) => row.order_uuid_fk === ids.order).length, 1);
    });
    await step(`${prefix}: retry only the receipt after printer role is configured`, async () => {
      await fetch(`${apiOrigin}/fixture/enable-printer`, { method: "POST" });
      await page.getByRole("button", { name: t("deposit.reprintReceipt"), exact: true }).click();
      await page.getByText(t("deposit.receiptPrinted"), { exact: true }).waitFor();
      await screenshot("deposit-receipt-printed");
      assert.equal(count("/api/v1/posAll/deposit/create") - before.create, 1, "Retry must not create a second deposit");
      assert.equal(count("/api/v1/posAll/deposit/reprint") - before.reprint, 1);
      assert.equal(ledger.find((row) => row.pro_detail_uuid_fk === ids.detail).deposit_qty, 0.75);
      await page.getByRole("button", { name: t("deposit.done"), exact: true }).click();
    });
    await step(`${prefix}: choose a saved SKU and enter collection quantity explicitly`, async () => {
      await page.getByRole("button", { name: "Open withdrawal", exact: true }).click();
      assert.equal(await page.getByRole("button", { name: t("deposit.reviewCollection"), exact: true }).isEnabled(), false);
      await chooseCustomer();
      const search = page.getByRole("searchbox", { name: t("deposit.withdrawSearchPlaceholder"), exact: true });
      await search.fill("DR-002");
      await page.getByText("Hennessy VSOP (700 ml)", { exact: true }).waitFor();
      assert.equal(await page.getByRole("radio").count(), 1);
      await page.getByRole("radio").check();
      const input = page.getByRole("spinbutton", { name: t("deposit.actualCollectQty"), exact: true });
      const review = page.getByRole("button", { name: t("deposit.reviewCollection"), exact: true });
      assert.equal(await input.inputValue(), "", "Selecting a deposit must not assume one unit or the whole remaining bottle");
      assert.equal(await review.isEnabled(), false);
      await page.getByRole("button", { name: t("deposit.collectAll"), exact: true }).click();
      assert.equal(await input.inputValue(), "1.5", "Collect all is a deliberate shortcut, never an automatic default");
      await input.fill("0");
      assert.equal(await review.isEnabled(), false);
      await input.fill("0.5");
      const note = page.getByRole("textbox", { name: t("deposit.note"), exact: false });
      await note.fill(withdrawNote);
      await note.scrollIntoViewIfNeeded();
      const noteBox = await note.boundingBox();
      const footerBox = await page.getByRole("dialog", { name: t("deposit.dialogTitle"), exact: true })
        .locator('[data-slot="dialog-footer"]').boundingBox();
      assert(noteBox && footerBox && noteBox.y + noteBox.height <= footerBox.y + 1,
        "The collection note must scroll fully above the fixed review controls");
      await screenshot("withdraw-selected");
      await review.click();
      const confirmation = page.getByRole("alertdialog");
      await confirmation.getByText("1.5 ຂວດ", { exact: true }).waitFor();
      await confirmation.getByText("0.5 ຂວດ", { exact: true }).waitFor();
      await confirmation.getByText("1 ຂວດ", { exact: true }).waitFor();
      const text = await confirmation.innerText();
      for (const expected of [customer.customer_name, customer.customer_phone, "DR-002", "Hennessy VSOP (700 ml)", withdrawNote]) {
        assert(text.includes(expected), `Collection review must show ${expected}`);
      }
      assert.equal(count("/api/v1/posAll/deposit/withdraw") - before.withdraw, 0, "Reviewing never withdraws before explicit confirmation");
      await screenshot("withdraw-confirm", confirmation);
      await confirmation.getByRole("button", { name: t("deposit.confirmAndPrint"), exact: true }).click();
      await page.getByText(t("deposit.receiptPrinted"), { exact: true }).waitFor();
      await screenshot("withdraw-receipt");
      assert.equal(count("/api/v1/posAll/deposit/withdraw") - before.withdraw, 1);
      assert.equal(ledger.find((row) => row.deposit_uuid === ids.originalDeposit).remaining_qty, 1);
      assert.equal(withdrawals[0].qty_before, 1.5);
      assert.equal(withdrawals[0].qty_after, 1);
      assert.equal(count("/api/v1/posAll/deposit/create") - before.create, 1);
      await page.getByRole("button", { name: t("deposit.done"), exact: true }).click();
    });
    if (viewport.width >= 1000) await step(`${prefix}: dark theme dialog layout`, async () => {
      await page.getByRole("button", { name: "Toggle theme", exact: true }).click();
      await page.getByRole("button", { name: "Open deposit", exact: true }).click();
      await page.getByText("Johnnie Walker Black Label (700 ml)", { exact: true }).waitFor();
      await screenshot("deposit-dark");
      const contrast = await page.getByText("Johnnie Walker Black Label (700 ml)", { exact: true }).evaluateAll((buttons) => {
        const canvas = document.createElement("canvas");
        canvas.width = 1; canvas.height = 1;
        const drawing = canvas.getContext("2d");
        const rgb = (color) => {
          drawing.clearRect(0, 0, 1, 1); drawing.fillStyle = color; drawing.fillRect(0, 0, 1, 1);
          return [...drawing.getImageData(0, 0, 1, 1).data];
        };
        const luminance = (color) => color.slice(0, 3).map((channel) => {
          const value = channel / 255;
          return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        }).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
        return buttons.map((button) => {
          const foreground = rgb(getComputedStyle(button).color);
          let ancestor = button, background = [0, 0, 0, 255];
          while (ancestor) {
            const candidate = rgb(getComputedStyle(ancestor).backgroundColor);
            if (candidate[3] === 255) { background = candidate; break; }
            ancestor = ancestor.parentElement;
          }
          const light = luminance(foreground), dark = luminance(background);
          return { label: button.textContent.trim(), foreground, background,
            ratio: (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05) };
        });
      });
      assert(contrast.length > 0 && contrast.every((measurement) => measurement.ratio >= 4.5),
        `Dark product labels must meet text contrast: ${JSON.stringify(contrast)}`);
      await writeFile(join(artifacts, "dark-product-contrast.json"), JSON.stringify(contrast, null, 2));
    });
  } catch (error) {
    await page.screenshot({ path: join(artifacts, `${prefix}-failure.png`), fullPage: true }).catch(() => {});
    await writeFile(join(artifacts, `${prefix}-failure-dom.txt`), await page.locator("body").innerText().catch(() => ""));
    throw error;
  } finally { await context.close(); }
}

let failure;
try {
  await mkdir(artifacts, { recursive: true });
  await prepareFrontend();
  if (process.argv.includes("--prepare-only")) console.log(JSON.stringify({ prepared: true, project, databaseCalls: 0, networkCalls: 0 }));
  else {
    await startFixtureApi();
    await startFrontend();
    const executablePath = process.env.DEPOSIT_E2E_CHROME_PATH ||
      (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : chromium.executablePath());
    browser = await chromium.launch({ executablePath, headless: true,
      args: ["--disable-background-networking", "--disable-component-update", "--no-first-run", "--disable-sync"] });
    await runViewport({ width: 390, height: 844 });
    await runViewport({ width: 1280, height: 900 });
    assert.equal(pageErrors.length, 0, pageErrors.join("\n"));
    const forbidden = requests.filter((request) => request.method === "POST" && /(?:payment|stock|confirm_to_kitchen|print-ops)/.test(request.path));
    assert.equal(forbidden.length, 0, "Fixture must never call payment, stock, kitchen, or physical print writes");
  }
} catch (error) { failure = error; console.error(error.stack || error); process.exitCode = 1; }
finally {
  if (browser) await browser.close();
  if (next && next.exitCode === null) { next.kill("SIGTERM"); await Promise.race([new Promise((done) => next.once("exit", done)), delay(5000)]); if (next.exitCode === null) next.kill("SIGKILL"); }
  if (server) { server.closeAllConnections(); await new Promise((done) => server.close(done)); }
  await mkdir(artifacts, { recursive: true });
  await writeFile(join(artifacts, "browser-qa.json"), JSON.stringify({
    checkedAt: new Date().toISOString(), passed: !failure, preparedOnly: process.argv.includes("--prepare-only"),
    isolatedFrontend: project, apiOrigin, webOrigin, steps, pageErrors, blockedExternalRequests: blockedExternal,
    businessMutationCounts: {
      create: requests.filter((request) => request.path === "/api/v1/posAll/deposit/create" && request.method === "POST").length,
      withdraw: requests.filter((request) => request.path === "/api/v1/posAll/deposit/withdraw" && request.method === "POST").length,
      reprint: requests.filter((request) => request.path === "/api/v1/posAll/deposit/reprint" && request.method === "POST").length,
    },
    physicalPrinterBytes: 0, productionDatabaseCalls: 0, printingVerification: "Mocked durable queue ACKs only; no physical printer used",
    error: failure?.message || null,
  }, null, 2));
  await writeFile(join(artifacts, "browser-next.log"), nextOutput);
}
