# Responsive Protected Shell and Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้าง protected AppShell แบบ adaptive สำหรับ mobile, tablet และ desktop ให้ทุก protected route มี header และ navigation ที่สอดคล้องกัน พร้อมทำ Dashboard เป็นหน้าจอแรกที่ใช้ Quiet Service Ledger เต็มรูปแบบ และให้ปุ่ม refresh ใน header โหลดข้อมูลด้วย branch/filter ที่ apply ล่าสุดโดยไม่ล้าง draft filter

**Architecture:** คงเส้นทาง `protected layout → AuthGuard → AppShell → feature` เดิม แต่แยก AppShell ให้เป็น orchestration, header, rail, bottom navigation, navigation sheets และ page-owned refresh registry โดย navigation ทุกแบบใช้ permission-filtered menu tree ชุดเดียวกัน ส่วน Dashboard ยังเรียกข้อมูลผ่าน `DashboardPage → useDashboardStore.load → dashboard service` และเพิ่ม pure helpers สำหรับ request/reconciliation ที่ทดสอบได้ใน Node

**Tech Stack:** Next.js 16.2, React 19, TypeScript, Tailwind CSS v4, Zustand 5, shadcn/ui local primitives (new-york), Radix primitives ผ่าน `radix-ui`, Lucide, i18next และ Vitest แบบ Node environment

## Global Constraints

- Source of truth คือ `Design.md` และสเปกที่อนุมัติแล้ว: `docs/superpowers/specs/2026-07-27-responsive-protected-shell-dashboard-design.md`
- ขอบเขต shell ครอบเฉพาะ `src/app/(protected)/**`; ห้ามเปลี่ยน composition ของ `/login`, `/home`, `/policy`, public `/pos`, `/q/[token]` และ `/customer-display`
- Shared header และ navigation ต้องแสดงบน protected `/pos/tables` และ `/pos/order`; เนื้อหา POS ยังเป็น task-specific workspace ไม่ถูกแปลงเป็น management page
- Mobile ใช้ `<768px`, tablet/desktop เริ่มที่ `md` 768px และ desktop layout ใช้ `xl` 1280px; ห้ามเพิ่ม breakpoint สำหรับ device ใหม่
- Geometry ที่อนุมัติ: mobile header row 60px, tablet/desktop header row 64px, rail 210px/72px, mobile bottom navigation 64px บวก safe area
- Touch target ของ shell อย่างน้อย 44px และ Android production variant อย่างน้อย 48px; icon-only action ทุกปุ่มต้องมี localized `aria-label`, focus-visible state และ tooltip เมื่อ pointer รองรับ hover
- Mobile bottom navigation มี 5 ตำแหน่งคงที่: Dashboard, Tables, POS, Reports, More; availability และ Sheet content ต้อง derive จาก permission-filtered menu tree เดียวกับ rail
- POS destination ใช้ `usePosStore.tableUuid/tableName` กับ `orderCustomerUrl()` ที่มีอยู่; ถ้าไม่มี table ให้ไป `/pos/tables`
- Reports เปิด bottom Sheet เพราะไม่มี `/report` index; More เปิด complete permission-filtered tree; disabled item ยังแสดงพร้อมคำอธิบาย
- Dashboard เป็น feature เดียวใน phase นี้ที่ register shared-header refresh; ห้ามย้าย refresh ของทุก feature เข้าสู่ header
- Dashboard refresh ใช้ active branch, `appliedFilters`, language และ current top; ต้องไม่เรียก browser reload หรือ `router.refresh()` และต้องไม่แก้ `filters` draft ที่ยังไม่ apply
- Store ต้องเก็บข้อมูลเดิมขณะ refresh/error ตาม behavior ปัจจุบัน; initial load เท่านั้นที่ใช้ full Dashboard skeleton
- ใช้ semantic HSL triplets เพื่อคงรูปแบบ `hsl(var(--token))` และ Android WebView compatibility; ห้ามเพิ่มสี raw hex ใหม่ใน feature components
- หนึ่ง protected screen ต้องมี `<main>` เพียงหนึ่งตัว โดย `SidebarInset` เป็น main landmark และ content wrapper ภายในเป็น `<div>`
- ใช้ `internalRoute()` สำหรับ runtime-sourced menu paths; navigation จริงใช้ `Link`; Sheet trigger ใช้ `button`
- ห้ามเพิ่ม UI kit, state manager หรือ runtime dependency ที่ซ้ำกับ stack เดิม; official shadcn `Collapsible` ใช้ registry CLI และ package `radix-ui` ที่มีอยู่
- Route files ใต้ `src/app/` ต้องยังบาง; components ห้ามเรียก service โดยตรง; Dashboard เรียก action จาก Zustand store เท่านั้น
- TypeScript ห้าม `any`; props/models ใช้ `interface`; unions/aliases ใช้ `type`
- i18n ต้องเพิ่มทั้ง `public/locales/la/common.json` และ `public/locales/en/common.json`; Lao เป็นภาษาหลักและ label ต้องไม่ถูกตัดจนเข้าใจผิด
- ทุก code task ใช้ TDD เท่าที่ pure behavior ทดสอบได้: เพิ่ม focused test → ยืนยัน RED → เขียน minimal implementation → ยืนยัน GREEN → typecheck/lint ตามความเสี่ยง
- Component DOM tests ไม่ถูกเพิ่มใน phase นี้ เพราะ test suite ปัจจุบันเป็น Node; interaction/layout ตรวจด้วย browser skill
- ก่อนแก้ UI ให้อ่านและใช้ `frontend-design`, `shadcn`, `tailwind-4-docs` และ `vercel-react-best-practices`; ก่อนส่งมอบใช้ `web-design-guidelines`, `browser:control-in-app-browser` และ `superpowers:verification-before-completion`
- Worktree มี user changes อยู่แล้ว โดยเฉพาะ `src/components/layout/app-shell.tsx`, `src/lib/routes.ts`, permission files และ package files; บันทึก `git diff` ก่อนแก้ รักษาพฤติกรรม breadcrumb group ที่ไม่สร้างลิงก์ไป route 404 และ stage เฉพาะไฟล์/hunk ของ task นี้
- ทุก commit checkpoint ต้องรัน `git diff --cached --check` ก่อน commit และห้ามรวม `.env`, `.superpowers/`, `outputs/` หรือไฟล์ unrelated

## File and Responsibility Map

