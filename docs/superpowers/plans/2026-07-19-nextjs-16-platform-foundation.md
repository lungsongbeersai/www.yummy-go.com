# Next.js 16 Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้สัญญา runtime และ delivery ของ Web SSR, Electron และ Capacitor ตรงกับ Next.js 16 จริง พร้อม error/loading boundaries และ image API ที่ไม่มี deprecation โดยยังไม่เปลี่ยน business/API/route/IPC/printing contracts

**Architecture:** Web ยังคงเป็น Next.js 16 App Router SSR; Electron ใช้ Next standalone artifact ที่ package เป็น `extraResources` นอก ASAR แล้ว materialize ไปยัง runtime directory ที่เขียนได้ก่อนเปิดด้วย `utilityProcess`; Capacitor คง online-shell ตาม design ที่อนุมัติ แต่เพิ่ม local error document และบังคับ Chromium/WebView floor ให้ตรง Next.js 16 การเปลี่ยนแปลงทั้งหมดมี contract tests และ commit แยกตาม capability

**Tech Stack:** Next.js 16.2.10, React 19.2.7, TypeScript 5.7, Vitest 4, Electron 41 + electron-builder 26, Capacitor 8.4, Node.js 22+

## Global Constraints

- อ้างอิง design ที่อนุมัติแล้วใน `docs/superpowers/specs/2026-07-19-nextjs-16-project-refactor-design.md`; หากขัดกัน Next.js 16 contract มีลำดับสูงกว่า repo docs เดิม
- รักษา URL routes, query parameters, backend payload/field names, i18n keys, Zustand public actions, printer behavior และ Electron IPC channel/payload เดิม
- ห้ามแตะไฟล์ untracked ของผู้ใช้ต่อไปนี้: `.agents/skills/yummy-go-electron/`, `.agents/skills/yummy-go-printing/`, `src/features/pos/order-customer/zz-lint-probe.ts`, `src/features/public-pos/order/hooks/zz-lint-probe.ts`
- ใช้ TDD: เพิ่ม focused failing test ก่อน implementation ทุก task และตรวจว่า failure เกิดจาก behavior ที่กำลังสร้างจริง
- ห้ามเพิ่ม dependency; ใช้ Node/Electron/Capacitor APIs และ stack เดิม
- Node floor ของโปรเจกต์กำหนดเป็น `>=22.0.0` ไม่ใช่เพียง Next.js floor `>=20.9.0` เพราะ `@capacitor/cli@8.4.0` ในโปรเจกต์ต้องการ Node `>=22.0.0`
- Electron ต้องคง `contextIsolation: true`, `nodeIntegration: false`, preload API แบบ narrow/typed, customer-display readiness queue และ browser fallback เดิม
- `AGENTS.md` และ `CLAUDE.md` เป็น managed files: ห้ามแก้จนกว่าจะส่ง Hermes proposal และได้รับการอนุมัติแยกอย่างชัดเจน; เมื่อแก้ต้องรักษา Hermes block ใน `AGENTS.md` byte-for-byte
- ⚠️ ใช้ได้ แต่มี trade-off — Capacitor 8 ระบุว่า production `server.url` ไม่ใช่ use case ที่แนะนำ แต่ design ที่อนุมัติกำหนด online-shell ไว้ จึงคง contract นี้โดยบันทึกข้อยกเว้น เพิ่ม local `errorPath` และยอมรับว่า native app ใช้งานไม่ได้เมื่อ hosted SSR/API ไม่พร้อม
- Full repository lint ยังมี tracked React 19/Compiler debt 56 รายการซึ่ง Phase 2 เป็นเจ้าของ; Phase 1 ต้องทำ focused ESLint ของไฟล์ที่แตะให้ผ่าน และห้ามเพิ่ม error ใหม่
- เอกสารอ้างอิงหลัก:
  - https://nextjs.org/docs/app/guides/upgrading/version-16
  - https://nextjs.org/docs/app/api-reference/config/next-config-js/output
  - https://nextjs.org/docs/app/api-reference/components/image
  - https://nextjs.org/docs/app/getting-started/error-handling
  - https://www.electronjs.org/docs/latest/api/utility-process
  - https://www.electron.build/docs/contents/
  - https://capacitorjs.com/docs/config

---

## Task 1: Enforce the supported Node runtime before install and deploy

**Files:**

- Create: `.nvmrc`
- Create: `scripts/check-node-version.mjs`
- Create: `src/lib/node-runtime-contract.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/workflows/deploy-static.yml`

- [ ] **Step 1: Write the failing black-box runtime contract test**

