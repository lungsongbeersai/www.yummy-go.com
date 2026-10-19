import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { cp, mkdir, mkdtemp, readFile, readdir, readlink, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir, userInfo } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import { packageRelease } from "./package-release.mjs";

const execute = promisify(execFile);
const script = join(dirname(fileURLToPath(import.meta.url)), "activate-release.sh");
const fixtureServer = `
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
fs.appendFileSync(process.env.MOCK_PROCESS_LOG, process.pid + '\\n');
http.createServer((req, res) => {
  if (fs.existsSync(path.join(root, 'fail-candidate')) ||
    (process.env.PORT === process.env.MOCK_LIVE_PORT && fs.existsSync(path.join(root, 'fail-live')))) {
    res.writeHead(503); res.end('failed fixture'); return;
  }
  if (req.url === '/login') { res.end('login'); return; }
  const file = req.url.startsWith('/_next/static/')
    ? path.join(root, '.next/static', req.url.slice('/_next/static/'.length))
    : path.join(root, 'public', req.url);
  try { res.end(fs.readFileSync(file)); } catch { res.writeHead(404); res.end('missing'); }
}).listen(Number(process.env.PORT), process.env.HOSTNAME);
`;

const systemctlMock = `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const [command, ...args] = process.argv.slice(2);
const root = process.env.MOCK_ROOT;
const dropin = path.join(process.env.SYSTEMD_ROOT, 'yummy-go-fe.service.d/99-yummygo-release.conf');
const current = path.join(process.env.DEPLOY_ROOT, 'current');
const exists = fs.existsSync(dropin);
if (command === 'show') {
  const property = args[args.indexOf('-p') + 1];
  const values = {
    User: process.env.MOCK_USER,
    Group: process.env.MOCK_GROUP,
    WorkingDirectory: fs.existsSync(path.join(root, 'unexpected-unit')) ? '/unexpected' : exists ? current : process.env.APP_DIR,
    ExecStart: exists
      ? '{ path=' + current + '/start-service.sh ; argv[]=' + current + '/start-service.sh ; ignore_errors=no ; }'
      : '{ path=/usr/bin/npm ; argv[]=/usr/bin/npm start -- -p ' + process.env.MOCK_LIVE_PORT + ' ; ignore_errors=no ; }',
  };
  console.log(values[property] ?? ''); process.exit(0);
}
if (command === 'restart') {
  try { process.kill(Number(fs.readFileSync(path.join(root, 'live.pid'), 'utf8')), 'SIGTERM'); } catch {}
  if (fs.existsSync(path.join(root, 'fail-restart'))) {
    fs.unlinkSync(path.join(root, 'fail-restart')); process.exit(1);
  }
  if (fs.existsSync(path.join(root, 'fail-all-restarts'))) process.exit(1);
  const app = exists ? current : process.env.APP_DIR;
  const child = spawn(exists ? path.join(current, 'start-service.sh') : process.execPath,
    exists ? [] : [path.join(app, 'server.js')], {
      cwd: app,
      env: { ...process.env, PORT: exists ? '1' : process.env.MOCK_LIVE_PORT, HOSTNAME: exists ? 'invalid.example' : '127.0.0.1' },
      detached: true, stdio: 'ignore',
    });
  fs.writeFileSync(path.join(root, 'live.pid'), String(child.pid));
  child.unref(); process.exit(0);
}
if (['daemon-reload', 'is-active', 'status'].includes(command)) process.exit(0);
process.exit(1);
`;

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForLogin(port) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/login`);
      if (response.status === 200) return;
    } catch {}
    await delay(50);
  }
  throw new Error("Fixture server did not start");
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "yummygo-deploy-test-"));
  const bin = join(root, "bin");
  const legacy = join(root, "legacy");
  const source = join(root, "source");
  const deployRoot = join(root, "deploy");
  const systemdRoot = join(root, "systemd");
  await Promise.all([bin, legacy, source, systemdRoot].map((dir) => mkdir(dir, { recursive: true })));
  const port = await freePort();
  let candidatePort = await freePort();
  while (candidatePort === port) candidatePort = await freePort();
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    APP_DIR: legacy,
    DEPLOY_ROOT: deployRoot,
    SYSTEMD_ROOT: systemdRoot,
    NODE_BIN: process.execPath,
    PORT: String(port),
    CANDIDATE_PORT: String(candidatePort),
    KEEP_RELEASES: "2",
    HEALTH_ATTEMPTS: "8",
    HEALTH_DELAY: "0.05",
    MOCK_ROOT: root,
    MOCK_USER: userInfo().username,
    MOCK_GROUP: execFileSync("id", ["-gn"], { encoding: "utf8" }).trim(),
    MOCK_LIVE_PORT: String(port),
    MOCK_PROCESS_LOG: join(root, "processes"),
  };
  const writeExecutable = async (name, contents) => writeFile(join(bin, name), contents, { mode: 0o755 });
  await writeExecutable("systemctl", systemctlMock);
  await writeExecutable("runuser", '#!/bin/sh\nshift 2\n[ "$1" != "--" ] || shift\nexec "$@"\n');
  await writeExecutable("id", '#!/bin/sh\nif [ "$1" = "-u" ]; then echo 0; else /usr/bin/id "$@"; fi\n');
  await writeExecutable("chown", "#!/bin/sh\nexit 0\n");
  await writeExecutable("journalctl", "#!/bin/sh\nexit 0\n");
  // Production uses Linux flock/coreutils. These shims exercise the same filesystem
  // operations on macOS without granting root or touching real systemd services.
  if (process.platform !== "linux") {
    await writeExecutable("flock", "#!/bin/sh\nexit 0\n");
    await writeExecutable("mv", `#!/usr/bin/env node\nrequire('node:fs').renameSync(process.argv[3], process.argv[4]);\n`);
    await writeExecutable("find", `#!/usr/bin/env node
const fs = require('node:fs'); const path = require('node:path');
const args = process.argv.slice(2); const root = args[0];
for (const name of fs.readdirSync(root)) {
  const full = path.join(root, name); const stat = fs.lstatSync(full);
  if (stat.isDirectory() && (!args.includes('!') || full !== args[args.indexOf('-path') + 1])) console.log(stat.mtimeMs / 1000 + ' ' + full);
}
`);
  }
  t.after(async () => {
    try {
      for (const pid of (await readFile(env.MOCK_PROCESS_LOG, "utf8")).trim().split("\n")) {
        try { process.kill(Number(pid), "SIGTERM"); } catch {}
      }
    } catch {}
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(join(legacy, ".next/static"), { recursive: true });
  await mkdir(join(legacy, "public"));
  await writeFile(join(legacy, "server.js"), fixtureServer);
  await writeFile(join(legacy, ".next/static/legacy.js"), "legacy chunk");
  await writeFile(join(legacy, ".env.production"), "PRIVATE_VALUE=keep-on-server\n", { mode: 0o640 });
  await writeFile(join(legacy, ".env.local"), "PRIVATE_OVERRIDE=keep-local\n", { mode: 0o640 });
  await execute("systemctl", ["restart", "yummy-go-fe.service"], { env });
  await waitForLogin(port);
  return {
    root, legacy, source, deployRoot, env, port,
    dropin: join(systemdRoot, "yummy-go-fe.service.d/99-yummygo-release.conf"),
    async archive(releaseId, flags = []) {
      await rm(source, { recursive: true, force: true });
      await mkdir(join(source, ".next/standalone/.next"), { recursive: true });
      await mkdir(join(source, ".next/standalone/node_modules/@next"), { recursive: true });
      await cp(join(dirname(script), "../../node_modules/@next/env"), join(source, ".next/standalone/node_modules/@next/env"), { recursive: true });
      await mkdir(join(source, ".next/static/chunks"), { recursive: true });
      await mkdir(join(source, "public"));
      await writeFile(join(source, ".next/standalone/server.js"), fixtureServer);
      await writeFile(join(source, ".next/standalone/.next/BUILD_ID"), `build-${releaseId}`);
      await writeFile(join(source, ".next/standalone/.env.production"), "do-not-bundle");
      await writeFile(join(source, "public/.env.local"), "do-not-bundle-either");
      await writeFile(join(source, ".next/static/chunks", `${releaseId}.js`), releaseId);
      for (const flag of flags) await writeFile(join(source, ".next/standalone", flag), "true");
      const archive = join(root, `${releaseId}.tar.gz`);
      await packageRelease(source, archive, releaseId);
      return archive;
    },
    activate(archive, releaseId) {
      return execute("bash", [script, archive, releaseId], { env, timeout: 20_000, maxBuffer: 20_000 });
    },
  };
}

test("packages only runtime assets and excludes traced environment files", async (t) => {
  const f = await fixture(t);
  const archive = await f.archive("one");
  const contents = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" });
  assert.ok(contents.includes("./server.js"));
  assert.ok(contents.includes("./.release.json"));
  assert.ok(contents.includes("./.next/static/chunks/one.js"));
  assert.doesNotMatch(contents, /(?:^|\/)\.env(?:\.|$)/m);
});

test("migrates a physical app directory and serves old chunks while preserving env permissions", async (t) => {
  const f = await fixture(t);
  const archive = await f.archive("one");
  const before = await stat(join(f.legacy, ".env.production"));
  await f.activate(archive, "one");
  const release = join(f.deployRoot, "releases/one");
  assert.equal(await readlink(join(f.deployRoot, "current")), release);
  assert.equal(await readlink(join(release, ".env.production")), join(f.legacy, ".env.production"));
  assert.equal(await readlink(join(release, ".env.local")), join(f.legacy, ".env.local"));
  assert.equal((await stat(join(f.legacy, ".env.production"))).mode, before.mode);
  assert.equal((await fetch(`http://127.0.0.1:${f.port}/__yummygo_release.txt`).then((r) => r.text())), "one");
  assert.equal((await fetch(`http://127.0.0.1:${f.port}/_next/static/legacy.js`).then((r) => r.text())), "legacy chunk");
  assert.ok((await stat(f.legacy)).isDirectory());
  assert.match(await readFile(f.dropin, "utf8"), /ExecStart=.*current\/start-service.sh/);
});

test("rejects an unhealthy candidate without switching service or current", async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.activate(await f.archive("bad", ["fail-candidate"]), "bad"), /Candidate failed readiness/);
  await assert.rejects(readlink(join(f.deployRoot, "current")), /ENOENT/);
  await assert.rejects(readFile(f.dropin), /ENOENT/);
  await waitForLogin(f.port);
});