| Layer | Files | Responsibility |
| --- | --- | --- |
| Shell model | `src/components/layout/shell-navigation.ts` | Permission filtering, route matching, breadcrumb resolution, fixed/POS route mode, bottom-destination derivation และ report extraction แบบ pure |
| Refresh state | `src/components/layout/page-refresh-state.ts`, `page-refresh-context.tsx` | Stale-safe registration reducer, provider, registration hook และ header consumer |
| Shell orchestration | `src/components/layout/app-shell.tsx` | Store wiring, route mode, effective rail state, one-main composition และ shared data source |
| Shell presentation | `app-header.tsx`, `app-sidebar.tsx`, `app-breadcrumb.tsx` | Responsive header, accessible rail/collapsibles และ breadcrumb presentation |
| Mobile navigation | `app-bottom-nav.tsx`, `app-navigation-sheet.tsx` | Five fixed destinations, active marker, Reports Sheet, More Sheet และ safe-area handling |
| UI primitives/tokens | `src/components/ui/collapsible.tsx`, `button.tsx`, `sidebar.tsx`, `src/app/globals.css`, `src/app/layout.tsx` | Official primitives, touch sizes, semantic palette, shell geometry, dark mode และ browser theme color |
| POS adaptation | `src/features/pos/order-customer/order-customer-view.tsx`, `src/features/pos/table-selection/table-selection-page.tsx` | ตัด global controls ที่ซ้ำกับ shared header และเว้น mobile cart CTA เหนือ bottom nav |
| Dashboard state | `src/features/dashboard/overview/dashboard-view-model.ts`, `dashboard-page.tsx` | Request parameter builder, draft-safe filter reconciliation, refresh registration, error/retry wiring และ section order |
| Dashboard presentation | `components/dashboard-filters.tsx`, `components/dashboard-widgets.tsx`, `dashboard.css` | Mobile Drawer, desktop inline filters, quiet metric/ledger hierarchy และ responsive spacing |
| Localization | `public/locales/la/common.json`, `public/locales/en/common.json` | Bottom-nav, Sheet, refresh, rail, overflow และ accessibility labels |

---

### Task 1: Lock the permission-aware shell navigation model

**Files:**

- Create: `src/components/layout/shell-navigation.ts`
- Create: `src/components/layout/shell-navigation.test.ts`
- Verify: `src/config/menu.ts`
- Verify: `src/config/sidebar-permission-menu.ts`
- Verify: `src/features/pos/order-customer/menu-structure.ts`

**Interfaces:**

- Consumes: permission-filtered `MenuItem[]`, pathname, user status, current POS table identity
- Produces: filtered menu tree, breadcrumb trail, route mode, report children และ five `ShellDestinationState` records

- [ ] เพิ่ม RED tests สำหรับ role filtering, exact/prefix active matching, non-routable parent breadcrumb, fixed/POS route mode, report extraction, five destination order, current-table POS URL และ no-table fallback

```ts
it("keeps the POS destination distinct from Tables and resumes the current table", () => {
  const destinations = deriveShellDestinations({
    items: menuFixture,
    pathname: "/pos/order",
    tableName: "A 01",
    tableUuid: "table-1",
  });

  expect(destinations.map((item) => item.id)).toEqual([
    "dashboard",
    "tables",
    "pos",
    "reports",
    "more",
  ]);
  expect(destinations.find((item) => item.id === "tables")?.active).toBe(false);
  expect(destinations.find((item) => item.id === "pos")).toMatchObject({
    active: true,
    enabled: true,
    href: "/pos/order?table_uuid=table-1&table_name=A+01",
  });
});

it("does not turn permission API group paths into breadcrumb links", () => {
  const trail = resolveBreadcrumbs(
    [{
      path: "/report",
      title: "report_menu",
      children: [{ path: "/report/daily-sales", title: "daily_sales_report" }],
    }],
    "/report/daily-sales",
  );

  expect(trail).toEqual([
    { disabled: undefined, label: undefined, path: undefined, title: "report_menu" },
    {
      disabled: undefined,
      label: undefined,
      path: "/report/daily-sales",
      title: "daily_sales_report",
    },
  ]);
});
```

- [ ] รัน focused test และยืนยัน RED เพราะโมดูลยังไม่มี

```powershell
npx.cmd vitest run src/components/layout/shell-navigation.test.ts
```

- [ ] ย้าย pure navigation functions จาก `app-shell.tsx` และเพิ่ม contract ต่อไปนี้ โดยคง `item.children?.length ? undefined : item.path` สำหรับ breadcrumb parent

```ts
export const SHELL_DESTINATION_IDS = [
  "dashboard",
  "tables",
  "pos",
  "reports",
  "more",
] as const;

export type ShellDestinationId = (typeof SHELL_DESTINATION_IDS)[number];
export type ShellDestinationAction = "reports" | "more";

export interface ShellDestinationState {
  active: boolean;
  action?: ShellDestinationAction;
  enabled: boolean;
  href?: Route;
  id: ShellDestinationId;
}

export interface ShellRouteMode {
  fixedContent: boolean;
  mobileBackHref: Route | null;
  posWorkspace: boolean;
}

export function shellRouteIsActive(
  id: ShellDestinationId,
  pathname: string,
): boolean {
  if (id === "dashboard") return pathname === "/";
  if (id === "tables") return pathname === "/pos/tables";
  if (id === "pos") return pathname === "/pos/order";
  if (id === "reports") return pathname.startsWith("/report/");
  return false;
}
```

- [ ] ให้ `deriveShellDestinations()` ตรวจ availability ด้วย recursive path lookup ใน `items`, ให้ POS ใช้ permission เดียวกับ `/pos/tables`, ให้ Reports enabled เมื่อมี child ที่ไม่ disabled และให้ More enabled เมื่อ tree มี non-header item อย่างน้อยหนึ่งรายการ
- [ ] ให้ `reportMenuItems()` หา group ด้วย `title === "report_menu"` และคืน children ตามลำดับเดิมโดยไม่ลบ disabled items
- [ ] ให้ `shellRouteMode()` คืน `mobileBackHref: "/pos/tables"` เฉพาะ `/pos/order`, force `posWorkspace` สำหรับ protected POS สองหน้า และใช้ fixed path/prefix ชุดเดิมของ AppShell
- [ ] รัน focused test และ existing POS URL test ให้ GREEN

```powershell
npx.cmd vitest run src/components/layout/shell-navigation.test.ts src/features/pos/order-customer/order-customer-utils.test.ts
npm.cmd run typecheck
```

- [ ] Commit/checkpoint โดย stage เฉพาะสองไฟล์ใหม่

```powershell
git add -- src/components/layout/shell-navigation.ts src/components/layout/shell-navigation.test.ts
git diff --cached --check
git commit -m "test(shell): lock responsive navigation model"
```

---

### Task 2: Add a stale-safe page refresh registry

**Files:**

- Create: `src/components/layout/page-refresh-state.ts`
- Create: `src/components/layout/page-refresh-state.test.ts`
- Create: `src/components/layout/page-refresh-context.tsx`

