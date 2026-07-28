# Feature 27 Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แก้ Product Import และ production blockers บน `feature-27`, ตรวจ production build แล้วใช้ `ship-feature` รวมเข้า `feature` และเปิด `feature-28`

**Architecture:** Product Import แยกเป็น pure analysis, reference plan และ execution state ที่ test ได้; side effects ยังผ่าน Zustand store → service. Permission menu ใช้ exact-role/same-key cache แบบ fail closed และล้าง local artifacts ก่อน final `git add .`

**Tech Stack:** Next.js 16, React 19, TypeScript, Zustand, Vitest, Tailwind CSS v4, i18next และ Electron

## Global Constraints

- Source of truth: `docs/superpowers/specs/2026-07-28-feature-27-production-hardening-design.md`
- ใช้ TDD: test ใหม่ต้อง fail ด้วยเหตุผลที่คาดไว้ก่อนแก้ production code
- ห้ามเพิ่ม dependency/backend endpoint และห้ามใช้ `any`
- Components เรียก store actions; store/service รับผิดชอบ side effects
- Category ชื่อเดียวกันข้าม Default Group เป็น conflict; ห้าม reuse หรือสร้างซ้ำ
- ไม่ทำ mobile-native implementation ก่อนเปิด `feature-28`
- Stage เฉพาะไฟล์ของแต่ละ task และรักษา user changes ที่ไม่เกี่ยวข้อง

---

### Task 1: Workbook analysis, boundaries และ duplicate protection

**Files:** `src/features/product/list/product-import-utils.ts`, `product-import-utils.test.ts`

**Produces:**

```ts
export interface ProductImportDraftDetail {
  rowNumber: number;
  referenceName: string;
  costPrice: number;
  salePrice: number;
}

export interface ProductImportAnalysisInput {
  workbook: ProductImportWorkbookRows;
  branchUuid: string;
  existingProducts: Product[];
  generatedCodeSeed: string;
}

export interface ProductImportAnalysis {
  drafts: ProductImportDraft[];
  referenceNames: ProductImportReferenceNames;
}

export function normalizeProductImportKey(value: unknown): string;
export function analyzeProductImportWorkbook(
  input: ProductImportAnalysisInput,
): ProductImportAnalysis;
```

`ProductImportDraft` เก็บ `details`, `validationErrors`, `warnings`, `payload`, `executionStatus: "pending" | "succeeded" | "failed"` และ `executionError`

- [ ] **RED:** เพิ่ม tests ด้วย `sheetRowsFromAoA()` ให้พิสูจน์ว่า code/name ที่กรอกตรงเริ่ม product ใหม่, แถวที่ code+name ว่างเท่านั้นจึง inherit product fields, detail fields ไม่ inherit, NFKC keys เท่ากัน, duplicate code/name ใน workbook/DB เป็น error และ generated code ไม่ชน used codes

```powershell
npm.cmd test -- src/features/product/list/product-import-utils.test.ts
```

Expected: FAIL ที่ boundary/NFKC/duplicate assertions ใหม่

- [ ] **GREEN:** ใช้ normalization `NFKC → collapse whitespace → trim → lowercase`; reserve codes ใน `Set`; สร้าง `referenceNames` จาก drafts ที่ไม่มี `validationErrors` เท่านั้น

- [ ] **Verify + commit:**

```powershell
npm.cmd test -- src/features/product/list/product-import-workbook.test.ts src/features/product/list/product-import-utils.test.ts
git add src/features/product/list/product-import-utils.ts src/features/product/list/product-import-utils.test.ts
git commit -m "fix(product): validate import workbook identities"
```

### Task 2: Reference planning และ cross-group conflict

**Files:** `src/stores/product-store/import-references.ts`, `import-references.test.ts`, Product Import utils/tests, `src/services/{category,group,size,unit}.ts`, `src/lib/category-defaults.ts`, `src/features/settings/category/category-icons.ts`

**Produces:**

```ts
export interface ProductImportReferencePlanInput
  extends ProductImportReferenceNames {
  defaultGroupName: string;
  groups: Group[];
  categories: Category[];
  units: Unit[];
  normalSizes: Size[];
  setSizes: Size[];
}

export interface ProductImportReferenceConflict {
  kind: "group" | "category" | "unit" | "normalSize" | "setSize";
  name: string;
  reason: "ambiguous" | "category-group-mismatch";
}

export interface ProductImportReferencePlan {
  group: { action: "reuse" | "create"; name: string; uuid?: string } | null;
  conflicts: ProductImportReferenceConflict[];
  createCategories: string[];
  createUnits: string[];
  createNormalSizes: string[];
  createSetSizes: string[];
}

export function planProductImportReferences(
  input: ProductImportReferencePlanInput,
): ProductImportReferencePlan;

export async function ensureProductImportReferences(
  input: { storeUuid: string; language: string; plan: ProductImportReferencePlan },
  deps?: ProductImportReferenceDependencies,
): Promise<ProductImportResolvedReferences>;
```