test("restores the legacy unit when first migration restart fails", async (t) => {
  const f = await fixture(t);
  const archive = await f.archive("bad");
  await writeFile(join(f.root, "fail-restart"), "true");
  await assert.rejects(f.activate(archive, "bad"), /Previous service restored/);
  await assert.rejects(readlink(join(f.deployRoot, "current")), /ENOENT/);
  await assert.rejects(readFile(f.dropin), /ENOENT/);
  await waitForLogin(f.port);
});

test("restores the previous managed release and drop-in after live health failure", async (t) => {
  const f = await fixture(t);
  await f.activate(await f.archive("one"), "one");
  const beforeDropin = await readFile(f.dropin, "utf8");
  await assert.rejects(f.activate(await f.archive("two", ["fail-live"]), "two"), /Previous service restored/);
  assert.equal(await readlink(join(f.deployRoot, "current")), join(f.deployRoot, "releases/one"));
  assert.equal(await readFile(f.dropin, "utf8"), beforeDropin);
  assert.equal(await fetch(`http://127.0.0.1:${f.port}/__yummygo_release.txt`).then((r) => r.text()), "one");
});

test("retains bounded original assets and protects the immediate rollback release", async (t) => {
  const f = await fixture(t);
  for (const releaseId of ["one", "two", "three"]) await f.activate(await f.archive(releaseId), releaseId);
  assert.deepEqual((await readdir(join(f.deployRoot, "releases"))).sort(), ["three", "two"]);
  const currentStatic = join(f.deployRoot, "releases/three/.next/static/chunks");
  assert.deepEqual((await readdir(currentStatic)).sort(), ["three.js", "two.js"]);
  assert.deepEqual(await readdir(join(f.deployRoot, "releases/three/.deploy-static/chunks")), ["three.js"]);
});