**Interfaces:**

- Consumes: feature-owned callback, busy state, disabled state และ localized label
- Produces: one current `PageRefreshRegistration` for the shared header

- [ ] เพิ่ม RED reducer tests สำหรับ register, replace, matching unregister และ stale unregister ที่ห้ามลบ registration ใหม่

```ts
it("ignores an unregister event from a stale route registration", () => {
  const dashboard = registration("dashboard");
  const reports = registration("reports");
  const current = reducePageRefreshRegistration(
    reducePageRefreshRegistration(null, { type: "register", registration: dashboard }),
    { type: "register", registration: reports },
  );

  expect(
    reducePageRefreshRegistration(current, {
      type: "unregister",
      id: dashboard.id,
    }),
  ).toBe(reports);
});
```

- [ ] รัน focused test และยืนยัน RED

```powershell
npx.cmd vitest run src/components/layout/page-refresh-state.test.ts
```

- [ ] เขียน pure state contract และ reducer

```ts
export interface PageRefreshRegistration {
  busy: boolean;
  disabled: boolean;
  id: string;
  label: string;
  refresh: () => Promise<void> | void;
}

export type PageRefreshEvent =
  | { type: "register"; registration: PageRefreshRegistration }
  | { type: "unregister"; id: string };

export function reducePageRefreshRegistration(
  state: PageRefreshRegistration | null,
  event: PageRefreshEvent,
): PageRefreshRegistration | null {
  if (event.type === "register") return event.registration;
  return state?.id === event.id ? null : state;
}
```

- [ ] สร้าง provider และ hooks โดยให้ `usePageRefreshRegistration()` ใช้ `useId()` เป็น owner id, register ใน effect และ unregister id เดิมใน cleanup

```tsx
export interface UsePageRefreshRegistrationOptions {
  busy?: boolean;
  disabled?: boolean;
  label: string;
  onRefresh: () => Promise<void> | void;
}

export function usePageRefreshRegistration({
  busy = false,
  disabled = false,
  label,
  onRefresh,
}: UsePageRefreshRegistrationOptions) {
  const id = useId();
  const context = useContext(PageRefreshContext);

  useEffect(() => {
    context.register({
      busy,
      disabled,
      id,
      label,
      refresh: onRefresh,
    });
    return () => context.unregister(id);
  }, [busy, context, disabled, id, label, onRefresh]);
}
```

- [ ] ให้ `usePageRefreshAction()` throw ข้อความชัดเจนเมื่ออยู่นอก provider และคืน registration nullable เมื่ออยู่ใน provider
- [ ] รัน focused test, typecheck และ lint เฉพาะไฟล์

```powershell
npx.cmd vitest run src/components/layout/page-refresh-state.test.ts
npm.cmd run typecheck
npx.cmd eslint src/components/layout/page-refresh-state.ts src/components/layout/page-refresh-state.test.ts src/components/layout/page-refresh-context.tsx
```

- [ ] Commit/checkpoint

```powershell
git add -- src/components/layout/page-refresh-state.ts src/components/layout/page-refresh-state.test.ts src/components/layout/page-refresh-context.tsx
git diff --cached --check
git commit -m "feat(shell): add page refresh registry"
```

---

### Task 3: Establish Quiet Service Ledger tokens and shell geometry

**Files:**

- Create: `src/components/layout/design-token-contract.test.ts`
- Create: `src/components/ui/button.test.ts`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/layout/notification-menu.tsx`

**Interfaces:**

- Consumes: existing shadcn semantic token names and Android compatibility classes
- Produces: approved light/dark ledger palette, shell CSS variables, 44px default icon controls และ theme-color metadata

- [ ] เพิ่ม RED source-contract test สำหรับ exact approved colors และ button variant test สำหรับ 44px icon size

```ts
it("declares the approved ledger palette in light and dark modes", () => {
  const css = readFileSync(
    fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
    "utf8",
  );

  expect(css).toContain("--ledger-canvas: 42 38% 95%");
  expect(css).toContain("--ledger-surface: 38 100% 98%");
  expect(css).toContain("--ledger-ink: 30 12% 13%");
  expect(css).toContain("--ledger-brand-marker: 142 76% 36%");
  expect(css).toContain("--ledger-action: 142 72% 29%");
  expect(css).toContain("--ledger-error: 4 76% 40%");
  expect(css).toContain("--ledger-warning: 33 92% 33%");
  expect(css).toContain("--ledger-dark-canvas: 45 10% 8%");
  expect(css).toContain("--ledger-dark-brand: 142 71% 45%");
});

it("uses a 44px target for the default icon button", () => {
  expect(buttonVariants({ size: "icon" })).toContain("size-11");
});
```

- [ ] รัน focused tests และยืนยัน RED

```powershell
npx.cmd vitest run src/components/layout/design-token-contract.test.ts src/components/ui/button.test.ts
```

- [ ] เพิ่ม ledger variables แล้ว map semantic tokens ปัจจุบันเข้าหา variables เหล่านี้ โดยคงรูป `hsl(var(--token))` ใน `@theme`

```css
:root {
  --ledger-canvas: 42 38% 95%;
  --ledger-surface: 38 100% 98%;
  --ledger-ink: 30 12% 13%;
  --ledger-muted-ink: 36 7% 41%;
  --ledger-border: 37 21% 84%;
  --ledger-brand-marker: 142 76% 36%;
  --ledger-action: 142 72% 29%;
  --ledger-selected: 141 84% 93%;
  --ledger-error: 4 76% 40%;
  --ledger-warning: 33 92% 33%;
  --ledger-dark-canvas: 45 10% 8%;
  --ledger-dark-surface: 40 10% 11%;
  --ledger-dark-ink: 39 37% 93%;
  --ledger-dark-muted-ink: 33 12% 69%;
  --ledger-dark-border: 35 12% 20%;
  --ledger-dark-brand: 142 71% 45%;
  --ledger-dark-selected: 143 45% 16%;
  --ledger-dark-error: 6 100% 84%;
  --ledger-dark-warning: 36 85% 68%;
}
```

- [ ] Map อย่างน้อย `background`, `foreground`, `card`, `popover`, `muted`, `muted-foreground`, `accent`, `primary`, `destructive`, `border`, `input`, `ring`, `sidebar-*`, `success` และ `warning` ทั้ง light/dark; ห้ามลบ Android compatibility overrides เดิม
- [ ] เพิ่ม low-level shell variables และ fixed-content sizing โดยไม่ใส่ Dashboard selectors ใน globals

```css
:root {
  --app-shell-header-row-height: 4rem;
  --app-shell-header-height:
    calc(var(--app-shell-header-row-height) + env(safe-area-inset-top, 0px));
  --app-shell-rail-width: 13.125rem;
  --app-shell-rail-collapsed-width: 4.5rem;
  --app-shell-bottom-nav-height: 4rem;
  --app-shell-bottom-nav-total:
    calc(var(--app-shell-bottom-nav-height) + env(safe-area-inset-bottom, 0px));
}