Create `src/lib/node-runtime-contract.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

interface ProjectManifest {
  engines?: { node?: string };
  scripts?: Record<string, string>;
}

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const checkerPath = join(projectRoot, "scripts", "check-node-version.mjs");

function check(version: string) {
  return spawnSync(process.execPath, [checkerPath, "--version", version], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

describe("Node runtime contract", () => {
  it("rejects runtimes below the project floor", () => {
    expect(check("21.99.0").status).toBe(1);
  });

  it("accepts Node 22 and later", () => {
    expect(check("22.0.0").status).toBe(0);
    expect(check("24.6.0").status).toBe(0);
  });

  it("keeps package install and CI on the same floor", () => {
    const manifest = JSON.parse(
      readFileSync(join(projectRoot, "package.json"), "utf8"),
    ) as ProjectManifest;

    expect(manifest.engines?.node).toBe(">=22.0.0");
    expect(manifest.scripts?.preinstall).toBe("node scripts/check-node-version.mjs");
    expect(manifest.scripts?.["verify:node"]).toBe("node scripts/check-node-version.mjs");
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the intended failure**

Run:

```powershell
npx vitest run src/lib/node-runtime-contract.test.ts
```

Expected: FAIL because `scripts/check-node-version.mjs`, `engines.node`, `preinstall`, and `verify:node` do not exist yet.

- [ ] **Step 3: Implement the version checker and repository pin**

Create `.nvmrc` with exactly:

```text
22
```

Create `scripts/check-node-version.mjs`:

```js
const minimum = [22, 0, 0];
const explicitVersion = process.argv[2] === "--version" ? process.argv[3] : undefined;
const currentVersion = explicitVersion ?? process.versions.node;
const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(currentVersion ?? "");

if (!match) {
  console.error(`Unable to parse Node.js version: ${currentVersion ?? "missing"}`);
  process.exit(1);
}

const actual = match.slice(1).map(Number);
const supported = minimum.every((part, index) => {
  if (actual[index] === part) return true;
  return actual[index] > part && actual.slice(0, index).every((value, partIndex) => (
    value === minimum[partIndex]
  ));
});

if (!supported) {
  console.error(`Yummy Go requires Node.js >=22.0.0; received ${currentVersion}.`);
  process.exit(1);
}

console.log(`Node.js ${currentVersion} satisfies the Yummy Go runtime contract.`);
```

Before committing, simplify comparison to a lexicographic loop if the test exposes an edge case such as `23.0.0`; the final implementation must accept every major above 22 and reject every version below `22.0.0`.

Modify `package.json`:

```json
{
  "engines": {
    "node": ">=22.0.0"
  },
  "scripts": {
    "preinstall": "node scripts/check-node-version.mjs",
    "verify:node": "node scripts/check-node-version.mjs"
  }
}
```

Keep every existing script; insert these entries without reordering dependency sections.

- [ ] **Step 4: Make the remote deploy fail before dependency installation**

In `.github/workflows/deploy-static.yml`, inside the remote `sudo -u linuxuser bash -lc` block, add this immediately after the existing Node/npm version log and before deleting `.next` or running `npm ci`:

```bash
node scripts/check-node-version.mjs
```

Do not rename the workflow file in this phase because both managed instruction files currently reference its path; naming cleanup belongs to Phase 8 after the documentation gate has completed.

- [ ] **Step 5: Synchronize the lockfile and make the test green**

Run:

```powershell
npm install --package-lock-only --ignore-scripts
npx vitest run src/lib/node-runtime-contract.test.ts
npm run verify:node
```

Expected: all three commands PASS; the root package entry in `package-lock.json` includes `engines.node: ">=22.0.0"`.

- [ ] **Step 6: Commit the runtime contract**

```powershell
git add .nvmrc scripts/check-node-version.mjs src/lib/node-runtime-contract.test.ts package.json package-lock.json .github/workflows/deploy-static.yml
git commit -m "build: enforce supported Node runtime"
```

---

## Task 2: Complete Next.js 16 error, Suspense, and image boundaries

**Files:**

- Create: `src/app/global-error.tsx`
- Modify: `src/app/pos/page.tsx`
- Modify: `src/app/home/page.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/(protected)/printer/form/page.tsx`
- Modify: `src/features/auth/login/login-client.tsx`
- Modify: `src/features/public-pos/order/components/public-product-media.tsx`
- Modify: `src/features/public-pos/order/components/public-product-card.tsx`
- Modify: `src/features/public-pos/order/components/public-product-category-section.tsx`
- Modify: `src/features/public-pos/order/components/public-status-rail-section.tsx`
- Modify: `src/lib/project-refactor-guards.test.ts`

- [ ] **Step 1: Add failing structural guards**

Extend `routeFileNames` in `src/lib/project-refactor-guards.test.ts` with `global-error.tsx`, and add `app/global-error.tsx` to `allowedClientRouteFiles` because Next error boundaries must be Client Components.

Add these tests inside the existing `describe("project refactor guards", callback)` block:

```ts
it("keeps a complete root error boundary", () => {
  const globalError = readFileSync(join(srcDir, "app/global-error.tsx"), "utf8");

  expect(globalError).toContain('"use client"');
  expect(globalError).toContain("<html");
  expect(globalError).toContain("<body");
  expect(globalError).toContain("unstable_retry");
});

it("keeps search-param routes behind visible Suspense fallbacks", () => {
  const suspenseRoutes = [
    "app/pos/page.tsx",
    "app/home/page.tsx",
    "app/login/page.tsx",
    "app/(protected)/printer/form/page.tsx",
  ];

  const missingFallback = suspenseRoutes.filter((route) => (
    !readFileSync(join(srcDir, route), "utf8").includes("<Suspense fallback={")
  ));

  expect(missingFallback).toEqual([]);
});