test("aborts on unknown unit configuration before candidate activation", async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.root, "unexpected-unit"), "true");
  await assert.rejects(f.activate(await f.archive("one"), "one"), /Unexpected WorkingDirectory/);
  await assert.rejects(readlink(join(f.deployRoot, "current")), /ENOENT/);
  await waitForLogin(f.port);
});

test("prioritizes active cashier chunks over a newer failed candidate during retention", async (t) => {
  const f = await fixture(t);
  await f.activate(await f.archive("one"), "one");
  const failed = join(f.deployRoot, "releases/failed-newer/.deploy-static/chunks");
  await mkdir(failed, { recursive: true });
  await writeFile(join(failed, "failed.js"), "failed");
  await f.activate(await f.archive("two"), "two");
  assert.deepEqual((await readdir(join(f.deployRoot, "releases"))).sort(), ["one", "two"]);
  assert.deepEqual((await readdir(join(f.deployRoot, "releases/two/.next/static/chunks"))).sort(), ["one.js", "two.js"]);
  assert.equal(await fetch(`http://127.0.0.1:${f.port}/_next/static/chunks/one.js`).then((r) => r.text()), "one");
});

test("rejects an incompatible artifact before touching the service", async (t) => {
  const f = await fixture(t);
  const archive = await f.archive("one");
  const extracted = join(f.root, "extracted");
  await mkdir(extracted);
  execFileSync("tar", ["-xzf", archive, "-C", extracted]);
  const manifest = JSON.parse(await readFile(join(extracted, ".release.json"), "utf8"));
  manifest.nodeMajor = 1;
  await writeFile(join(extracted, ".release.json"), JSON.stringify(manifest));
  execFileSync("tar", ["-czf", archive, "-C", extracted, "."]);
  await assert.rejects(f.activate(archive, "one"), /Artifact runtime mismatch/);
  await assert.rejects(readFile(f.dropin), /ENOENT/);
  await waitForLogin(f.port);
});

test("preserves release and diagnostics when rollback cannot restart the service", async (t) => {
  const f = await fixture(t);
  const archive = await f.archive("one");
  await writeFile(join(f.root, "fail-all-restarts"), "true");
  await assert.rejects(f.activate(archive, "one"), /Rollback did not restore service health/);
  assert.ok((await stat(join(f.deployRoot, "releases/one/server.js"))).isFile());
  assert.ok((await readdir(f.deployRoot)).some((name) => name.startsWith(".activate-")));
});

for (const [key, value] of [
  ["NEXT_PUBLIC_PRINTER_AGENT_SECRET", "fixture-private-printer-value"],
  ["NEXT_PUBLIC_BASE_URL", "https://fixture-api.example.invalid"],
]) {
test(`blocks public configuration drift for ${key} without printing values`, async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.legacy, ".env.local"), `${key}=${value}\n`);
  const archive = await f.archive("one");
  await assert.rejects(f.activate(archive, "one"), (error) => {
    assert.ok(error.stderr.includes(`Public build configuration differs for ${key}`));
    assert.ok(!error.stderr.includes(value));
    return true;
  });
  await assert.rejects(readFile(f.dropin), /ENOENT/);
  await waitForLogin(f.port);
});
}