@media (max-width: 767.98px) {
  :root {
    --app-shell-header-row-height: 3.75rem;
  }
}
```

- [ ] เปลี่ยน `buttonVariants({ size: "icon" })` เป็น `size-11`; ให้ shell ใช้ `icon` และห้ามขยาย `iconSm` แบบ global เพราะ dense non-shell controls อยู่นอกขอบเขตนี้
- [ ] เปลี่ยน status colors ที่แตะใน `notification-menu.tsx` จาก raw emerald/amber/red เป็น semantic `text-success`, `text-warning`, `text-destructive` และ background alpha ที่สัมพันธ์กัน
- [ ] เพิ่ม light/dark `themeColor` ใน exported `viewport` ของ `src/app/layout.tsx`

```ts
themeColor: [
  { color: "#F7F4ED", media: "(prefers-color-scheme: light)" },
  { color: "#171613", media: "(prefers-color-scheme: dark)" },
],
```

- [ ] รัน focused tests, typecheck และ lint

```powershell
npx.cmd vitest run src/components/layout/design-token-contract.test.ts src/components/ui/button.test.ts
npm.cmd run typecheck
npx.cmd eslint src/app/layout.tsx src/components/ui/button.tsx src/components/layout/notification-menu.tsx
```

- [ ] Commit/checkpoint โดยตรวจ diff ของ globals ว่าไม่มี public-route composition selector ถูกเพิ่ม

```powershell
git add -- src/app/globals.css src/app/layout.tsx src/components/ui/button.tsx src/components/ui/button.test.ts src/components/layout/notification-menu.tsx src/components/layout/design-token-contract.test.ts
git diff --cached --check
git commit -m "style(shell): add ledger tokens and responsive geometry"
```

---

### Task 4: Split AppShell into responsive header, rail, and one-main orchestration

**Files:**

- Create via shadcn registry: `src/components/ui/collapsible.tsx`
- Create: `src/components/layout/app-header.tsx`
- Create: `src/components/layout/app-sidebar.tsx`
- Create: `src/components/layout/app-breadcrumb.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/components/ui/sidebar.tsx`
- Modify: `public/locales/la/common.json`
- Modify: `public/locales/en/common.json`
- Verify: `src/components/layout/shell-navigation.test.ts`

**Interfaces:**

- Consumes: filtered menu tree, breadcrumb trail, route mode, auth/app/permission stores และ current refresh registration
- Produces: sticky safe-area header, accessible 210px/72px rail, effective 72px POS rail และ exactly one main landmark

- [ ] บันทึก pre-existing diffs ของ `app-shell.tsx`, locale files และ package files; รักษา breadcrumb behavior ที่ user แก้ไว้เมื่อตัด pure logic ออก

```powershell
git diff -- src/components/layout/app-shell.tsx public/locales/la/common.json public/locales/en/common.json package.json package-lock.json
```

- [ ] ใช้ shadcn skill ตรวจ registry component แล้วเพิ่ม official Collapsible แบบ dry-run ก่อน; package `radix-ui` มีอยู่แล้วจึงคาดว่าจะสร้าง source file โดยไม่เพิ่ม dependency

```powershell
npx.cmd shadcn@latest add collapsible --dry-run
npx.cmd shadcn@latest add collapsible
git diff -- src/components/ui/collapsible.tsx package.json package-lock.json
```

- [ ] หาก CLI แตะ package files นอกเหนือจาก dependency ที่จำเป็นจริง ให้รักษา user hunks เดิมและไม่ stage package files ใน checkpoint นี้
- [ ] ย้าย breadcrumb JSX ไป `AppBreadcrumb`; ใช้ `resolveBreadcrumbs()` จาก Task 1 และ localized `aria-label={t("app.breadcrumbs")}`
- [ ] ย้าย menu/profile presentation ไป `AppSidebar`; nested group ใช้ official `Collapsible`, `CollapsibleTrigger asChild`, `CollapsibleContent` และ `aria-expanded`

```tsx
<Collapsible
  open={openTitles.includes(item.title)}
  onOpenChange={(open) => setMenuOpen(item.title, open)}
>
  <CollapsibleTrigger asChild>
    <SidebarMenuButton
      aria-expanded={openTitles.includes(item.title)}
      isActive={hasActiveRoute(item, pathname)}
      tooltip={menuItemLabel(item, t)}
    >
      <MenuIcon item={item} />
      <span>{menuItemLabel(item, t)}</span>
      <ChevronDown data-icon="inline-end" />
    </SidebarMenuButton>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <SidebarMenuSub>{renderChildren(item.children)}</SidebarMenuSub>
  </CollapsibleContent>
</Collapsible>
```

- [ ] ย้าย header ไป `AppHeader`; mobile แสดง optional back, current title, registered refresh, notifications และ overflow เท่านั้น; desktop/tablet แสดง rail trigger, branch identity/breadcrumb, refresh, theme, notifications, language และ profile
- [ ] Mobile overflow ใช้ `DropdownMenuSub` สำหรับ Lao/English, store `toggleTheme`, edit-profile route และ logout; ห้าม nest `LanguageSwitch`/`ThemeToggle` dropdown ภายใน dropdown อีกชั้น
- [ ] Header refresh render เฉพาะเมื่อ registry ไม่เป็น null; busy ใช้ `RefreshCcw` animation ที่หยุดเมื่อ reduced motion และปุ่ม disabled ขณะ busy/disabled

```tsx
{refreshAction ? (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    aria-busy={refreshAction.busy}
    aria-label={refreshAction.label}
    disabled={refreshAction.busy || refreshAction.disabled}
    onClick={() => void refreshAction.refresh()}
  >
    <RefreshCcw
      className={cn(
        refreshAction.busy && "animate-spin motion-reduce:animate-none",
      )}
    />
  </Button>
) : null}
```

- [ ] ทำ `AppShell` เป็น orchestration เท่านั้น: derive menu หนึ่งครั้ง, resolve route mode/breadcrumbs, wrap ด้วย `PageRefreshProvider`, control `SidebarProvider` และส่ง props ไป presentation components

```tsx
const routeMode = shellRouteMode(pathname);
const effectiveCollapsed = routeMode.posWorkspace ? true : collapsed;