- [ ] **RED:** tests ต้องครอบคลุม unique reuse, ambiguous reference, Category same-name/different-group conflict, Group ไม่ถูกสร้างเมื่อไม่มี missing valid Category, invalid drafts ไม่เข้า plan และ Normal/Set sizes เป็นคนละ namespace

```powershell
npm.cmd test -- src/stores/product-store/import-references.test.ts src/features/product/list/product-import-utils.test.ts
```

- [ ] **GREEN:** planner ไม่มี side effect; resolver สร้างเฉพาะ `create*`, ทำ Group ก่อน Category และ assert UUID หลัง create/refetch. Shared default icon ย้ายไป `src/lib/category-defaults.ts`

- [ ] **Verify + commit:**

```powershell
npm.cmd test -- src/stores/product-store/import-references.test.ts src/features/product/list/product-import-utils.test.ts
npm.cmd run typecheck
git add src/stores/product-store/import-references.ts src/stores/product-store/import-references.test.ts src/features/product/list/product-import-utils.ts src/features/product/list/product-import-utils.test.ts src/services/category.ts src/services/group.ts src/services/size.ts src/services/unit.ts src/lib/category-defaults.ts src/features/settings/category/category-icons.ts
git commit -m "fix(product): plan import references safely"
```

### Task 3: Idempotent execution, retry และ UI synchronization

**Files:** create `src/stores/product-store/import-execution.ts` + test; modify `src/stores/product-store.ts`, Product Import workflow/dialog และ EN/LA locales

**Produces:**

```ts
export interface ProductImportExecutionResult {
  /** Cumulative union of alreadySucceeded and successes from this attempt. */
  succeededKeys: string[];
  failures: Record<string, string>;
}

export async function executeProductImportDrafts(
  drafts: ProductImportDraft[],
  alreadySucceeded: ReadonlySet<string>,
  save: (payload: SaveProductInput) => Promise<Product>,
): Promise<ProductImportExecutionResult>;
```

Product store เพิ่ม `loadAllForImport(params: FetchProductsParams): Promise<Product[]>` ซึ่งใช้ `limit: "All"` โดยไม่แทน visible list state

- [ ] **RED:** จำลอง first success/second fail แล้ว retry; assert ว่า success ไม่ถูกส่งซ้ำ, failed ถูกส่งครั้งเดียวในรอบถัดไป, validation conflict ไม่ถูก save และ mixed result ไม่เป็น full success

```powershell
npm.cmd test -- src/stores/product-store/import-execution.test.ts
```

- [ ] **GREEN:** workflow เป็น `load context → analyze → plan → preview → ensure refs → rebuild/UUID assert → execute unsucceeded → refresh`. Refresh Groups, Categories, Units, Normal/Set Sizes และ Products หลัง mutation

- [ ] **UI/localization:** modal แสดง `ready`, `will-create`, `conflict`, `succeeded`, `failed`; execution error แยกจาก validation error; Import count ไม่นับ succeeded; partial result ใช้ warning copy

- [ ] **Verify + commit:**

```powershell
npm.cmd test -- src/features/product/list/product-import-utils.test.ts src/features/product/list/product-import-workbook.test.ts src/stores/product-store/import-references.test.ts src/stores/product-store/import-execution.test.ts src/services/product/payload.test.ts
npm.cmd run typecheck
git add src/stores/product-store/import-execution.ts src/stores/product-store/import-execution.test.ts src/stores/product-store.ts src/features/product/list/use-product-list-workflow.ts src/features/product/list/product-import-dialog.tsx public/locales/en/common.json public/locales/la/common.json
git commit -m "fix(product): make import retry idempotent"
```

### Task 4: Permission navigation fail closed

**Files:** `src/services/permissions/sidebar.ts` + test, `src/stores/permissions-sidebar-store.ts` + test, `src/components/layout/app-shell.tsx`, EN/LA locales

- [ ] **RED:** requested role ไม่พบต้องคืน `[]`; loading/empty/error ที่ไม่มี same-key cache ต้องไม่เห็น static menu; cache คนละ store/role/language ห้าม reuse; matching cache ใช้ต่อได้และ Retry เรียก load key เดิม

```powershell
npm.cmd test -- src/services/permissions/sidebar.test.ts src/stores/permissions-sidebar-store.test.ts
```

- [ ] **GREEN:** ลบ `roles[0]` และ authenticated static fallback. AppShell แสดง skeleton ระหว่าง initial load และ localized unavailable + Retry เมื่อไม่มี matching cache

- [ ] **Verify + commit:**

```powershell
npm.cmd test -- src/services/permissions/sidebar.test.ts src/stores/permissions-sidebar-store.test.ts
npm.cmd run typecheck
git add src/services/permissions/sidebar.ts src/services/permissions/sidebar.test.ts src/stores/permissions-sidebar-store.ts src/stores/permissions-sidebar-store.test.ts src/components/layout/app-shell.tsx public/locales/en/common.json public/locales/la/common.json
git commit -m "fix(permissions): fail closed on menu errors"
```

### Task 5: Safe internal routes และ meaningful breadcrumbs

**Files:** `src/lib/routes.ts` + test; create `src/components/layout/shell-breadcrumbs.ts` + test; modify AppShell