it("keeps deprecated Next Image priority props out of source", () => {
  expect(matchesInFiles(srcDir, /\bpriority(?:\s*=|\s*>)/g)).toEqual([]);
});
```

- [ ] **Step 2: Run the guard and confirm all three new contracts fail**

```powershell
npx vitest run src/lib/project-refactor-guards.test.ts
```

Expected: FAIL because `global-error.tsx` is missing, the four Suspense elements have implicit `null` fallbacks, and three Image call paths still expose `priority`.

- [ ] **Step 3: Add a provider-independent root error document**

Create `src/app/global-error.tsx` as a self-contained client boundary. It must import `./globals.css`, render its own `<html lang="en">` and `<body>`, avoid `useTranslation`/providers because the root layout may be the failing component, avoid exposing the raw production error message, and expose a native retry button:

```tsx
"use client";

import "./globals.css";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}

export default function GlobalError({ error, unstable_retry }: GlobalErrorProps) {
  return (
    <html lang="en">
      <body>
        <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
          <section className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
            <h1 className="text-xl font-black">Yummy Go could not load</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Retry the page. If the problem continues, contact support.
            </p>
            {error.digest ? (
              <p className="mt-2 text-xs text-muted-foreground">Reference: {error.digest}</p>
            ) : null}
            <button
              type="button"
              className="mt-5 min-h-11 rounded-md bg-primary px-4 py-2 font-bold text-primary-foreground"
              onClick={unstable_retry}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Give every search-param boundary a visible skeleton**

Import `LoadingState` from `@/components/common/loading-state` in the four route pages and set these exact fallbacks:

```tsx
// src/app/pos/page.tsx
<Suspense fallback={<LoadingState variant="posGrid" />}>

// src/app/home/page.tsx
<Suspense fallback={<LoadingState variant="page" />}>

// src/app/login/page.tsx
<Suspense fallback={<LoadingState variant="page" />}>

// src/app/(protected)/printer/form/page.tsx
<Suspense fallback={<LoadingState variant="page" />}>
```

Do not move the four client features into route files; routes remain thin Server Components.

- [ ] **Step 5: Replace deprecated Image priority semantics without increasing preloads**

In `src/features/auth/login/login-client.tsx`:

- replace the desktop hero `priority` with `preload`
- replace the small brand icon `priority` with `loading="eager"`
- keep existing `sizes`, `fill`, dimensions, and alt behavior

Across the public POS media chain, rename the internal API consistently:

```tsx
// ProductMedia
preload = false
preload?: boolean
<Image
  preload={preload || undefined}
  loading={preload ? undefined : "lazy"}
/>

// ProductCard and both callers
imagePreload = false
imagePreload?: boolean
<ProductMedia preload={imagePreload} />
<ProductCard imagePreload={product.prod_uuid === priorityProductUuid} />
```

Keep `priorityProductUuid` unchanged in this phase because it describes domain selection, not a Next Image prop; renaming domain-wide priority selection belongs to the naming phase.

- [ ] **Step 6: Verify the focused boundary change**

Run:

```powershell
npx vitest run src/lib/project-refactor-guards.test.ts
npx eslint src/app/global-error.tsx src/app/pos/page.tsx src/app/home/page.tsx src/app/login/page.tsx "src/app/(protected)/printer/form/page.tsx" src/features/auth/login/login-client.tsx src/features/public-pos/order/components/public-product-media.tsx src/features/public-pos/order/components/public-product-card.tsx src/features/public-pos/order/components/public-product-category-section.tsx src/features/public-pos/order/components/public-status-rail-section.tsx src/lib/project-refactor-guards.test.ts
npm run typecheck
```

Expected: PASS with no new lint or type errors.

- [ ] **Step 7: Commit the Next.js boundary work**

```powershell
git add src/app/global-error.tsx src/app/pos/page.tsx src/app/home/page.tsx src/app/login/page.tsx "src/app/(protected)/printer/form/page.tsx" src/features/auth/login/login-client.tsx src/features/public-pos/order/components/public-product-media.tsx src/features/public-pos/order/components/public-product-card.tsx src/features/public-pos/order/components/public-product-category-section.tsx src/features/public-pos/order/components/public-status-rail-section.tsx src/lib/project-refactor-guards.test.ts
git commit -m "fix(next): complete Next 16 route boundaries"
```

---

## Task 3: Produce one deterministic standalone artifact for Electron

**Files:**

- Create: `scripts/stage-electron-runtime.mjs`
- Create: `scripts/smoke-next-standalone.mjs`
- Create: `src/platform/electron/packaging-contract.test.ts`
- Modify: `next.config.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Write the failing packaging contract test**

Create `src/platform/electron/packaging-contract.test.ts` to read `package.json`, `next.config.ts`, and both script paths. Assert:

```ts
expect(nextConfigSource).toContain('output: "standalone"');
expect(manifest.scripts?.["electron:stage"]).toBe(
  "node scripts/stage-electron-runtime.mjs",
);
expect(manifest.scripts?.["electron:pack:dir"]).toContain("electron-builder --dir");
expect(manifest.scripts?.["electron:pack"]).not.toContain("electron:start");
expect(manifest.build?.files).toEqual(["dist-electron/**/*", "package.json"]);
expect(manifest.build?.extraResources).toEqual([
  { from: ".next/electron-runtime", to: "next-server" },
]);
expect(existsSync(join(projectRoot, "scripts/stage-electron-runtime.mjs"))).toBe(true);
expect(existsSync(join(projectRoot, "scripts/smoke-next-standalone.mjs"))).toBe(true);
```

Use explicit interfaces for the manifest shape; do not introduce `any`.

- [ ] **Step 2: Run the contract and confirm it fails on the current full-package setup**

```powershell
npx vitest run src/platform/electron/packaging-contract.test.ts
```

Expected: FAIL because standalone output, staging scripts, and `extraResources` do not exist and the current builder includes all `.next` and `node_modules` files.

- [ ] **Step 3: Enable standalone output**

Add this top-level property to `nextConfig` in `next.config.ts`:

```ts
output: "standalone",
```

Keep `outputFileTracingRoot: appDir`; it already points to the correct single-project tracing root.

- [ ] **Step 4: Stage a verified physical runtime tree**

Create `scripts/stage-electron-runtime.mjs` using `node:fs/promises` and `node:path`. The script must:

1. Resolve all paths from the repository root, never from the caller's current directory.
2. Verify `.next/standalone/server.js`, `.next/BUILD_ID`, `.next/static`, and `public` exist.
3. Resolve `.next/electron-runtime` and abort unless it is a child of the repository `.next` directory.
4. Remove only that validated staging directory.
5. Copy `.next/standalone` to `.next/electron-runtime`.
6. Copy `.next/static` to `.next/electron-runtime/.next/static`.
7. Copy `public` to `.next/electron-runtime/public`.
8. Re-check `server.js`, `.next/BUILD_ID`, `.next/static`, and `public` in the staged tree, then print the absolute staged path.

Core shape:

```js
import { access, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nextDir = join(projectRoot, ".next");
const standaloneDir = join(nextDir, "standalone");
const stagedDir = join(nextDir, "electron-runtime");

if (!stagedDir.startsWith(`${nextDir}${sep}`)) {
  throw new Error(`Refusing to stage outside ${nextDir}`);
}

await access(join(standaloneDir, "server.js"));
await access(join(nextDir, "BUILD_ID"));
await access(join(nextDir, "static"));
await access(join(projectRoot, "public"));
await rm(stagedDir, { recursive: true, force: true });
await cp(standaloneDir, stagedDir, { recursive: true });
await mkdir(join(stagedDir, ".next"), { recursive: true });
await cp(join(nextDir, "static"), join(stagedDir, ".next", "static"), { recursive: true });
await cp(join(projectRoot, "public"), join(stagedDir, "public"), { recursive: true });
```

- [ ] **Step 5: Add an SSR smoke runner for the staged standalone server**

Create `scripts/smoke-next-standalone.mjs`. It must spawn `process.execPath` with `.next/electron-runtime/server.js`, use `cwd=.next/electron-runtime`, bind `HOSTNAME=127.0.0.1`, use a fixed test port `3311`, poll for at most 30 seconds, and always kill the child in `finally`.

Verify these contracts with `redirect: "manual"` where needed:

```js
const checks = [
  { path: "/login", status: 200 },
  { path: "/pos?t=phase-1-smoke", status: 200 },
  { path: "/report/daily-sales", status: 200 },
  { path: "/q/phase-1-smoke", status: 307, location: "/pos?t=phase-1-smoke" },
  { path: "/setting/unite", status: 308, location: "/setting/unit" },
];
```

Treat `location` as a URL and compare its pathname plus search string so absolute and relative redirect headers are both accepted. Pipe child stdout/stderr to the parent for actionable failures.

- [ ] **Step 6: Replace the full-package builder contract**

Update `package.json` scripts without changing dev behavior:

```json
{
  "electron:stage": "node scripts/stage-electron-runtime.mjs",
  "electron:pack:dir": "npm run build && npm run electron:build && npm run electron:stage && electron-builder --dir",
  "electron:pack": "npm run build && npm run electron:build && npm run electron:stage && electron-builder",
  "smoke:ssr": "node scripts/smoke-next-standalone.mjs"
}
```

Replace the builder file set with:

```json
{
  "files": [
    "dist-electron/**/*",
    "package.json"
  ],
  "extraResources": [
    {
      "from": ".next/electron-runtime",
      "to": "next-server"
    }
  ]
}
```

Keep `appId`, `productName`, output directory, NSIS target, and icon unchanged.

- [ ] **Step 7: Build, stage, and smoke the standalone artifact**

```powershell
npm install --package-lock-only --ignore-scripts
npx vitest run src/platform/electron/packaging-contract.test.ts
npm run build
npm run electron:stage
npm run smoke:ssr
```

Expected: PASS; `.next/electron-runtime/server.js`, `.next/electron-runtime/.next/static`, and `.next/electron-runtime/public` exist; all five HTTP checks pass.

- [ ] **Step 8: Commit the deterministic artifact pipeline**

```powershell
git add next.config.ts package.json package-lock.json scripts/stage-electron-runtime.mjs scripts/smoke-next-standalone.mjs src/platform/electron/packaging-contract.test.ts
git commit -m "build(electron): stage standalone Next runtime"
```

---

## Task 4: Launch the packaged Next server from a writable Electron runtime

**Files:**

- Create: `src/platform/electron/next-server-contract.ts`
- Create: `src/platform/electron/next-server-contract.test.ts`
- Modify: `electron/main.ts`
- Modify: `electron/tsconfig.json`
- Modify: `package.json`
- Modify: `src/lib/project-refactor-guards.test.ts`

- [ ] **Step 1: Characterize path, copy, environment, and readiness behavior**

Create `src/platform/electron/next-server-contract.test.ts` with temporary directories under `mkdtemp(join(tmpdir(), "yummy-go-next-server-"))`. Cover:

- packaged source resolves to `<resourcesPath>/next-server`
- writable runtime resolves to `<userDataPath>/next-runtime/<sanitized-version>`
- runtime entry is `<runtimeDirectory>/server.js`
- `PORT`, `HOSTNAME=127.0.0.1`, and `NODE_ENV=production` are added without dropping inherited environment values
- materialization copies `server.js`, `.next`, and `public` and writes a version marker
- a complete matching runtime is reused
- an incomplete runtime is replaced through a sibling staging directory
- readiness retries failed probes and resolves on the first successful probe
- readiness rejects after the configured timeout

Always delete only the test-created `mkdtemp` root in `afterEach`/`finally`.

- [ ] **Step 2: Add a static regression guard for the broken launcher**

Extend `src/lib/project-refactor-guards.test.ts`:

```ts
it("keeps the packaged Electron server outside ASAR and shell-free", () => {
  const mainProcess = readFileSync(join(projectRoot, "electron/main.ts"), "utf8");

  expect(mainProcess).toContain("process.resourcesPath");
  expect(mainProcess).toContain("utilityProcess.fork");
  expect(mainProcess).not.toContain("node_modules");
  expect(mainProcess).not.toContain(".bin");
  expect(mainProcess).not.toContain("shell: true");
});
```

- [ ] **Step 3: Run both focused tests and confirm the intended failures**

```powershell
npx vitest run src/platform/electron/next-server-contract.test.ts src/lib/project-refactor-guards.test.ts
```

Expected: FAIL because the contract module does not exist and `electron/main.ts` still launches `node_modules/.bin/next` with `shell: true`.

- [ ] **Step 4: Implement the tested runtime contract**

Create `src/platform/electron/next-server-contract.ts` with explicit interfaces:

```ts
export interface NextServerPathsInput {
  resourcesPath: string;
  userDataPath: string;
  appVersion: string;
}

export interface NextServerPaths {
  packagedDirectory: string;
  packagedEntry: string;
  runtimeDirectory: string;
  runtimeEntry: string;
  markerPath: string;
}

export interface ServerReadinessOptions {
  timeoutMs?: number;
  intervalMs?: number;
  probe?: (url: string) => Promise<boolean>;
  now?: () => number;
  delay?: (milliseconds: number) => Promise<void>;
}
```

Export these functions:

```ts
createNextServerPaths(input: NextServerPathsInput): NextServerPaths
createNextServerEnvironment(port: number, inherited?: NodeJS.ProcessEnv): NodeJS.ProcessEnv
materializeNextServer(paths: NextServerPaths, appVersion: string): Promise<void>
waitForNextServer(url: string, options?: ServerReadinessOptions): Promise<void>
```

`materializeNextServer` must validate `packagedEntry`, copy into `<runtimeDirectory>.staging`, write the marker only after the copy completes, remove only the exact versioned runtime/staging paths, and rename staging atomically. This copy is necessary because installed `resources/` can be read-only while Next image/runtime caches write under `.next`.

- [ ] **Step 5: Compile the shared platform contract into the Electron output**

Change `electron/tsconfig.json` to:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "../dist-electron",
    "rootDir": "..",
    "types": ["node"]
  },
  "include": [
    "main.ts",
    "preload.ts",
    "../src/platform/electron/next-server-contract.ts"
  ]
}
```

Update package entry to:

```json
"main": "dist-electron/electron/main.js"
```

Because `main.ts` and `preload.ts` compile into the same `dist-electron/electron` directory, the existing `path.join(__dirname, "preload.js")` contract remains valid.

- [ ] **Step 6: Replace the production launcher with `utilityProcess`**

In `electron/main.ts`:

- import `dialog`, `utilityProcess`, and `type UtilityProcess` from `electron`
- remove `child_process` imports
- type `nextProcess` as `UtilityProcess | null`
- use `http://127.0.0.1:${PORT}` consistently
- after `app.whenReady()`, resolve source from `process.resourcesPath`, runtime from `app.getPath("userData")`, and version from `app.getVersion()`
- call `materializeNextServer`
- fork `runtimeEntry` with `utilityProcess.fork(runtimeEntry, [], { cwd: runtimeDirectory, env, stdio: "pipe", serviceName: "Yummy Go Next Server" })`
- forward stdout/stderr, reject if the child exits before readiness, and wait for `waitForNextServer(BASE_URL)` before creating windows
- on startup failure show `dialog.showErrorBox("Yummy Go could not start", message)` and call `app.quit()`
- keep both `window-all-closed` and `before-quit` cleanup, using `nextProcess?.kill()`
- do not touch display selection, IPC handlers, readiness queue, BrowserWindow security flags, or renderer URLs beyond the hostname normalization

- [ ] **Step 7: Verify tests, compilation, and unpacked packaging**

```powershell
npx vitest run src/platform/electron/next-server-contract.test.ts src/lib/project-refactor-guards.test.ts
npx eslint electron/main.ts src/platform/electron/next-server-contract.ts src/platform/electron/next-server-contract.test.ts src/lib/project-refactor-guards.test.ts
npm run typecheck
npm run electron:build
npm run electron:pack:dir
```

Expected:

- tests and lint PASS
- `dist-electron/electron/main.js`, `dist-electron/electron/preload.js`, and `dist-electron/src/platform/electron/next-server-contract.js` exist
- `release/win-unpacked/resources/next-server/server.js` exists outside `app.asar`
- `release/win-unpacked/resources/app.asar` does not contain a full `.next` tree or full project `node_modules`

- [ ] **Step 8: Perform one real unpacked startup acceptance check**

With port 3000 free, launch `release/win-unpacked/Yummy Go POS.exe`, then verify:

1. main window reaches `/`
2. `/login` assets and optimized images render
3. customer display opens and receives its existing readiness/payload flow
4. closing all windows terminates the child server and releases port 3000
5. relaunch succeeds without rebuilding or recopying a complete same-version runtime

Use `Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue` before launch and after exit as evidence. Do not kill unrelated processes to free the port.

- [ ] **Step 9: Commit the packaged runtime launcher**

```powershell
git add electron/main.ts electron/tsconfig.json package.json src/platform/electron/next-server-contract.ts src/platform/electron/next-server-contract.test.ts src/lib/project-refactor-guards.test.ts
git commit -m "fix(electron): launch packaged standalone server"
```

---

## Task 5: Make the approved Capacitor online shell explicit and recoverable

**Files:**

- Create: `capacitor-shell/index.html`
- Create: `capacitor-shell/offline.html`
- Create: `src/platform/capacitor/online-shell-contract.ts`
- Create: `src/platform/capacitor/online-shell-contract.test.ts`
- Modify: `capacitor.config.ts`
- Modify: `src/lib/android-webview-compat.ts`
- Modify: `src/lib/android-webview-compat.test.ts`
- Generated by sync: `android/app/src/main/assets/capacitor.config.json`
- Generated by sync: `android/app/src/main/assets/public/index.html`
- Generated by sync: `android/app/src/main/assets/public/offline.html`

- [ ] **Step 1: Write the failing online-shell contract tests**

Create `src/platform/capacitor/online-shell-contract.ts` only after the first failing test. The test file must initially import the missing module and assert this exact contract:

```ts
expect(CAPACITOR_ONLINE_SHELL).toEqual({
  productionUrl: "https://yummy-go.com",
  webDir: "capacitor-shell",
  errorPath: "offline.html",
  minWebViewVersion: 111,
});
```

Also assert that both `<webDir>/index.html` and `<webDir>/<errorPath>` exist and that `offline.html` contains a visible retry link to `productionUrl`.

Extend `src/lib/android-webview-compat.test.ts` with two boundary cases using full Android WebView user agents:

```ts
it("enables fallback below the Next.js 16 Chromium floor", () => {
  // Chrome/110 + all CSS capabilities -> needsCompat true
});

it("allows the Next.js 16 Chromium floor when capabilities exist", () => {
  // Chrome/111 + all CSS capabilities -> needsCompat false
});
```

- [ ] **Step 2: Run the tests and confirm the current misleading contract fails**

```powershell
npx vitest run src/platform/capacitor/online-shell-contract.test.ts src/lib/android-webview-compat.test.ts
```

Expected: FAIL because the shared contract and local shell files are missing and the current compat threshold is 100.

- [ ] **Step 3: Define one shared online-shell contract**

Create `src/platform/capacitor/online-shell-contract.ts`:

```ts
export const CAPACITOR_ONLINE_SHELL = {
  productionUrl: "https://yummy-go.com",
  webDir: "capacitor-shell",
  errorPath: "offline.html",
  minWebViewVersion: 111,
} as const;
```

Import `CAPACITOR_ONLINE_SHELL.minWebViewVersion` in `src/lib/android-webview-compat.ts` and remove the local `MIN_STABLE_WEBVIEW_MAJOR = 100` constant. Preserve feature detection and localStorage overrides.

- [ ] **Step 4: Create a local non-plugin error experience**

Create `capacitor-shell/index.html` and `capacitor-shell/offline.html` as standalone valid HTML documents with:

- UTF-8, viewport, and `color-scheme: light` metadata
- no external CSS, font, image, script, or Capacitor plugin dependency
- at least 44 CSS-pixel retry target
- fixed-light Yummy Go styling with accessible contrast and visible keyboard focus
- `index.html` explaining that the hosted app is required and linking to `https://yummy-go.com`
- `offline.html` stating that network/server access is unavailable and linking to `https://yummy-go.com` with label `Try again`

Do not use `window.location.reload()` on the local error path because that would reload the local document instead of the hosted SSR URL.

- [ ] **Step 5: Wire Capacitor config to the explicit shell**

Modify `capacitor.config.ts`:

```ts
import { CAPACITOR_ONLINE_SHELL } from "./src/platform/capacitor/online-shell-contract";

const config: CapacitorConfig = {
  appId: "com.yummygo.app",
  appName: "Yummy Go",
  webDir: CAPACITOR_ONLINE_SHELL.webDir,
  server: {
    // Approved exception: this Android target is an online shell for the hosted SSR app.
    url: CAPACITOR_ONLINE_SHELL.productionUrl,
    errorPath: CAPACITOR_ONLINE_SHELL.errorPath,
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    appendUserAgent: "YummyGoCapacitorAndroid",
    backgroundColor: "#ffffff",
    webContentsDebuggingEnabled: process.env.CAPACITOR_WEB_DEBUG === "1",
    minWebViewVersion: CAPACITOR_ONLINE_SHELL.minWebViewVersion,
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: "#ffffff",
      style: "LIGHT",
    },
  },
};
```

Keep production WebView debugging controlled by `CAPACITOR_WEB_DEBUG === "1"`, preserve StatusBar and TCP printing behavior, and do not add `allowNavigation` or mixed-content exceptions. Remove the existing `iosScheme: "https"`: Capacitor 8 does not allow HTTP(S) as a custom iOS local scheme, and this repository has no iOS target.

- [ ] **Step 6: Sync the native project and verify generated truth**

```powershell
npx vitest run src/platform/capacitor/online-shell-contract.test.ts src/lib/android-webview-compat.test.ts
npx cap sync android
```

Expected:

- tests PASS
- sync no longer complains that `out/index.html` is missing
- `android/app/src/main/assets/capacitor.config.json` contains `webDir: "capacitor-shell"`, hosted URL, `errorPath: "offline.html"`, and `minWebViewVersion: 111`
- generated `public/index.html` and `public/offline.html` match the source shell files

- [ ] **Step 7: Build one Android debug artifact**

```powershell
Push-Location android
try {
  .\gradlew.bat assembleDebug
} finally {
  Pop-Location
}
```

Expected: BUILD SUCCESSFUL and `android/app/build/outputs/apk/debug/app-debug.apk` exists. On a device/emulator, verify Chromium 111+ loads the hosted app and an unavailable server shows the local offline page; the latter is a manual network acceptance check, not a unit-test substitute.

- [ ] **Step 8: Commit the Capacitor contract**

```powershell
git add capacitor-shell/index.html capacitor-shell/offline.html capacitor.config.ts src/platform/capacitor/online-shell-contract.ts src/platform/capacitor/online-shell-contract.test.ts src/lib/android-webview-compat.ts src/lib/android-webview-compat.test.ts android/app/src/main/assets/capacitor.config.json android/app/src/main/assets/public/index.html android/app/src/main/assets/public/offline.html
git commit -m "fix(capacitor): define recoverable online shell"
```

---

## Task 6: Apply the project-contract documentation only through the managed approval gate

**Files:**

- Modify after explicit approval only: `AGENTS.md`
- Modify after explicit approval only: `CLAUDE.md`

- [ ] **Step 1: Present one exact Hermes proposal without editing either file**

The proposal must show these synchronized changes:

1. Project stack: `Next.js 15` -> `Next.js 16`.
2. Next.js convention: replace the inaccurate static-export requirement with: web runs as Node SSR; Electron packages standalone output; Capacitor is the documented online-shell exception; data still flows through service/store layers and no Server Actions are introduced.
3. Runtime: Node.js `>=22.0.0` for the complete toolchain (`Next.js 16` alone requires `>=20.9.0`, Capacitor CLI 8 raises the project floor).
4. Platform section: Electron resolves packaged standalone assets via `process.resourcesPath` and runs a writable versioned runtime copy; Capacitor uses `capacitor-shell` and local `errorPath`.
5. Commands: add `npm run verify:node`, `npm run electron:stage`, and `npm run electron:pack:dir`; keep existing commands.

End the proposal by asking for explicit approval to edit both managed files. The broad refactor approval and approval of this plan do not count as this separate managed-file approval.

- [ ] **Step 2: Pause until the user explicitly approves the proposal**

Expected: no filesystem changes in `AGENTS.md` or `CLAUDE.md` while waiting.

- [ ] **Step 3: Apply only the approved synchronized wording**

After approval, use `apply_patch` for both files. Do not reformat unrelated text. In `AGENTS.md`, do not alter anything from `<!-- autoclaw:hermes-evolution-guidance -->` through `<!-- /autoclaw:hermes-evolution-guidance -->`.

- [ ] **Step 4: Verify the managed block and synchronized contract**

Run before and after the edit for `AGENTS.md`; the SHA-256 must remain:

```text
e7738e5688e19df634251b2dcc87a13a9e24eb44459ffb23aeba9f8b253da4b8
```

Use:

```powershell
node -e "const fs=require('fs'),c=require('crypto');const s=fs.readFileSync('AGENTS.md','utf8');const m=s.match(/<!-- autoclaw:hermes-evolution-guidance -->[\s\S]*?<!-- \/autoclaw:hermes-evolution-guidance -->/);if(!m)throw new Error('Hermes block missing');console.log(c.createHash('sha256').update(m[0]).digest('hex'))"
git diff --check -- AGENTS.md CLAUDE.md
git diff -- AGENTS.md CLAUDE.md
```

Expected: hash matches exactly; diff contains only the approved project/runtime/platform wording.

- [ ] **Step 5: Commit the managed documentation update**

```powershell
git add AGENTS.md CLAUDE.md
git commit -m "docs: align project contract with Next 16"
```

If approval is denied, skip Steps 3-5, record the stale-doc residual risk, and do not claim the full Phase 1 contract is complete.

---

## Task 7: Run the Phase 1 completion matrix and record evidence

**Files:**

- Modify only if a verification failure proves a Phase 1 regression: the owning file and its focused test
- Do not modify: Phase 2 React-lint debt or later-phase architecture targets

- [ ] **Step 1: Confirm the worktree contains no accidental user-file changes**

```powershell
git status --short
git diff --name-only HEAD~6..HEAD
```

Expected: the four pre-existing untracked paths remain untracked and unchanged; no unrelated feature/store/service files appear.

- [ ] **Step 2: Run focused contract tests first**

```powershell
npx vitest run src/lib/node-runtime-contract.test.ts src/lib/project-refactor-guards.test.ts src/platform/electron/packaging-contract.test.ts src/platform/electron/next-server-contract.test.ts src/platform/capacitor/online-shell-contract.test.ts src/lib/android-webview-compat.test.ts
```

Expected: all focused files PASS.

- [ ] **Step 3: Run focused lint for every Phase 1 source/config file**

```powershell
npx eslint next.config.ts capacitor.config.ts electron/main.ts scripts/check-node-version.mjs scripts/stage-electron-runtime.mjs scripts/smoke-next-standalone.mjs src/app/global-error.tsx src/app/pos/page.tsx src/app/home/page.tsx src/app/login/page.tsx "src/app/(protected)/printer/form/page.tsx" src/features/auth/login/login-client.tsx src/features/public-pos/order/components/public-product-media.tsx src/features/public-pos/order/components/public-product-card.tsx src/features/public-pos/order/components/public-product-category-section.tsx src/features/public-pos/order/components/public-status-rail-section.tsx src/platform/electron/packaging-contract.test.ts src/platform/electron/next-server-contract.ts src/platform/electron/next-server-contract.test.ts src/platform/capacitor/online-shell-contract.ts src/platform/capacitor/online-shell-contract.test.ts src/lib/android-webview-compat.ts src/lib/android-webview-compat.test.ts src/lib/node-runtime-contract.test.ts src/lib/project-refactor-guards.test.ts
```

Expected: PASS. Do not run `eslint --fix` across the repository.

- [ ] **Step 4: Run repository-wide static and unit gates**

```powershell
npm run verify:node
npm run typecheck
npm test
npm run electron:build
```

Expected: PASS; baseline remains at least 91 Vitest files and 572 tests plus the new Phase 1 tests.

- [ ] **Step 5: Rebuild and smoke Web SSR plus standalone**

```powershell
npm run build
npm run electron:stage
npm run smoke:ssr
```

Expected: Next.js 16.2.10 Turbopack build PASS; standalone artifact and all five route/redirect checks PASS.

- [ ] **Step 6: Rebuild native delivery artifacts**

```powershell
npm run electron:pack:dir
npx cap sync android
Push-Location android
try {
  .\gradlew.bat assembleDebug
} finally {
  Pop-Location
}
```

Expected: unpacked Electron app and Android debug APK build successfully. Repeat the real Electron startup/customer-display/shutdown check from Task 4 and the Capacitor offline/error-path device check from Task 5.

- [ ] **Step 7: Inspect final diff and commit state**

```powershell
git diff --check
git status --short
git log --oneline -7
```

Expected: no whitespace errors; implementation files are committed; only the user's four pre-existing untracked paths remain. If `AGENTS.md`/`CLAUDE.md` approval is still pending, report that single explicit gate instead of claiming Phase 1 complete.

- [ ] **Step 8: Request code review before starting Phase 2**

Invoke `superpowers:requesting-code-review` and review the complete Phase 1 range against this plan and the approved design. Resolve verified Phase 1 findings with focused tests and a separate commit. Do not absorb the 56 known React 19 lint errors into this review; they are the first task of the separate Phase 2 plan.

---

## Out of Scope for This Plan

- React 19/Compiler lint debt: separate Phase 2 plan
- terminal states, destructive confirmation, unsaved changes, and broad accessibility: separate Phase 3 plan
- report store/component modularization: separate Phase 4 plan
- staff/public POS shared rule extraction: separate Phase 5 plan
- settings/branch/reference ownership: separate Phase 6 plan
- large-file/shared-capability relocation: separate Phase 7 plan
- broad internal naming and compatibility-re-export cleanup: separate Phase 8 plan
- full objective audit and dead-code removal: separate Phase 9 plan

Do not start a later phase merely because a nearby file is open; finish and review this deployable foundation first.