return (
  <PageRefreshProvider>
    <SidebarProvider
      className="app-protected-shell"
      open={!effectiveCollapsed}
      onOpenChange={(open) => {
        if (!routeMode.posWorkspace) setCollapsed(!open);
      }}
      style={{
        "--sidebar-width": "var(--app-shell-rail-width)",
        "--sidebar-width-icon": "var(--app-shell-rail-collapsed-width)",
      } as React.CSSProperties}
    >
      <a className="app-skip-link" href="#main-content">
        {t("app.skipToContent")}
      </a>
      <AppHeader routeMode={routeMode} />
      <AppSidebar menuItems={menuItems} pathname={pathname} />
      <SidebarInset id="main-content">
        <div
          className="app-shell-content"
          data-fixed-content={routeMode.fixedContent}
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  </PageRefreshProvider>
);
```

- [ ] ลบ nested `<main>` เดิม; fixed screen wrapper ใช้ height ที่หัก header และบน mobile หัก bottom-nav total หลัง Task 5
- [ ] ปรับ `SidebarProvider` default vars เป็น 210px/72px, row minimum 44px, active state เป็น 2px marker ไม่มี filled green tile และส่ง localized label ให้ `SidebarTrigger`/`SidebarRail`
- [ ] Wrap icon-only header actions ด้วย Tooltip ที่แสดงเฉพาะ media `(pointer: fine)`; mobile/touch ยังคงมี localized `aria-label` และ 44px target โดยไม่พึ่ง Tooltip
- [ ] เพิ่ม locale keys อย่างน้อย `app.currentPage`, `app.more`, `app.navigation`, `app.reportsNavigation`, `app.refreshingPage`, `app.profileMenu`, `app.languageLao`, `app.languageEnglish`
- [ ] รัน navigation tests, typecheck และ lint

```powershell
npx.cmd vitest run src/components/layout/shell-navigation.test.ts src/components/layout/page-refresh-state.test.ts
npm.cmd run typecheck
npx.cmd eslint src/components/layout/app-shell.tsx src/components/layout/app-header.tsx src/components/layout/app-sidebar.tsx src/components/layout/app-breadcrumb.tsx src/components/ui/sidebar.tsx src/components/ui/collapsible.tsx
```

- [ ] Commit/checkpoint โดย stage เฉพาะ shell, Collapsible และ locale hunks ที่เกี่ยวข้อง

```powershell
git add -- src/components/layout/app-shell.tsx src/components/layout/app-header.tsx src/components/layout/app-sidebar.tsx src/components/layout/app-breadcrumb.tsx src/components/ui/sidebar.tsx src/components/ui/collapsible.tsx public/locales/la/common.json public/locales/en/common.json
git diff --cached --check
git commit -m "refactor(shell): split adaptive header and rail"
```

---

### Task 5: Add mobile bottom navigation and permission-aware Sheets

**Files:**

- Create: `src/components/layout/app-bottom-nav.tsx`
- Create: `src/components/layout/app-navigation-sheet.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/app/globals.css`
- Modify: `public/locales/la/common.json`
- Modify: `public/locales/en/common.json`
- Modify: `src/components/layout/shell-navigation.test.ts`

**Interfaces:**

- Consumes: shared filtered menu tree, pathname และ current `usePosStore` table
- Produces: five mobile destinations, Reports Sheet, More Sheet, active marker และ safe-area content offset

- [ ] ขยาย RED tests ให้ยืนยัน destination ที่ permission ไม่มีอยู่ยังรักษาตำแหน่ง 5 ช่องแต่ `enabled: false`, Reports disabled เมื่อไม่มี usable report และ More tree รับ menu tree ชุดเดิมโดยไม่สร้าง route ใหม่

```ts
it("keeps five stable slots and disables destinations missing from permissions", () => {
  const destinations = deriveShellDestinations({
    items: [{ path: "/", title: "dashboard" }],
    pathname: "/",
    tableName: "",
    tableUuid: "",
  });

  expect(destinations).toHaveLength(5);
  expect(destinations.find((item) => item.id === "dashboard")?.enabled).toBe(true);
  expect(destinations.find((item) => item.id === "tables")?.enabled).toBe(false);
  expect(destinations.find((item) => item.id === "pos")?.enabled).toBe(false);
  expect(destinations.find((item) => item.id === "reports")?.enabled).toBe(false);
});
```

- [ ] รัน focused test และยืนยัน RED สำหรับ availability case ใหม่

```powershell
npx.cmd vitest run src/components/layout/shell-navigation.test.ts
```

- [ ] สร้าง `AppNavigationSheet` ด้วย shadcn `Sheet side="bottom"`; Reports render report children, More render complete permission-filtered tree; links ปิด Sheet หลัง navigation และ disabled rows ใช้ `aria-disabled` พร้อม `t("common.unavailable")`

```tsx
<SheetContent
  side="bottom"
  className="max-h-[80dvh] overscroll-contain rounded-t-2xl pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
>
  <SheetHeader>
    <SheetTitle>{title}</SheetTitle>
    <SheetDescription>{description}</SheetDescription>
  </SheetHeader>
  <nav aria-label={title} className="overflow-y-auto overscroll-contain">
    {children}
  </nav>
</SheetContent>
```

- [ ] สร้าง `AppBottomNav` ด้วย Lucide `LayoutDashboard`, `Table2`, `ShoppingCart`, `BarChart3`, `Menu`; link destinations ใช้ `Link`, sheet destinations ใช้ `button`, ทุก target สูงอย่างน้อย 44px
- [ ] ใช้ `deriveShellDestinations()` และ `usePosStore` selector; active state ใส่ `aria-current="page"` และ pseudo/child marker 2px ด้านบนโดยไม่เติมพื้นเขียวทั้งปุ่ม; destination ที่ disabled render เป็น disabled button พร้อมคำอธิบายและห้าม fallback ไป `/`

```tsx
if (destination.action) {
  return (
    <AppNavigationSheet
      action={destination.action}
      destination={destination}
      menuItems={menuItems}
      triggerIcon={Icon}
      triggerLabel={label}
    />
  );
}

if (!destination.enabled || !destination.href) {
  return (
    <button
      type="button"
      aria-disabled="true"
      disabled
      title={t("common.unavailable")}
      className="relative flex min-h-11 flex-col items-center justify-center gap-0.5"
    >
      <Icon />
      <span className="max-w-full truncate text-[11px] font-semibold">{label}</span>
    </button>
  );
}

