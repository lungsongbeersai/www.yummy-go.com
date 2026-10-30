import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import vm from "node:vm";
import { chromium } from "playwright";

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = resolve(frontend, "../back-end");
const fromBackend = createRequire(join(backend, "package.json"));
const express = fromBackend("express");
const { PGlite } = fromBackend("@electric-sql/pglite");
const { findSession, sessionRejection } = fromBackend("./utils/authSession.js");
const artifacts = process.env.CONTRACT_E2E_ARTIFACTS || resolve(frontend, "../.work/contract-expiry");
const apiPort = Number(process.env.CONTRACT_E2E_API_PORT || 3110);
const webPort = Number(process.env.CONTRACT_E2E_WEB_PORT || 3111);
const apiOrigin = `http://127.0.0.1:${apiPort}`, webOrigin = `http://127.0.0.1:${webPort}`;
const id = n => `81000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const store = id(1), branchA = id(2), branchB = id(3), loginA = id(4), loginB = id(5);
const fixturePassword = "Browser-fixture-only";
const tokens = new Map(), queries = [], errors = [], externalRequests = [], steps = [];
let pg, server, next, browser, page, nextOutput = "";

const database = {
  query(sql, values, callback) {
    queries.push(sql);
    const result = pg.query(sql, values);
    if (callback) { void result.then(value => callback(null, value), callback); return; }
    return result;
  },
};
async function expiry(branch, days) {
  await pg.query("UPDATE tb_branch SET contract_end_on=CASE WHEN $2::int IS NULL THEN NULL ELSE (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Vientiane')::date+$2::int END WHERE branch_uuid=$1", [branch, days]);
}
async function waitFor(test, label, timeout = 45_000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) { if (await test()) return; await delay(100); }
  throw new Error(`Timed out: ${label}`);
}
async function step(name, work) {
  console.log(`RUN ${name}`);
  const start = Date.now(); await work();
  steps.push({ name, passed: true, duration_ms: Date.now() - start }); console.log(`PASS ${name}`);
}
async function unique(locator) {
  locator = locator.filter({ visible: true });
  await locator.waitFor({ state: "visible", timeout: 60_000 });
  assert.equal(await locator.count(), 1); return locator;
}
async function click(locator) { await (await unique(locator)).click(); }
async function auth(req, res, done) {
  const identity = tokens.get(req.headers["x-access-token"]);
  if (!identity) return res.status(401).json({ status: "error", message: "Fixture token required" });
  const session = await findSession(database, identity.login_uuid);
  const rejected = sessionRejection(session);
  if (rejected) return res.status(401).json({ status: "error", auth: false, ...rejected,
    branch_uuid: session?.branch_uuid, contract_end_on: session?.contract_end_on,
    contract_days_remaining: session?.contract_days_remaining });
  Object.assign(req, { uuid: session.login_uuid, login_email: session.login_email, login_name: session.login_name,
    login_status: session.login_status, branch_uuid: session.branch_uuid, store_uuid_fk: session.store_uuid_fk,
    store_status: session.store_status, contract_end_on: session.contract_end_on, contract_days_remaining: session.contract_days_remaining });
  done();
}

async function startBackend() {
  pg = new PGlite();
  await pg.exec(`CREATE TABLE tb_stores(store_uuid uuid,store_logo text,store_active int,store_status int,deposit_expire_days int,lak_rounding_version int,store_table_status int);
    CREATE TABLE tb_branch(branch_uuid uuid,branch_name text,branch_tel text,branch_address text,store_uuid_fk uuid,contract_end_on date);
    CREATE TABLE tb_login(login_uuid uuid,login_email text,login_name text,login_password text,login_active int,roles_id_fk int,login_profile text,zone_uuid_fk uuid,position_uuid_fk uuid,deportment_uuid_fk uuid,branch_uuid_fk uuid);
    CREATE TABLE tb_zone(zone_uuid uuid,zone_id int,zone_name_la text,zone_name_eng text);
    CREATE TABLE tb_login_zone(login_uuid_fk uuid,zone_uuid_fk uuid);
    CREATE TABLE tb_position(position_uuid uuid,position_name_la text,position_name_eng text);
    CREATE TABLE tb_deportment(deportment_uuid uuid,deportment_name_la text,deportment_name_eng text);
    INSERT INTO tb_stores VALUES('${store}','',1,2,7,1,1);
    INSERT INTO tb_branch VALUES('${branchA}','Branch A','','','${store}',null),('${branchB}','Branch B','','','${store}',null);
    INSERT INTO tb_login VALUES('${loginA}','a@example.test','Staff A','fixture-hash',1,3,'',null,null,null,'${branchA}'),
      ('${loginB}','b@example.test','Staff B','fixture-hash',1,3,'',null,null,null,'${branchB}');`);
  await expiry(branchA, 10); await expiry(branchB, 20);
  const routeFile = join(backend, "api/v1/login/login.js"), routeRequire = createRequire(routeFile);
  const mocks = {
    express, "../../../config/db": database,
    bcryptjs: { compare: async (password, hash) => password === fixturePassword && hash === "fixture-hash" },
    "../../../config/jwt": { verify: auth, sign(payload) {
      const token = `contract-browser-${tokens.size + 1}`; tokens.set(token, payload); return token;
    } },
    "../../../utils/objectStorage": { buildImageUrl: () => "" },
  };
  const routeModule = { exports: {} };
  vm.runInNewContext(await readFile(routeFile, "utf8"), {
    require: name => Object.hasOwn(mocks, name) ? mocks[name] : routeRequire(name),
    module: routeModule, console, process: { env: { NODE_ENV: "test" } },
  });
  assert(!Object.keys(fromBackend.cache).some(file => file === join(backend, "config/db.js")), "Browser fixtures must never import production database configuration");
  const app = express();
  app.use((req, res, done) => {
    res.set({ "Access-Control-Allow-Origin": webOrigin, "Access-Control-Allow-Headers": "authorization,content-type,x-access-token", "Access-Control-Allow-Methods": "GET,POST,OPTIONS" });
    if (req.method === "OPTIONS") return res.sendStatus(204);
    done();
  });
  app.use(express.json());
  app.use((req, _res, done) => { req.sanitize = value => value; done(); });
  app.use("/api/v1", routeModule.exports);
  app.get("/api/v1/permission/menu", auth, (_req, res) => res.json({ status: "success", data: [{ role_id: 3,
    menus: [
      { menu_id: "expiry-fixture-dashboard", menu_title: "Dashboard", menu_path: "/", menu_icon: "mdi:home-outline", menu_is_dropdown: false },
      { menu_id: "expiry-fixture-pos", menu_title: "POS", menu_path: "/posAll/tables", menu_icon: "mdi:silverware-fork-knife", menu_is_dropdown: false },
    ] }] }));
  app.get("/api/v1/branch/fetch_all", auth, (req, res) => res.json({ status: "success", data: [{ branch_uuid: req.branch_uuid,
    branch_name: req.branch_uuid === branchA ? "Branch A" : "Branch B", store_uuid_fk: req.store_uuid_fk }] }));
  app.get("/api/v1/dashboard/executive", auth, (_req, res) => res.json({ status: "success", data: {} }));
  app.get("/api/v1/posAll/fetch_table", auth, (_req, res) => res.json({ status: "success", data: [] }));
  app.get("*", auth, (_req, res) => res.json({ status: "success", data: [] }));
  app.use((_req, res) => res.status(405).json({ status: "error", message: "Production mutation forbidden in fixture" }));
  server = await new Promise((done, fail) => { const active = app.listen(apiPort, "127.0.0.1", () => done(active)); active.once("error", fail); });
}

async function startFrontend() {
  const project = join(artifacts, "frontend-workspace");
  await mkdir(project, { recursive: true });
  for (const file of ["package.json", "next.config.ts", "tsconfig.json", "next-env.d.ts", "postcss.config.mjs"]) {
    if (!existsSync(join(frontend, file))) continue;
    const data = await readFile(join(frontend, file)), target = join(project, file);
    if (!existsSync(target) || !data.equals(await readFile(target))) await writeFile(target, data);
  }
  const sync = async (source, target) => {
    await mkdir(target, { recursive: true });
    for (const entry of await readdir(source, { withFileTypes: true })) {
      const from = join(source, entry.name), to = join(target, entry.name);
      if (entry.isDirectory()) await sync(from, to);
      else if (entry.isFile()) {
        const data = await readFile(from);
        if (!existsSync(to) || !data.equals(await readFile(to))) await writeFile(to, data);
      }
    }
  };
  await sync(join(frontend, "src"), join(project, "src"));
  for (const folder of ["public", "node_modules", "assets", "scripts"]) {
    if (existsSync(join(frontend, folder)) && !existsSync(join(project, folder))) await symlink(join(frontend, folder), join(project, folder), "dir");
  }
  next = spawn(process.execPath, [join(frontend, "node_modules/next/dist/bin/next"), "dev", project, "--webpack", "--hostname", "127.0.0.1", "--port", String(webPort)], {
    cwd: project, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_BASE_URL: apiOrigin,
      NEXT_PUBLIC_SOCKET_URL: apiOrigin, NEXT_PUBLIC_API_URL: apiOrigin, NEXT_PUBLIC_PRINTER_AGENT_URL: apiOrigin }, stdio: ["ignore", "pipe", "pipe"],
  });
  const capture = chunk => { nextOutput = (nextOutput + chunk).slice(-20000); };
  next.stdout.on("data", capture); next.stderr.on("data", capture);
  await waitFor(async () => {
    if (next.exitCode !== null) throw new Error(nextOutput);
    try { return (await fetch(`${webOrigin}/app-version.json`)).status === 200; } catch { return false; }
  }, "fixture frontend readiness", 120_000);
  for (const path of ["/login", "/", "/posAll/tables", "/subscription-expired"]) {
    console.log(`WARM ${path}`);
    const warmed = await fetch(`${webOrigin}${path}`, { signal: AbortSignal.timeout(180_000) });
    assert.equal(warmed.status, 200, `Route warm-up failed: ${path}`);
  }
}
async function context(viewport = { width: 1440, height: 960 }) {
  const value = await browser.newContext({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  await value.route("**/*", route => {
    const url = new URL(route.request().url());
    if ([webOrigin, apiOrigin].includes(url.origin) || ["data:", "blob:"].includes(url.protocol)) return route.continue();
    externalRequests.push(url.origin + url.pathname); return route.abort("blockedbyclient");
  });
  await value.routeWebSocket("**/*", socket => {
    if (new URL(socket.url()).host === new URL(webOrigin).host) socket.connectToServer(); else socket.close();
  });
  await value.addCookies([{ name: "yummy-go-language", value: "en", url: webOrigin }]);
  await value.addInitScript(({ origin }) => {
    if (location.origin !== origin) return;
    if (!localStorage.getItem("yummy-go-app")) localStorage.setItem("yummy-go-app", JSON.stringify({ state: { language: "en", theme: "light", themeColor: "emerald", fontScale: "md", decorBackground: false, laoFont: "noto-sans" }, version: 1 }));
  }, { origin: webOrigin });
  value.on("page", active => active.on("pageerror", error => errors.push(error.message)));
  return value;
}
async function login(email, password = fixturePassword) {
  await waitFor(async () => await page.getByRole("button", { name: "Sign in", exact: true }).isEnabled(), "login hydration");
  await (await unique(page.getByRole("textbox", { name: "Email", exact: true }))).fill(email);
  await (await unique(page.getByLabel("Password", { exact: true }))).fill(password);
  const response = page.waitForResponse(value => value.url() === `${apiOrigin}/api/v1/login/check_login`);
  void response.catch(() => {});
  await click(page.getByRole("button", { name: "Sign in", exact: true }));
  return response;
}

async function preferences(active, options) {
  const { width, language, theme, themeColor, decorBackground } = options;
  await active.setViewportSize({ width, height: width < 600 ? 844 : 960 });
  await active.context().addCookies([{ name: "yummy-go-language", value: language, url: webOrigin }]);
  await active.evaluate(settings => {
    const persisted = JSON.parse(localStorage.getItem("yummy-go-app") || "{}");
    localStorage.setItem("yummy-go-app", JSON.stringify({ ...persisted, version: 1,
      state: { ...persisted.state, ...settings } }));
    localStorage.setItem("i18nextLng", settings.language);
  }, { language, theme, themeColor, decorBackground });
  await active.goto(`${webOrigin}/`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await waitFor(() => active.evaluate(settings => {
    const root = document.documentElement;
    return root.lang === settings.language && root.dataset.theme === settings.theme &&
      root.dataset.themeColor === settings.themeColor && root.dataset.decorBackground === (settings.decorBackground ? "on" : "off");
  }, { language, theme, themeColor, decorBackground }), "navbar display preferences");
}

async function sharedNavbarMatrix() {
  const visual = await context();
  const originalPage = page;
  try {
    page = await visual.newPage();
    await page.goto(`${webOrigin}/login?redirect=%2F`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    assert.equal((await login("a@example.test")).status(), 200);
    await unique(page.locator(".app-header"));
    const matrix = [
      { width: 1440, language: "la", theme: "light", themeColor: "emerald", decorBackground: true, days: 90 },
      { width: 1440, language: "la", theme: "dark", themeColor: "emerald", decorBackground: true, days: 90 },
      { width: 1440, language: "la", theme: "light", themeColor: "blue", decorBackground: false, days: 10 },
      { width: 1440, language: "la", theme: "dark", themeColor: "blue", decorBackground: false, days: 10 },
      { width: 1024, language: "la", theme: "light", themeColor: "emerald", decorBackground: true, days: 90 },
      { width: 768, language: "la", theme: "dark", themeColor: "blue", decorBackground: false, days: 10 },
      { width: 390, language: "la", theme: "light", themeColor: "emerald", decorBackground: true, days: 10 },
      { width: 390, language: "la", theme: "dark", themeColor: "blue", decorBackground: false, days: 90 },
      { width: 320, language: "en", theme: "light", themeColor: "blue", decorBackground: false, days: 90 },
      { width: 320, language: "la", theme: "dark", themeColor: "emerald", decorBackground: true, days: 10 },
    ];
    const previews = [];
    for (const options of matrix) {
      console.log(`PREVIEW ${options.width}px ${options.language} ${options.theme} ${options.themeColor} ${options.decorBackground ? "decor" : "plain"} ${options.days}days`);
      await expiry(branchA, options.days);
      await preferences(page, options);
      const header = await unique(page.locator(".app-header"));
      const badge = await unique(header.getByTestId("branch-contract-status"));
      const copy = JSON.parse(await readFile(join(frontend, "public/locales", options.language, "common.json"), "utf8")).app.branchContract;
      const status = (copy.daysRemaining ?? copy.daysRemaining_other).replace("{{count}}", String(options.days));
      const heading = await unique(badge.getByText(copy.subscription, { exact: true }));
      const remaining = await unique(badge.getByText(status, { exact: true }));
      const date = await unique(badge.locator("time"));
      const expectedDate = (await pg.query("SELECT contract_end_on::text AS end_on FROM tb_branch WHERE branch_uuid=$1", [branchA])).rows[0].end_on;
      assert.equal(await date.getAttribute("datetime"), expectedDate);
      assert((await date.innerText()).trim().length > 0, "The date must be displayed as text");
      assert((await badge.getAttribute("aria-label")).includes("Branch A"));
      assert.equal(await badge.getAttribute("data-contract-tone"), options.days <= 30 ? "warning" : "normal");
      const viewport = page.viewportSize();
      const headerBox = await header.boundingBox(), badgeBox = await badge.boundingBox();
      assert(badgeBox.x >= headerBox.x - 1 && badgeBox.x + badgeBox.width <= headerBox.x + headerBox.width + 1,
        `The expiry badge must fit inside its actual ${options.width}px header`);
      for (const item of [badge, heading, date, remaining]) {
        const box = await item.boundingBox();
        assert(box && box.width > 0 && box.height > 0 && box.x >= -1 && box.x + box.width <= viewport.width + 1,
          `Visible expiry information must fit the ${options.width}px navbar`);
        assert(box.x >= badgeBox.x - 1 && box.x + box.width <= badgeBox.x + badgeBox.width + 1,
          `Expiry text must fit inside its badge at ${options.width}px`);
      }
      const controls = header.locator('button:not([data-testid="branch-contract-status"])').filter({ visible: true });
      for (let control = 0; control < await controls.count(); control += 1) {
        const box = await controls.nth(control).boundingBox();
        const overlaps = box && box.x < badgeBox.x + badgeBox.width - 1 && box.x + box.width > badgeBox.x + 1 &&
          box.y < badgeBox.y + badgeBox.height - 1 && box.y + box.height > badgeBox.y + 1;
        assert(!overlaps, `The expiry badge must not overlap navbar controls at ${options.width}px`);
      }
      const headingBox = await heading.boundingBox(), dateBox = await date.boundingBox(), remainingBox = await remaining.boundingBox();
      assert(headingBox.x + headingBox.width <= remainingBox.x + 1 && dateBox.x + dateBox.width <= remainingBox.x + 1,
        `Subscription text must not overlap the remaining-days chip at ${options.width}px`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false,
        `The ${options.width}px dashboard must not scroll horizontally`);
      const name = `navbar-${options.width}-${options.language}-${options.theme}-${options.themeColor}-${options.decorBackground ? "decor" : "plain"}-${options.days <= 30 ? "warning" : "normal"}.png`;
      await page.locator('[data-slot="skeleton"]').first().waitFor({ state: "hidden", timeout: 30_000 });
      await page.screenshot({ path: join(artifacts, name), animations: "disabled" });
      previews.push({ ...options, screenshot: name, endOn: expectedDate, status });
    }
    await writeFile(join(artifacts, "navbar-previews.json"), JSON.stringify(previews, null, 2));
  } catch (error) {
    await page.screenshot({ path: join(artifacts, "navbar-failure.png") }).catch(() => {});
    await writeFile(join(artifacts, "navbar-failure-dom.yml"), await page.locator("body").ariaSnapshot()).catch(() => {});
    throw error;
  } finally {
    page = originalPage;
    await expiry(branchA, 10);
    await visual.close();
  }
}

try {
  await mkdir(artifacts, { recursive: true });
  await step("Start isolated PostgreSQL and actual login route with synthetic signing", async () => { await startBackend(); await startFrontend(); });
  browser = await chromium.launch({ executablePath: process.env.SIMULATOR_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true, args: ["--disable-background-networking", "--disable-component-update", "--no-first-run", "--disable-sync"] });
  const first = await context({ width: 390, height: 844 }); page = await first.newPage();
  await step("Non-PLC staff see their own branch expiry in the mobile navbar", async () => {
    await page.goto(`${webOrigin}/login?redirect=%2FposAll%2Ftables`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    assert.equal((await login("a@example.test")).status(), 200);
    const badge = await unique(page.getByTestId("branch-contract-status"));
    assert((await badge.getAttribute("aria-label")).includes("Branch A"));
    await click(badge);
    await unique(page.getByRole("dialog", { name: "Current branch contract", exact: true }).getByText("10 days remaining", { exact: true }));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await page.screenshot({ path: join(artifacts, "mobile-expiry.png"), fullPage: true });
    await page.keyboard.press("Escape");
  });
  const second = await context(); const firstPage = page; let secondPage;
  await step("A different branch shows its own date and undated contracts are explicit", async () => {
    secondPage = await second.newPage(); page = secondPage;
    await page.goto(`${webOrigin}/login?redirect=%2FposAll%2Ftables`, { waitUntil: "domcontentloaded" });
    assert.equal((await login("b@example.test")).status(), 200);
    const badge = await unique(page.getByTestId("branch-contract-status"));
    assert((await badge.getAttribute("aria-label")).includes("Branch B"));
    assert((await badge.getAttribute("aria-label")).includes("20"));
    await expiry(branchB, null);
    await page.reload({ waitUntil: "domcontentloaded" });
    const undated = await unique(page.getByTestId("branch-contract-status"));
    assert.equal(await undated.getAttribute("data-contract-tone"), "unknown");
    await click(undated);
    await unique(page.getByRole("dialog", { name: "Current branch contract", exact: true }).getByText("Expiry not set", { exact: true }));
    await page.keyboard.press("Escape");
    await expiry(branchB, 20);
  });
  await step("Shared dashboard navbar visibly shows own expiry across mobile, Lao and color themes", sharedNavbarMatrix);
  let oldToken;
  await step("Expiry automatically signs out active staff and revokes the existing token", async () => {
    page = firstPage;
    oldToken = await page.evaluate(() => JSON.parse(localStorage.getItem("yummy-go-auth") || sessionStorage.getItem("yummy-go-auth") || "{}").state?.token);
    assert(oldToken); await expiry(branchA, -1);
    await page.bringToFront();
    await page.waitForURL("**/subscription-expired", { timeout: 45_000 });
    await unique(page.getByRole("heading", { name: "Branch subscription expired", exact: true }));
    const credentials = await page.evaluate(() => [localStorage.getItem("yummy-go-auth"), sessionStorage.getItem("yummy-go-auth")].map(value => value ? JSON.parse(value).state : null));
    assert(credentials.every(state => !state?.token && !state?.isLoggedIn));
    const denied = await first.request.get(`${apiOrigin}/api/v1/posAll/fetch_table`, { headers: { "x-access-token": oldToken } });
    assert.equal(denied.status(), 401); assert.equal((await denied.json()).code, "BRANCH_CONTRACT_EXPIRED");
    const contact = await unique(page.getByRole("link", { name: "Contact YummyGo to renew", exact: true }));
    assert((await contact.getAttribute("href")).startsWith("https://www.facebook.com/"));
    await page.screenshot({ path: join(artifacts, "expired-mobile.png"), fullPage: true });
    await secondPage.reload({ waitUntil: "domcontentloaded" });
    await unique(secondPage.getByTestId("branch-contract-status"));
  });
  await step("Wrong credentials stay private; expired credentials cannot obtain a new JWT", async () => {
    await click(page.getByRole("link", { name: "Sign in after renewal", exact: true }));
    const signed = tokens.size;
    const wrong = await login("a@example.test", "Wrong-fixture-password");
    // The existing login endpoint reports ordinary credential failures as
    // HTTP 200 with a numeric error code; expiry has a dedicated HTTP 401.
    assert.equal(wrong.status(), 200); const denial = await wrong.json();
    assert.equal(denial.status, "error"); assert.equal(denial.code, 401);
    assert.equal(denial.token, undefined); assert.equal(denial.branch_uuid, undefined);
    assert.equal(denial.contract_end_on, undefined); assert.equal(tokens.size, signed);
    const rejected = await login("a@example.test");
    assert.equal(rejected.status(), 401); assert.equal((await rejected.json()).code, "BRANCH_CONTRACT_EXPIRED");
    await page.waitForURL("**/subscription-expired"); assert.equal(tokens.size, signed);
  });
  await step("Renewal restores sign-in after the backend date is updated", async () => {
    await expiry(branchA, 30);
    await click(page.getByRole("link", { name: "Sign in after renewal", exact: true }));
    assert.equal((await login("a@example.test")).status(), 200);
    await unique(page.getByTestId("branch-contract-status"));
    assert((await page.getByTestId("branch-contract-status").getAttribute("aria-label")).includes("30"));
    assert.equal((await pg.query("SELECT login_active FROM tb_login WHERE login_uuid=$1", [loginA])).rows[0].login_active, 1);
  });
  await step("No production mutation or external payment/message is sent", async () => {
    assert(queries.every(sql => /^\s*SELECT\b/i.test(sql)), "All runtime database calls must be reads");
    assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
  });
  await writeFile(join(artifacts, "results.json"), JSON.stringify({ passed: true, steps, errors, externalRequests }, null, 2));
  console.log(JSON.stringify({ passed: true, scenarios: steps.length, artifacts }));
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: join(artifacts, "failure.png"), fullPage: true }).catch(() => {});
    await writeFile(join(artifacts, "failure-dom.yml"), await page.locator("body").ariaSnapshot()).catch(() => {});
  }
  await writeFile(join(artifacts, "next-output.log"), nextOutput).catch(() => {});
  await writeFile(join(artifacts, "results.json"), JSON.stringify({ passed: false, steps, errors, externalRequests, error: String(error) }, null, 2)).catch(() => {});
  console.error(error); process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) { server.closeAllConnections(); await new Promise(done => server.close(done)); }
  if (next && next.exitCode === null) {
    next.kill("SIGTERM"); await Promise.race([new Promise(done => next.once("exit", done)), delay(5000)]);
    if (next.exitCode === null) next.kill("SIGKILL");
  }
  await pg?.close();
}