**Produces:**

```ts
export function isSafeInternalPath(path: string): boolean;
export function resolveShellBreadcrumbs(
  items: MenuItem[],
  pathname: string,
): BreadcrumbTrailItem[] | null;
```

- [ ] **RED:** `internalRoute("/\\evil.com")` และ control-character paths คืน `/`; legacy aliases ยังผ่าน; `/settings/category` มี clickable `/settings`; `/report/*` และ `/sale/*` group breadcrumb ไม่มี href

```powershell
npm.cmd test -- src/lib/routes.test.ts src/components/layout/shell-breadcrumbs.test.ts
```

- [ ] **GREEN:** รับเฉพาะ path ที่ขึ้นต้น `/` ตัวเดียวและไม่มี `\`/Unicode control characters; breadcrumb ใช้ explicit non-page group set `"/sale" | "/cancel" | "/report"` แทน `children.length`

- [ ] **Verify + commit:**

```powershell
npm.cmd test -- src/lib/routes.test.ts src/components/layout/shell-breadcrumbs.test.ts src/services/permissions/sidebar.test.ts
npm.cmd run typecheck
git add src/lib/routes.ts src/lib/routes.test.ts src/components/layout/shell-breadcrumbs.ts src/components/layout/shell-breadcrumbs.test.ts src/components/layout/app-shell.tsx
git commit -m "fix(routing): reject unsafe internal paths"
```

### Task 6: Repository cleanup และ reconcile retained work

**Files:** `.gitignore`, Tailwind `docs-source.txt`, old responsive spec/new plan, package files, chart, settings controller/store form; delete stale `shell-navigation.*` และ local generated directories

- [ ] **Ignore ก่อนลบ:**

```gitignore
.superpowers/
.claude/skills/tailwind-4-docs/references/docs/
.claude/skills/tailwind-4-docs/references/docs-index.tsx
outputs/????????-????-????-????-????????????/
```

คืน `docs-source.txt` เป็น `Status: Not initialized`; revert Recharts/Immer/Reselect lock entries เป็น `HEAD` (`recharts ^3.8.1`) โดยไม่เปลี่ยน dependency อื่น

- [ ] **ลบ generated data อย่างปลอดภัย:** resolve และยืนยันว่า targets ต่อไปนี้อยู่ใต้ `D:\Projects\www.yummy-go.com` ก่อนใช้ `Remove-Item -LiteralPath`: `.superpowers/`, Tailwind `references/docs/`, `docs-index.tsx`, `outputs/019fa13a-f306-7a91-9cd2-d13657d7b188/`. ห้ามแตะ `outputs/menu-units` หรือ tracked fixtures

- [ ] **Reconcile mobile docs:** ลบ unintegrated fixed `shell-navigation.ts/test`; mark old responsive design `Superseded`; แก้ mobile plan ให้สร้าง permission-aware model บน `feature-28`; คง page-refresh foundation

- [ ] **Retained fixes:** คง chart size guard กับ Recharts 3.8.1, settings request-param stabilization และ store/branch mount reset; แก้ indentation แล้วตรวจ:

```powershell
npm.cmd test -- src/hooks/use-reset-on-change.test.ts src/features/landing/scene-quality.test.ts
npm.cmd run typecheck
npm.cmd run lint
```

- [ ] **Commit:**

```powershell
git add .gitignore .claude/skills/tailwind-4-docs/references/docs-source.txt docs/superpowers/specs/2026-07-27-responsive-protected-shell-dashboard-design.md docs/superpowers/plans/2026-07-27-responsive-protected-shell-dashboard.md package.json package-lock.json src/components/layout/shell-navigation.ts src/components/layout/shell-navigation.test.ts src/components/ui/chart.tsx src/features/settings/shared/use-settings-crud-controller.ts src/features/settings/store-branch/store-branch-form.tsx
git commit -m "chore(feature-27): remove local artifacts and stale shell model"
```

### Task 7: Full verification, review และ `ship-feature`

- [ ] **Artifact/diff gate:**

```powershell
git status --short
git diff --check
git ls-files | Select-String -Pattern '(^|/)\.superpowers/|references/docs/|outputs/[0-9a-f-]{36}/'
```

Expected: ไม่มี secret/generated paths และไม่มี unstaged implementation file

- [ ] **Full verification:**

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run electron:build
npm.cmd run smoke:ssr
```

ทุกคำสั่งต้อง exit `0`

- [ ] **Review gate:** ใช้ `superpowers:requesting-code-review` ตรวจ `d3fea7b..HEAD`; แก้ Critical/Important findings ด้วย TDD และรัน full verification ใหม่

- [ ] **Ship:** ตรวจว่า current branch คือ `feature-27` แล้ว invoke `ship-feature`. หาก push/pull/merge fail ให้หยุดทันที; ห้าม force-push หรือแก้ conflict อัตโนมัติ

- [ ] **Final state:**

```powershell
git branch --show-current
git status --short
git log --oneline --decorate -5
```

Expected: current branch `feature-28`, worktree clean และ `feature-27` ถูกรวม/ลบ local+remote