return (
  <Link
    href={destination.href}
    aria-current={destination.active ? "page" : undefined}
    className="group relative flex min-h-11 flex-col items-center justify-center gap-0.5"
  >
    <span
      aria-hidden="true"
      className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-transparent group-aria-[current=page]:bg-success"
    />
    <Icon />
    <span className="max-w-full truncate text-[11px] font-semibold">{label}</span>
  </Link>
);
```

- [ ] Reports/More branches ต้อง render ผ่าน `SheetTrigger asChild` ก่อน branch link/disabled ด้านบน เพื่อไม่ตีความ action destination ว่าไม่มี `href` แล้วปิดใช้งาน

- [ ] Mount `AppBottomNav` ใน `AppShell` หลัง `SidebarInset`; CSS แสดงเฉพาะ `<768px`, fixed bottom, `z-40`, safe-area padding และไม่ render ใน public routesเพราะ component อยู่ใน protected shell
- [ ] เพิ่ม mobile main padding/fixed-height calculation

```css
@media (max-width: 767.98px) {
  .app-shell-content {
    padding-bottom: var(--app-shell-bottom-nav-total);
  }

  .app-shell-content[data-fixed-content="true"] {
    height:
      calc(100dvh - var(--app-shell-header-height) - var(--app-shell-bottom-nav-total));
    padding-bottom: 0;
    overflow: hidden;
  }
}
```

- [ ] เพิ่ม locale labels/descriptions สำหรับ Dashboard, Tables, POS, Reports, More, Reports Sheet, More Sheet และ disabled explanation ทั้ง Lao/English
- [ ] รัน tests, typecheck และ lint

```powershell
npx.cmd vitest run src/components/layout/shell-navigation.test.ts src/components/layout/page-refresh-state.test.ts src/features/pos/order-customer/order-customer-utils.test.ts
npm.cmd run typecheck
npx.cmd eslint src/components/layout/app-bottom-nav.tsx src/components/layout/app-navigation-sheet.tsx src/components/layout/app-shell.tsx
```

- [ ] Commit/checkpoint

```powershell
git add -- src/components/layout/app-bottom-nav.tsx src/components/layout/app-navigation-sheet.tsx src/components/layout/app-shell.tsx src/components/layout/shell-navigation.test.ts src/app/globals.css public/locales/la/common.json public/locales/en/common.json
git diff --cached --check
git commit -m "feat(shell): add mobile bottom navigation"
```

---

### Task 6: Adapt protected POS workspaces to the shared shell

**Files:**

- Modify: `src/features/pos/order-customer/order-customer-view.tsx`
- Modify: `src/features/pos/table-selection/table-selection-page.tsx`
- Modify: `src/app/globals.css`
- Verify: `src/features/pos/order-customer/order-customer-utils.test.ts`
- Verify: `src/components/layout/shell-navigation.test.ts`

**Interfaces:**

- Consumes: shared header/rail/bottom-nav geometry
- Produces: protected POS screens without duplicate global controls and mobile cart CTA above bottom navigation

- [ ] บันทึก screenshots/DOM structure ปัจจุบันของ `/pos/tables` และ `/pos/order` ก่อนแก้เพื่อเทียบว่า table, search, category, cart และ payment actions ยังอยู่ครบ
- [ ] ใน `order-customer-view.tsx` ลบ local back action, `LanguageSwitch` และ `ThemeToggle` ที่ซ้ำกับ shared header; คง employee sort, product search, category navigation, local data refresh และ cart actionเป็น workspace toolbar
- [ ] ใน `table-selection-page.tsx` ลบ local back, notification, language และ theme controls; คง clock, table filters และ local data refresh โดยลด toolbar เป็น 52–56px ไม่สร้าง global header ชั้นที่สอง
- [ ] ห้าม register POS refresh เข้าสู่ shared headerใน phase นี้; local refresh ยังเรียก `refreshAll()`/`load()` เดิมตาม exclusion ในสเปก
- [ ] ให้ management-screen rail preference ไม่เปลี่ยนเมื่อเข้า POS: `AppShell` force effective collapse เท่านั้นและห้ามเรียก `setCollapsed(true)` สำหรับ route POS
- [ ] เพิ่ม protected-shell override เฉพาะ floating mobile cart CTA; ห้ามเปลี่ยน root `--pos-system-bottom-safe-area` ที่ public POS/dialog portals ใช้

```css
@media (max-width: 767.98px) {
  .app-protected-shell .pos-safe-bottom-offset {
    bottom: calc(0.75rem + var(--app-shell-bottom-nav-total));
  }
}
```

- [ ] ตรวจ z-index ให้ cart CTA อยู่เหนือ content แต่ไม่บัง Sheet และไม่ทับ bottom navigation; focus order ต้องเป็น shared header → POS toolbar/content → bottom navigation
- [ ] รัน existing POS/helper tests, typecheck และ lint

```powershell
npx.cmd vitest run src/features/pos/order-customer/order-customer-utils.test.ts src/components/layout/shell-navigation.test.ts
npm.cmd run typecheck
npx.cmd eslint src/features/pos/order-customer/order-customer-view.tsx src/features/pos/table-selection/table-selection-page.tsx
```

- [ ] Commit/checkpoint

```powershell
git add -- src/features/pos/order-customer/order-customer-view.tsx src/features/pos/table-selection/table-selection-page.tsx src/app/globals.css
git diff --cached --check
git commit -m "style(pos): fit protected workspaces inside shared shell"
```

---

### Task 7: Register Dashboard refresh without losing draft filters

**Files:**

- Modify: `src/features/dashboard/overview/dashboard-view-model.ts`
- Modify: `src/features/dashboard/overview/dashboard-view-model.test.ts`
- Modify: `src/features/dashboard/overview/dashboard-page.tsx`
- Modify: `src/features/dashboard/overview/components/dashboard-widgets.tsx`
- Verify: `src/stores/dashboard-store.ts`

**Interfaces:**

- Consumes: active branch, applied filters, current language/top และ Dashboard store `load`
- Produces: exact refresh params, draft-safe response reconciliation, header registration และ inline retry

- [ ] เพิ่ม RED pure tests สำหรับ exact request params และ filter reconciliation ทั้งกรณี clean draft กับ dirty draft
- [ ] เพิ่ม local `dashboardFilters(startDate, endDate)` test factory ที่คืน `DashboardFilters` ครบทุก field เพื่อให้ test fixtures typed และอ่านง่าย

```ts
it("builds refresh params from the applied state", () => {
  expect(
    createDashboardRequestParams({
      branchUuid: "branch-1",
      filters: {
        end_date: "2026-07-27",
        periodMonth: 7,
        periodType: "daily",
        periodYear: 2026,
        start_date: "2026-07-01",
      },
      language: "la",
      top: "20",
    }),
  ).toEqual({
    branch_uuid_fk: "branch-1",
    end_date: "2026-07-27",
    lang: "la",
    start_date: "2026-07-01",
    top: "20",
  });
});

it("keeps unsaved draft dates when a refresh response reconciles applied dates", () => {
  const applied = dashboardFilters("2026-07-01", "2026-07-27");
  const draft = dashboardFilters("2026-06-01", "2026-06-30");
  const result = reconcileDashboardFilters({
    applied,
    draft,
    response: { start_date: "2026-07-01", end_date: "2026-07-27" },
  });

  expect(result.applied).toMatchObject({
    start_date: "2026-07-01",
    end_date: "2026-07-27",
  });
  expect(result.draft).toBe(draft);
});
```

- [ ] รัน focused test และยืนยัน RED

```powershell
npx.cmd vitest run src/features/dashboard/overview/dashboard-view-model.test.ts
```

- [ ] ย้าย `filtersFromRequestParams()` และ `filtersKey()` จาก page ไป view model แล้วเพิ่ม contracts ต่อไปนี้

```ts
export interface CreateDashboardRequestParamsInput {
  branchUuid: string;
  filters: DashboardFilters;
  language: string;
  top: string;
}

export interface ReconcileDashboardFiltersInput {
  applied: DashboardFilters;
  draft: DashboardFilters;
  response: Pick<DashboardFilters, "end_date" | "start_date">;
}

export interface ReconciledDashboardFilters {
  applied: DashboardFilters;
  draft: DashboardFilters;
}
```

- [ ] ให้ `reconcileDashboardFilters()` merge backend dates เข้า applied เสมอ แต่ merge เข้า draft เฉพาะเมื่อ `filtersKey(draft) === filtersKey(applied)` ก่อน response
- [ ] เปลี่ยน `DashboardPage.load()` ให้สร้าง params ด้วย `createDashboardRequestParams()` และเพิ่ม stable `refreshDashboard` ที่เรียก `load(appliedFilters, top)`
- [ ] Register refresh หลังสร้าง callback; label ใช้ i18n, busy ใช้ `loading`, disabled เมื่อไม่มี active branch

```tsx
const refreshDashboard = useCallback(
  () => load(appliedFilters, top),
  [appliedFilters, load, top],
);

usePageRefreshRegistration({
  busy: loading,
  disabled: !activeBranchUuid,
  label: t("dashboard.refreshDashboard"),
  onRefresh: refreshDashboard,
});
```

- [ ] เปลี่ยน response sync เดิมให้ใช้ `reconcileDashboardFilters()` ภายใน `useResetOnDeps`; ห้ามให้ refresh/top/language change เขียนทับ dirty draft
- [ ] ขยาย `ErrorBanner` ให้รับ `actionLabel`/`onAction`, ใช้ semantic Alert presentation และแสดง retry แบบ inline; Dashboard error retry เรียก `refreshDashboard`, branch error retry เรียก `loadBranches(storeUuid, userBranchUuid)`
- [ ] คง initial-load guard เดิมที่คืน `LoadingState` เมื่อ `loading && !data`; เมื่อมี data แล้ว refresh ห้ามแทนหน้าด้วย skeleton หรือ clear cards
- [ ] รัน focused tests, chart boundary, refresh reducer, typecheck และ lint

```powershell
npx.cmd vitest run src/features/dashboard/overview/dashboard-view-model.test.ts src/features/dashboard/overview/dashboard-chart-boundary.test.ts src/components/layout/page-refresh-state.test.ts
npm.cmd run typecheck
npx.cmd eslint src/features/dashboard/overview/dashboard-page.tsx src/features/dashboard/overview/dashboard-view-model.ts src/features/dashboard/overview/components/dashboard-widgets.tsx
```

- [ ] Commit/checkpoint

```powershell
git add -- src/features/dashboard/overview/dashboard-view-model.ts src/features/dashboard/overview/dashboard-view-model.test.ts src/features/dashboard/overview/dashboard-page.tsx src/features/dashboard/overview/components/dashboard-widgets.tsx
git diff --cached --check
git commit -m "feat(dashboard): add draft-safe header refresh"
```

---

### Task 8: Reshape Dashboard content and responsive filters

**Files:**

- Create: `src/features/dashboard/overview/components/dashboard-filters.tsx`
- Modify: `src/features/dashboard/overview/dashboard-view-model.ts`
- Modify: `src/features/dashboard/overview/dashboard-view-model.test.ts`
- Modify: `src/features/dashboard/overview/components/dashboard-widgets.tsx`
- Modify: `src/features/dashboard/overview/dashboard-page.tsx`
- Modify: `src/features/dashboard/overview/dashboard.css`
- Modify: `public/locales/la/common.json`
- Modify: `public/locales/en/common.json`
- Verify: `src/features/dashboard/overview/dashboard-chart-boundary.test.ts`

**Interfaces:**

- Consumes: existing Dashboard copy/model/filter props
- Produces: mobile filter Drawer, tablet/desktop inline filter bar และ approved information order with quiet ledger styling

- [ ] เพิ่ม pure assertion ใน view-model test ว่า filter summary ใช้ applied branch/date context ไม่ใช้ dirty draft; หาก summary helper ยังไม่มีให้เพิ่ม `dashboardFilterSummary()` เป็น pure export

```ts
it("summarizes the applied date range independently from draft filters", () => {
  expect(
    dashboardFilterSummary({
      branchLabel: "Vientiane 1",
      filters: dashboardFilters("2026-07-01", "2026-07-27"),
    }),
  ).toBe("Vientiane 1 · 2026-07-01 – 2026-07-27");
});
```

- [ ] รัน focused test และยืนยัน RED

```powershell
npx.cmd vitest run src/features/dashboard/overview/dashboard-view-model.test.ts
```

- [ ] ย้าย existing `DashboardFilterBar` ออกจาก `dashboard-widgets.tsx` ไป `dashboard-filters.tsx`; แยก fields ออกจาก actions เพื่อใช้ form ชุดเดียวทั้ง inline และ Drawer

```ts
export interface DashboardFilterFieldsProps {
  activeBranchUuid: string;
  branchLoading: boolean;
  branchOptions: SelectOption[];
  copy: DashboardCopy;
  filters: DashboardFilters;
  monthOptions: SelectOption[];
  onBranchChange: (value: string) => void;
  onFilterChange: (patch: Partial<DashboardFilters>) => void;
  onPeriodMonthChange: (value: string) => void;
  onPeriodTypeChange: (value: string) => void;
  onPeriodYearChange: (value: string) => void;
  periodTypeOptions: SelectOption[];
  yearOptions: SelectOption[];
}

export interface DashboardResponsiveFiltersProps
  extends DashboardFilterFieldsProps {
  loading: boolean;
  onApply: () => void;
  onReset: () => void;
  summary: string;
}
```

- [ ] Mobile `<md` แสดง compact context button แล้วเปิด shadcn `Drawer`; Apply เรียก `onApply()` แล้วปิด, Reset เรียก `onReset()` โดยคง Drawer เปิดให้ตรวจค่า, Cancel ปิดโดยไม่ apply และ draft state ยังอยู่
- [ ] Tablet/desktop `md+` แสดง inline filter surface; controls wrap เป็นสองแถวเมื่อพื้นที่ไม่พอและห้ามสร้าง horizontal document scroll
- [ ] เปลี่ยน composition order ใน `DashboardPage` เป็น:
  1. `DashboardHeader`
  2. `DashboardResponsiveFilters`
  3. branch/dashboard inline errors และ no-data state
  4. `DashboardHeroStrip`
  5. `DashboardPaymentSummaryStrip`
  6. `DashboardRevenueAccountingGrid`
  7. `DashboardOperationsGrid`
  8. `DashboardProductsParetoGrid`
  9. `DashboardFooter`
- [ ] Refactor `dashboard.css` ให้ใช้ semantic tokens: flat surfaces, 1px borders, radius 12–16px, no decorative gradients/heavy shadows, 16px mobile margin, 24–32px tablet/desktop padding, 12px mobile gap และ 16px larger gap
- [ ] Mobile metrics ใช้ labelled rows/compact two-column blocksแทนการบีบ desktop grid; chart sections มี minimum readable height และ legend wrap; top-products rows ไม่เกิด horizontal scroll
- [ ] Dark mode ใช้ token hierarchy เดียวกัน; success/warning/error ทุกจุดมี icon/text เพิ่มจากสี; refresh state ไม่ทำ layout shift
- [ ] เพิ่ม filter Drawer title/description/summary labels และ Dashboard refresh labelทั้ง Lao/English
- [ ] รัน focused Dashboard tests, typecheck และ lint

```powershell
npx.cmd vitest run src/features/dashboard/overview/dashboard-view-model.test.ts src/features/dashboard/overview/dashboard-chart-boundary.test.ts
npm.cmd run typecheck
npx.cmd eslint src/features/dashboard/overview/dashboard-page.tsx src/features/dashboard/overview/components/dashboard-filters.tsx src/features/dashboard/overview/components/dashboard-widgets.tsx
```

- [ ] Commit/checkpoint

```powershell
git add -- src/features/dashboard/overview/components/dashboard-filters.tsx src/features/dashboard/overview/components/dashboard-widgets.tsx src/features/dashboard/overview/dashboard-page.tsx src/features/dashboard/overview/dashboard-view-model.ts src/features/dashboard/overview/dashboard-view-model.test.ts src/features/dashboard/overview/dashboard.css public/locales/la/common.json public/locales/en/common.json
git diff --cached --check
git commit -m "style(dashboard): apply responsive ledger layout"
```

---

### Task 9: Run full verification and responsive interaction review

**Files:**

- Verify all files changed in Tasks 1–8
- Modify only files required to fix failures found by this task

**Automated evidence:**

- [ ] Run all focused suites together

```powershell
npx.cmd vitest run src/components/layout/shell-navigation.test.ts src/components/layout/page-refresh-state.test.ts src/components/layout/design-token-contract.test.ts src/components/ui/button.test.ts src/features/dashboard/overview/dashboard-view-model.test.ts src/features/dashboard/overview/dashboard-chart-boundary.test.ts src/features/pos/order-customer/order-customer-utils.test.ts
```

- [ ] Run repository-wide tests, typecheck และ lint; บันทึก exact failing file หากมี pre-existing failure และห้ามอ้างว่า pass จน command exit 0

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run lint
```

**Browser and accessibility evidence:**

- [ ] ใช้ browser skill เปิด authenticated protected app และตรวจ 393×852, 768px, 1024×1366, 1280px และ 1440px ทั้ง light/dark
- [ ] ในทุก width ยืนยัน `document.querySelectorAll("main").length === 1` และ `document.documentElement.scrollWidth <= document.documentElement.clientWidth`
- [ ] ที่ 393×852 ยืนยัน header ไม่ล้น, bottom nav มี 5 ช่อง, active marker 2px, Reports/More Sheet เปิด-ปิดและคืน focus, content/CTA ไม่ถูก safe area หรือ nav บัง
- [ ] ที่ 768/1024/1280/1440 ยืนยัน rail 210px/72px, collapse persistence, nested `aria-expanded`, breadcrumb ไม่ link group route, header target อย่างน้อย 44px และ POS force compact railโดยไม่เปลี่ยน persisted preference
- [ ] ใช้ keyboard เท่านั้นตรวจ skip link, header, rail, Dashboard filters, Drawer/Sheets และ bottom nav; focus ต้องมองเห็นและ modal focus ต้องไม่หลุด
- [ ] เปิด reduced motion แล้ว refresh Dashboard; icon ห้ามหมุนต่อเมื่อ reduced motion และไม่มี content flash/layout shift
- [ ] แก้ draft filter โดยไม่กด Apply แล้วกด header refresh; ยืนยัน request ใช้ applied dates/branch/top และ draft inputs ยังเป็นค่าที่แก้อยู่
- [ ] ทำ Dashboard request fail หลังมี data; ยืนยัน data/branch/applied/draft คงอยู่, inline error แสดง และ retry สำเร็จได้
- [ ] ตรวจ protected `/pos/tables` และ `/pos/order`: shared header แสดง, local global controls ไม่ซ้ำ, search/category/cart/payment ใช้งานได้ และ mobile cart CTA อยู่เหนือ bottom nav
- [ ] Regression check `/products`, `/sales/sales-list`, อย่างน้อยหนึ่ง `/settings/*`, อย่างน้อยหนึ่ง `/report/*`, public `/pos`, `/q/[token]`, `/login` และ `/customer-display`
- [ ] ตรวจ Lao-first labels ที่ 393px, Android 48px overrides, Electron window resize และ dark-mode contrast ตาม `web-design-guidelines`

**Final checkpoint:**

- [ ] ตรวจ diff/stat และค้นหา unsafe route cast, browser reload และ raw feature colors

```powershell
git diff --check
rg -n "as Route|window\\.location\\.reload|router\\.refresh" src/components/layout src/features/dashboard/overview
rg -n "#[0-9A-Fa-f]{6}" src/components/layout src/features/dashboard/overview
git status --short
```

- [ ] ถ้า Task 9 ต้องแก้โค้ด ให้ rerun command ที่เกี่ยวข้อง, stage ด้วย explicit paths ของไฟล์ที่ Task 9 แก้จริง, รัน `git diff --cached --check` และ commit message `fix(shell): close responsive verification gaps`; ถ้าไม่มี diff ใหม่ไม่ต้องสร้าง empty commit

- [ ] ใช้ `superpowers:verification-before-completion` ตรวจ evidence ชุดสุดท้ายก่อนรายงานว่าเสร็จ
