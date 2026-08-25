# Capacitor Native Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Capacitor app its own navigation shell — bottom nav on phone, side rail on tablet, native-style top bar — while the web/Electron app keeps its existing sidebar shell unchanged at every viewport width.

**Architecture:** Split `AppShell` into `layout/web/app-shell.tsx` (existing markup, unchanged) and a new `layout/capacitor/app-shell.tsx`, both fed by one extracted data hook so there is a single permission-menu/breadcrumb code path. `src/app/(protected)/layout.tsx` picks between them with `useIsCapacitorNativeApp()`. Navigation content is derived from the live permission menu (first 3 items direct, rest under "More") — never a hard-coded path list.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Zustand, local shadcn/ui primitives, i18next, `motion`, Capacitor 8 (`@capacitor/app` already installed).

**Spec:** `docs/superpowers/specs/2026-08-25-capacitor-native-shell-design.md`

## Global Constraints

- Communicate with the user in Thai only. Code, paths, identifiers, and commands stay English.
- TypeScript: never `any`; `interface` for props/models; `type` for unions/aliases; `as const` over enums.
- No new UI kit, state manager, animation, or navigation dependency. `motion` and `@capacitor/app` are already installed; `accordion` is the only shadcn component to add, via `npx shadcn@latest add accordion`.
- Runtime-sourced paths go through `internalRoute()` (`src/lib/routes.ts`). Never `as Route` at a call site.
- Preserve dark mode in everything touched. Use semantic tokens; no raw colors.
- Touch targets: at least 44px; Capacitor Android at least 48px.
- Lao (`la`) and English (`en`) strings must both be added for every new user-facing string. Lao is the primary language.
- Tests are colocated `.test.ts`, node environment, pure logic only — never component tests.
- Do NOT modify anything under `.claude/ExampleApp/` — it is read-only reference material.
- Do NOT redesign any feature screen. This plan touches shell/navigation chrome only.
- Verify with `npm run typecheck` and `npm test`; `npm run build` is slow, do not use it as the routine gate.

---

### Task 1: Pure shell helpers extracted from `app-shell.tsx`

Moves the pure functions currently living at the top of `app-shell.tsx` into their own module so both shells share one copy. No behavior change.

**Files:**
- Create: `src/components/layout/shell-menu-helpers.ts`
- Create: `src/components/layout/shell-menu-helpers.test.ts`
- Modify: `src/components/layout/app-shell.tsx` (delete the moved functions and constants, import them instead)

**Interfaces:**
- Consumes: `MenuItem` from `@/config/menu`, `AuthUser` from `@/stores/auth-store`
- Produces: `menuKey(title)`, `menuItemLabel(item, t)`, `routeIsActive(pathname, path?)`, `hasActiveRoute(item, pathname)`, `activeMenuTitles(items, pathname)`, `userInitials(user)`, `isImmersiveScreen(pathname)`, `isFixedDataScreen(pathname)`

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/shell-menu-helpers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { MenuItem } from "@/config/menu";
import {
  activeMenuTitles,
  hasActiveRoute,
  isFixedDataScreen,
  isImmersiveScreen,
  menuItemLabel,
  routeIsActive,
  userInitials,
} from "./shell-menu-helpers";

const items: MenuItem[] = [
  { path: "/", title: "dashboard" },
  {
    title: "sales",
    children: [
      { path: "/pos/tables", title: "open_table_sale" },
      { path: "/sales/sales-list", title: "sales_list" },
    ],
  },
];

describe("routeIsActive", () => {
  it("matches the root route exactly and never as a prefix", () => {
    expect(routeIsActive("/", "/")).toBe(true);
    expect(routeIsActive("/products", "/")).toBe(false);
  });

  it("matches a route and its descendants", () => {
    expect(routeIsActive("/products", "/products")).toBe(true);
    expect(routeIsActive("/products/form", "/products")).toBe(true);
    expect(routeIsActive("/productions", "/products")).toBe(false);
  });

  it("is false without a path", () => {
    expect(routeIsActive("/products")).toBe(false);
  });
});

describe("hasActiveRoute", () => {
  it("is true when a child route is active", () => {
    expect(hasActiveRoute(items[1], "/sales/sales-list")).toBe(true);
  });

  it("is false when no descendant matches", () => {
    expect(hasActiveRoute(items[1], "/products")).toBe(false);
  });
});

describe("activeMenuTitles", () => {
  it("returns only groups that wrap the active route", () => {
    expect(activeMenuTitles(items, "/sales/sales-list")).toEqual([
      "sales",
      "sales_list",
    ]);
  });

  it("returns nothing when the active route sits outside every group", () => {
    expect(activeMenuTitles(items, "/products")).toEqual([]);
  });
});

describe("menuItemLabel", () => {
  const t = (key: string) => `t:${key}`;

  it("prefers the API-provided label", () => {
    expect(menuItemLabel({ label: "ຂາຍ", title: "sales" }, t)).toBe("ຂາຍ");
  });

  it("falls back to the namespaced translation key", () => {
    expect(menuItemLabel({ label: "", title: "sales" }, t)).toBe("t:nav.sales");
  });
});

describe("userInitials", () => {
  it("builds two initials from the store name", () => {
    expect(userInitials({ store_name: "Yummy Go" } as never)).toBe("YG");
  });

  it("falls back to YG without a user", () => {
    expect(userInitials(null)).toBe("YG");
  });
});

describe("isImmersiveScreen", () => {
  it("covers both protected POS screens only", () => {
    expect(isImmersiveScreen("/pos/tables")).toBe(true);
    expect(isImmersiveScreen("/pos/order")).toBe(true);
    expect(isImmersiveScreen("/products")).toBe(false);
  });
});

describe("isFixedDataScreen", () => {
  it("covers listed paths, prefixes, and immersive screens", () => {
    expect(isFixedDataScreen("/products")).toBe(true);
    expect(isFixedDataScreen("/settings/category")).toBe(true);
    expect(isFixedDataScreen("/report/daily-sales")).toBe(true);
    expect(isFixedDataScreen("/pos/order")).toBe(true);
  });

  it("leaves the dashboard scrollable", () => {
    expect(isFixedDataScreen("/")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/shell-menu-helpers.test.ts`
Expected: FAIL — `Failed to resolve import "./shell-menu-helpers"`

- [ ] **Step 3: Create the helpers module**

Create `src/components/layout/shell-menu-helpers.ts`:

```ts
import type { MenuItem } from "@/config/menu";
import type { AuthUser } from "@/stores/auth-store";

const FIXED_DATA_SCREEN_PATHS = new Set([
  "/printers",
  "/package",
  "/products",
  "/stock",
  "/sales/cancel-history",
  "/sales/cancel-sale",
  "/sales/sales-list",
]);
const FIXED_DATA_SCREEN_PREFIXES = ["/settings/", "/report/"] as const;
const IMMERSIVE_SCREEN_PATHS = new Set(["/pos/tables", "/pos/order"]);

export function menuKey(title: string) {
  return `nav.${title}`;
}

export function menuItemLabel(
  item: Pick<MenuItem, "label" | "title">,
  t: (key: string) => string,
) {
  return item.label || t(menuKey(item.title));
}

export function routeIsActive(pathname: string, path?: string) {
  if (!path) return false;
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function hasActiveRoute(item: MenuItem, pathname: string): boolean {
  if (routeIsActive(pathname, item.path)) return true;
  return (
    item.children?.some((child) => hasActiveRoute(child, pathname)) ?? false
  );
}

export function activeMenuTitles(items: MenuItem[], pathname: string): string[] {
  return items.flatMap((item) => {
    if (!item.children?.length || !hasActiveRoute(item, pathname)) return [];
    return [item.title, ...activeMenuTitles(item.children, pathname)];
  });
}

export function userInitials(user: AuthUser | null) {
  const source = user?.store_name || user?.branch_name || user?.email || "YG";
  return (
    source
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "YG"
  );
}

export function isImmersiveScreen(pathname: string) {
  return IMMERSIVE_SCREEN_PATHS.has(pathname);
}

export function isFixedDataScreen(pathname: string) {
  return (
    isImmersiveScreen(pathname) ||
    FIXED_DATA_SCREEN_PATHS.has(pathname) ||
    FIXED_DATA_SCREEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/layout/shell-menu-helpers.test.ts`
Expected: PASS, 13 tests

- [ ] **Step 5: Delete the moved code from `app-shell.tsx` and import instead**

In `src/components/layout/app-shell.tsx`, delete the constants `FIXED_DATA_SCREEN_PATHS` and `FIXED_DATA_SCREEN_PREFIXES` and the functions `menuKey`, `menuItemLabel`, `routeIsActive`, `hasActiveRoute`, `isFixedDataScreen`, `activeMenuTitles`, `userInitials` (lines 93–153 in the current file). Keep `POS_ANDROID_SYSTEM_SCREEN_CLASS`.

Add this import alongside the other `@/components/layout/...` imports:

```tsx
import {
  activeMenuTitles,
  hasActiveRoute,
  isFixedDataScreen,
  isImmersiveScreen,
  menuItemLabel,
  routeIsActive,
  userInitials,
} from "@/components/layout/shell-menu-helpers";
```

Then replace the inline immersive check inside `AppShell` — change:

```tsx
  const immersiveScreen =
    pathname === "/pos/tables" ||
    pathname === "/pos/order";
  const dashboardScreen = pathname === "/";
  const fixedDataScreen = isFixedDataScreen(pathname, immersiveScreen);
```

to:

```tsx
  const immersiveScreen = isImmersiveScreen(pathname);
  const dashboardScreen = pathname === "/";
  const fixedDataScreen = isFixedDataScreen(pathname);
```

- [ ] **Step 6: Verify nothing regressed**

Run: `npm run typecheck`
Expected: no errors

Run: `npm test`
Expected: all suites pass, including the existing `shell-breadcrumbs.test.ts`

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/shell-menu-helpers.ts src/components/layout/shell-menu-helpers.test.ts src/components/layout/app-shell.tsx
git commit -m "refactor(layout): extract pure shell helpers for reuse by both shells"
```

---

### Task 2: Native navigation model

The pure logic that turns the permission menu into native nav destinations, plus back and Android-back resolution. No React, fully tested.

**Files:**
- Create: `src/components/layout/native-navigation-model.ts`
- Create: `src/components/layout/native-navigation-model.test.ts`

**Interfaces:**
- Consumes: `MenuItem` from `@/config/menu`; `routeIsActive` from `./shell-menu-helpers` (Task 1)
- Produces: `NATIVE_DIRECT_DESTINATION_COUNT`, `NativeDestination`, `NativeNavigationModel`, `AndroidBackAction`, `destinationPath(item)`, `buildNativeNavigationModel(items)`, `isDestinationActive(destination, pathname)`, `backFallbackPath(pathname)`, `shouldShowBackButton(model, pathname)`, `resolveAndroidBackAction(input)`

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/native-navigation-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { MenuItem } from "@/config/menu";
import {
  backFallbackPath,
  buildNativeNavigationModel,
  destinationPath,
  isDestinationActive,
  resolveAndroidBackAction,
  shouldShowBackButton,
} from "./native-navigation-model";

const menu: MenuItem[] = [
  { is_header: true, title: "manage" },
  { path: "/", title: "dashboard" },
  {
    path: "/sale",
    title: "sales",
    children: [
      { path: "/pos/tables", title: "open_table_sale" },
      { path: "/sales/sales-list", title: "sales_list" },
    ],
  },
  { path: "/products", title: "menu_add_item" },
  { path: "/stock", title: "stock_quantity" },
  { path: "/printers", title: "printer_management" },
];

describe("destinationPath", () => {
  it("uses a leaf item's own path", () => {
    expect(destinationPath({ path: "/products", title: "products" })).toBe(
      "/products",
    );
  });

  it("uses the first enabled child for a group", () => {
    expect(destinationPath(menu[2])).toBe("/pos/tables");
  });

  it("skips a disabled first child", () => {
    expect(
      destinationPath({
        title: "reports",
        children: [
          { path: "/report/monthly-sales", title: "monthly", disabled: true },
          { path: "/report/daily-sales", title: "daily" },
        ],
      }),
    ).toBe("/report/daily-sales");
  });

  it("is undefined for a disabled leaf", () => {
    expect(
      destinationPath({ path: "/stock", title: "stock", disabled: true }),
    ).toBeUndefined();
  });
});

describe("buildNativeNavigationModel", () => {
  it("takes the first three navigable items as direct destinations", () => {
    const model = buildNativeNavigationModel(menu);
    expect(model.direct.map((entry) => entry.path)).toEqual([
      "/",
      "/pos/tables",
      "/products",
    ]);
  });

  it("puts every remaining item under more", () => {
    const model = buildNativeNavigationModel(menu);
    expect(model.more.map((item) => item.title)).toEqual([
      "stock_quantity",
      "printer_management",
    ]);
  });

  it("drops header rows entirely", () => {
    const model = buildNativeNavigationModel(menu);
    expect(model.direct.some((entry) => entry.item.is_header)).toBe(false);
    expect(model.more.some((item) => item.is_header)).toBe(false);
  });

  it("sends an unresolvable item to more instead of wasting a direct slot", () => {
    const model = buildNativeNavigationModel([
      { path: "/stock", title: "stock", disabled: true },
      { path: "/", title: "dashboard" },
    ]);
    expect(model.direct.map((entry) => entry.path)).toEqual(["/"]);
    expect(model.more.map((item) => item.title)).toEqual(["stock"]);
  });

  it("produces no more entries when the menu is short", () => {
    const model = buildNativeNavigationModel([{ path: "/", title: "dash" }]);
    expect(model.more).toEqual([]);
  });
});

describe("isDestinationActive", () => {
  const model = buildNativeNavigationModel(menu);
  const dashboard = model.direct[0];
  const sales = model.direct[1];

  it("matches the destination's own path", () => {
    expect(isDestinationActive(sales, "/pos/tables")).toBe(true);
  });

  it("stays active on a sibling child of the same group", () => {
    expect(isDestinationActive(sales, "/sales/sales-list")).toBe(true);
  });

  it("does not treat the dashboard as a prefix of everything", () => {
    expect(isDestinationActive(dashboard, "/")).toBe(true);
    expect(isDestinationActive(dashboard, "/products")).toBe(false);
  });
});

describe("backFallbackPath", () => {
  it("maps every drill-in route to its parent", () => {
    expect(backFallbackPath("/pos/order")).toBe("/pos/tables");
    expect(backFallbackPath("/products/form")).toBe("/products");
    expect(backFallbackPath("/printers/form")).toBe("/printers");
  });

  it("is undefined for a normal route", () => {
    expect(backFallbackPath("/products")).toBeUndefined();
  });
});

describe("shouldShowBackButton", () => {
  const model = buildNativeNavigationModel(menu);

  it("hides back on a direct destination", () => {
    expect(shouldShowBackButton(model, "/")).toBe(false);
    expect(shouldShowBackButton(model, "/pos/tables")).toBe(false);
  });

  it("shows back on a drill-in route even inside an active group", () => {
    expect(shouldShowBackButton(model, "/pos/order")).toBe(true);
  });

  it("shows back on a route that only lives under more", () => {
    expect(shouldShowBackButton(model, "/printers")).toBe(true);
  });
});

describe("resolveAndroidBackAction", () => {
  const model = buildNativeNavigationModel(menu);

  it("closes an open overlay before anything else", () => {
    expect(
      resolveAndroidBackAction({
        canGoBack: true,
        model,
        overlayOpen: true,
        pathname: "/pos/order",
      }),
    ).toEqual({ type: "close-overlay" });
  });

  it("prefers the deterministic parent over history", () => {
    expect(
      resolveAndroidBackAction({
        canGoBack: true,
        model,
        overlayOpen: false,
        pathname: "/products/form",
      }),
    ).toEqual({ path: "/products", type: "navigate" });
  });

  it("minimizes at a direct destination instead of leaving the app", () => {
    expect(
      resolveAndroidBackAction({
        canGoBack: true,
        model,
        overlayOpen: false,
        pathname: "/",
      }),
    ).toEqual({ type: "minimize" });
  });

  it("uses history for a more route that has one", () => {
    expect(
      resolveAndroidBackAction({
        canGoBack: true,
        model,
        overlayOpen: false,
        pathname: "/printers",
      }),
    ).toEqual({ type: "history-back" });
  });

  it("minimizes on a deep link with no history to pop", () => {
    expect(
      resolveAndroidBackAction({
        canGoBack: false,
        model,
        overlayOpen: false,
        pathname: "/printers",
      }),
    ).toEqual({ type: "minimize" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/native-navigation-model.test.ts`
Expected: FAIL — `Failed to resolve import "./native-navigation-model"`

- [ ] **Step 3: Write the model**

Create `src/components/layout/native-navigation-model.ts`:

```ts
import type { MenuItem } from "@/config/menu";
import { routeIsActive } from "./shell-menu-helpers";

// iOS HIG และ Material แนะนำ 3-5 ปลายทาง; 3 ทำให้ label ภาษาลาวยาว ๆ ไม่ถูกบีบบนจอแคบ
export const NATIVE_DIRECT_DESTINATION_COUNT = 3;

// หน้าที่เข้าถึงได้จาก deep link ต้องมี parent ที่แน่นอน ไม่พึ่ง history อย่างเดียว
const BACK_FALLBACK_PATHS: Record<string, string> = {
  "/pos/order": "/pos/tables",
  "/printers/form": "/printers",
  "/products/form": "/products",
};

export interface NativeDestination {
  item: MenuItem;
  path: string;
}

export interface NativeNavigationModel {
  direct: NativeDestination[];
  more: MenuItem[];
}

export type AndroidBackAction =
  | { type: "close-overlay" }
  | { path: string; type: "navigate" }
  | { type: "history-back" }
  | { type: "minimize" };

export interface AndroidBackInput {
  canGoBack: boolean;
  model: NativeNavigationModel;
  overlayOpen: boolean;
  pathname: string;
}

// กลุ่มอย่าง "ขาย" มี menu_path เป็น /sale ซึ่งไม่มีหน้าจริง — ยิงไปลูกตัวแรกที่กดได้แทน
export function destinationPath(item: MenuItem): string | undefined {
  const child = item.children?.find((entry) => !entry.disabled && entry.path);
  if (child?.path) return child.path;
  if (item.disabled) return undefined;
  return item.path;
}

export function buildNativeNavigationModel(
  items: MenuItem[],
): NativeNavigationModel {
  const direct: NativeDestination[] = [];
  const more: MenuItem[] = [];

  for (const item of items) {
    if (item.is_header) continue;
    const path = destinationPath(item);
    // ไม่เลื่อนรายการที่กดไม่ได้ขึ้นมากินช่อง และไม่โชว์ placeholder ที่ disabled
    if (path && direct.length < NATIVE_DIRECT_DESTINATION_COUNT) {
      direct.push({ item, path });
      continue;
    }
    more.push(item);
  }

  return { direct, more };
}

export function isDestinationActive(
  destination: NativeDestination,
  pathname: string,
): boolean {
  if (routeIsActive(pathname, destination.path)) return true;
  const { item } = destination;
  if (item.children?.some((child) => routeIsActive(pathname, child.path))) {
    return true;
  }
  return routeIsActive(pathname, item.path);
}

export function backFallbackPath(pathname: string): string | undefined {
  return BACK_FALLBACK_PATHS[pathname];
}

export function shouldShowBackButton(
  model: NativeNavigationModel,
  pathname: string,
): boolean {
  if (backFallbackPath(pathname)) return true;
  return !model.direct.some((destination) =>
    isDestinationActive(destination, pathname),
  );
}

export function resolveAndroidBackAction({
  canGoBack,
  model,
  overlayOpen,
  pathname,
}: AndroidBackInput): AndroidBackAction {
  if (overlayOpen) return { type: "close-overlay" };

  const fallback = backFallbackPath(pathname);
  if (fallback) return { path: fallback, type: "navigate" };

  if (!shouldShowBackButton(model, pathname)) return { type: "minimize" };

  return canGoBack ? { type: "history-back" } : { type: "minimize" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/layout/native-navigation-model.test.ts`
Expected: PASS, 21 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/native-navigation-model.ts src/components/layout/native-navigation-model.test.ts
git commit -m "feat(layout): add native navigation model derived from the permission menu"
```

---

### Task 3: Shared shell data hook, and move the web shell under `web/`

Both shells need the same menu/breadcrumb/screen-mode state. Extract it once, then relocate the existing shell without touching its markup.

**Files:**
- Create: `src/components/layout/use-app-shell-data.ts`
- Create: `src/components/layout/web/app-shell.tsx` (git mv from `src/components/layout/app-shell.tsx`)
- Modify: `src/app/(protected)/layout.tsx:1`

**Interfaces:**
- Consumes: `activeMenuTitles`, `isFixedDataScreen`, `isImmersiveScreen` from `./shell-menu-helpers` (Task 1); `resolveShellBreadcrumbs` from `./shell-breadcrumbs`
- Produces: `useAppShellData()` returning `{ breadcrumbs, dashboardScreen, fixedDataScreen, immersiveScreen, menuError, menuItems, menuLoading, pathname, retrySidebarMenu }`

- [ ] **Step 1: Create the hook**

Create `src/components/layout/use-app-shell-data.ts`:

```ts
"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  isFixedDataScreen,
  isImmersiveScreen,
} from "@/components/layout/shell-menu-helpers";
import {
  resolveShellBreadcrumbs,
  type BreadcrumbTrailItem,
} from "@/components/layout/shell-breadcrumbs";
import { sidebarPermissionMenuItemsToMenuItems } from "@/config/sidebar-permission-menu";
import { authStoreUuid, useAuthStore } from "@/stores/auth-store";
import {
  sidebarMenuCacheKey,
  usePermissionsSidebarStore,
} from "@/stores/permissions-sidebar-store";

// ทั้ง web shell และ capacitor shell ใช้เมนู/breadcrumb ชุดเดียวกัน — รวมไว้ที่นี่จุดเดียว
// เพื่อไม่ให้เกิด navigation model ชุดที่สองที่หลุดจากสิทธิ์จริง (ปัญหาเดิมของ shell-navigation.ts)
export function useAppShellData() {
  const pathname = usePathname();
  const { i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const sidebarItems = usePermissionsSidebarStore((state) => state.items);
  const sidebarError = usePermissionsSidebarStore((state) => state.error);
  const sidebarLoading = usePermissionsSidebarStore((state) => state.loading);
  const sidebarRequestKey = usePermissionsSidebarStore(
    (state) => state.requestKey,
  );
  const clearSidebarMenu = usePermissionsSidebarStore(
    (state) => state.clearActive,
  );
  const loadSidebarMenu = usePermissionsSidebarStore((state) => state.load);

  const storeUuid = authStoreUuid(user);
  const targetSidebarRequestKey =
    storeUuid && typeof user?.status === "number"
      ? sidebarMenuCacheKey(storeUuid, user.status, i18n.language)
      : "";
  const sidebarKeyMatches =
    Boolean(targetSidebarRequestKey) &&
    sidebarRequestKey === targetSidebarRequestKey;

  const menuItems = useMemo(
    () =>
      sidebarPermissionMenuItemsToMenuItems(
        sidebarKeyMatches ? sidebarItems : [],
      ),
    [sidebarItems, sidebarKeyMatches],
  );

  const menuLoading =
    Boolean(targetSidebarRequestKey) &&
    (!sidebarKeyMatches || sidebarLoading) &&
    menuItems.length === 0;
  const menuError = sidebarKeyMatches ? sidebarError : null;

  const breadcrumbs = useMemo(() => {
    const home: BreadcrumbTrailItem = { path: "/", title: "dashboard" };
    const trail = resolveShellBreadcrumbs(menuItems, pathname);
    if (!trail) return [home];
    if (trail[0]?.path === "/") return trail;
    return [home, ...trail];
  }, [menuItems, pathname]);

  useEffect(() => {
    if (!storeUuid || typeof user?.status !== "number") {
      clearSidebarMenu();
      return;
    }
    void loadSidebarMenu(storeUuid, user.status, i18n.language);
  }, [
    clearSidebarMenu,
    i18n.language,
    loadSidebarMenu,
    storeUuid,
    user?.status,
  ]);

  function retrySidebarMenu() {
    if (!storeUuid || typeof user?.status !== "number") return;
    void loadSidebarMenu(storeUuid, user.status, i18n.language);
  }

  return {
    breadcrumbs,
    dashboardScreen: pathname === "/",
    fixedDataScreen: isFixedDataScreen(pathname),
    immersiveScreen: isImmersiveScreen(pathname),
    menuError,
    menuItems,
    menuLoading,
    pathname,
    retrySidebarMenu,
  };
}
```

- [ ] **Step 2: Move the web shell**

```bash
mkdir -p src/components/layout/web
git mv src/components/layout/app-shell.tsx src/components/layout/web/app-shell.tsx
```

- [ ] **Step 3: Make the web shell consume the hook**

In `src/components/layout/web/app-shell.tsx`, delete the now-duplicated state derivation inside `AppShell` — the `usePermissionsSidebarStore` selectors, `storeUuid`, `targetSidebarRequestKey`, `sidebarKeyMatches`, `permissionMenuItems`, `menuItems`, `menuLoading`, `menuError`, `breadcrumbs`, `immersiveScreen`, `dashboardScreen`, `fixedDataScreen`, the sidebar-loading `useEffect`, and `retrySidebarMenu`. Keep `useAuthStore` for `user`/`logout`, `useAppStore` for `collapsed`, `usePosOrderAlertListener`, and every `useEffect` that manages document classes.

Replace them with:

```tsx
  const {
    breadcrumbs,
    dashboardScreen,
    fixedDataScreen,
    immersiveScreen,
    menuError,
    menuItems,
    menuLoading,
    pathname,
    retrySidebarMenu,
  } = useAppShellData();
```

Remove the now-unused `usePathname` call (the hook returns `pathname`), and update the import block: drop `sidebarPermissionMenuItemsToMenuItems`, `sidebarMenuCacheKey`, `usePermissionsSidebarStore`, `authStoreUuid`, `resolveShellBreadcrumbs`, and `useMemo` if nothing else uses it; add

```tsx
import { useAppShellData } from "@/components/layout/use-app-shell-data";
```

All relative sibling imports stay valid because they use the `@/components/layout/...` alias, not `./`.

- [ ] **Step 4: Update the route layout import**

In `src/app/(protected)/layout.tsx`, change line 1:

```tsx
import { AppShell } from "@/components/layout/web/app-shell";
```

- [ ] **Step 5: Verify no behavior changed**

Run: `npm run typecheck`
Expected: no errors

Run: `npm test`
Expected: all suites pass

- [ ] **Step 6: Verify the web app still renders**

Start the preview with the `preview_start` tool (never `npm run dev` via a shell), sign in, and confirm: sidebar renders with permission items, breadcrumbs resolve, collapsing the sidebar still works, and `/products` still uses the fixed non-scrolling layout.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/use-app-shell-data.ts src/components/layout/web/app-shell.tsx "src/app/(protected)/layout.tsx"
git commit -m "refactor(layout): extract useAppShellData and move the web shell under web/"
```

---

### Task 4: Native shell skeleton — top bar, geometry tokens, switch point

After this task the Capacitor app renders its own shell with a working top bar. Navigation chrome arrives in Task 5.

**Files:**
- Create: `src/components/layout/capacitor/top-bar.tsx`
- Create: `src/components/layout/capacitor/app-shell.tsx`
- Modify: `src/app/(protected)/layout.tsx`
- Modify: `src/app/globals.css` (append after the `.app-header` block near line 1296)
- Modify: `public/locales/en/common.json`, `public/locales/la/common.json`

**Interfaces:**
- Consumes: `useAppShellData` (Task 3); `buildNativeNavigationModel`, `shouldShowBackButton`, `backFallbackPath` (Task 2); `menuItemLabel`, `userInitials` (Task 1)
- Produces: `NativeAppShell({ children })`, `NativeTopBar({ breadcrumbs, model, pathname })`

- [ ] **Step 1: Add the new i18n strings**

In `public/locales/en/common.json`, inside the `"app"` object add:

```json
    "more": "More",
    "navigation": "Main navigation",
    "moreNavigation": "More menu",
```

In `public/locales/la/common.json`, inside the `"app"` object add:

```json
    "more": "ເພີ່ມເຕີມ",
    "navigation": "ການນຳທາງຫຼັກ",
    "moreNavigation": "ເມນູເພີ່ມເຕີມ",
```

- [ ] **Step 2: Add the shell geometry tokens**

Append to `src/app/globals.css` immediately after the `.dark .app-header { ... }` rule:

```css
/* Capacitor shell: top bar สั้นกว่าเว็บ และมี bottom nav กินพื้นที่ล่างเพิ่ม
   คง --app-shell-header-height ไว้เพราะ dashboard sticky และ .app-shell-body
   คำนวณความสูงจากตัวแปรนี้ */
.app-shell[data-platform="capacitor"] {
  --app-shell-header-height: 56px;
  --app-shell-bottom-nav-height: calc(64px + env(safe-area-inset-bottom, 0px));
  --app-shell-side-rail-width: 0px;
}

/* คีย์บอร์ด Android ดัน bottom bar ขึ้นมาทับช่องกรอก — ยุบความสูงทิ้งระหว่างพิมพ์ */
.app-shell[data-platform="capacitor"][data-keyboard-open="true"] {
  --app-shell-bottom-nav-height: 0px;
}

@media (min-width: 768px) {
  .app-shell[data-platform="capacitor"] {
    --app-shell-bottom-nav-height: 0px;
    --app-shell-side-rail-width: 88px;
  }
}

.native-top-bar {
  background: color-mix(in oklch, var(--card) 96%, transparent);
  box-shadow: 0 10px 30px -28px rgb(15 23 42 / 0.45);
  backdrop-filter: blur(24px);
  padding-top: env(safe-area-inset-top, 0px);
}

.dark .native-top-bar {
  background: hsl(var(--app) / 0.85);
  box-shadow: none;
}
```

- [ ] **Step 3: Write the top bar**

Create `src/components/layout/capacitor/top-bar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ChevronLeft, LogOut, ShieldCheck, UserPen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { NotificationMenu } from "@/components/layout/notification-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  menuItemLabel,
  userInitials,
} from "@/components/layout/shell-menu-helpers";
import {
  backFallbackPath,
  shouldShowBackButton,
  type NativeNavigationModel,
} from "@/components/layout/native-navigation-model";
import type { BreadcrumbTrailItem } from "@/components/layout/shell-breadcrumbs";
import { getUserProfileUrl } from "@/lib/image";
import { internalRoute } from "@/lib/routes";
import { useAuthStore, type AuthUser } from "@/stores/auth-store";

export function NativeTopBar({
  breadcrumbs,
  model,
  pathname,
}: {
  breadcrumbs: BreadcrumbTrailItem[];
  model: NativeNavigationModel;
  pathname: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const current = breadcrumbs[breadcrumbs.length - 1] ?? { title: "dashboard" };
  const title = menuItemLabel(current, t);
  const showBack = shouldShowBackButton(model, pathname);

  function goBack() {
    const fallback = backFallbackPath(pathname);
    if (fallback) {
      router.push(internalRoute(fallback));
      return;
    }
    router.back();
  }

  return (
    <header className="native-top-bar sticky top-0 z-40 flex h-(--app-shell-header-height) w-full shrink-0 items-center gap-1 border-b border-border px-1 sm:px-2">
      {showBack ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("actions.back")}
          className="size-11 shrink-0 text-primary"
          onClick={goBack}
        >
          <ChevronLeft />
        </Button>
      ) : (
        <span aria-hidden="true" className="w-2 shrink-0" />
      )}

      <h1 className="min-w-0 flex-1 truncate px-1 text-base font-bold">
        {title}
      </h1>

      <div className="flex shrink-0 items-center">
        <NotificationMenu triggerClassName="size-11" />
        <NativeProfileMenu logout={logout} user={user} />
      </div>
    </header>
  );
}

function NativeProfileMenu({
  logout,
  user,
}: {
  logout: () => void;
  user: AuthUser | null;
}) {
  const { t } = useTranslation();
  const profileSrc = user?.profile ? getUserProfileUrl(user.profile) : "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={user?.email ?? t("profile.sections.account")}
          className="size-11"
        >
          <Avatar className="size-8">
            {profileSrc ? (
              <AvatarImage src={profileSrc} alt={user?.email ?? "Profile"} />
            ) : null}
            <AvatarFallback>{userInitials(user)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="truncate">
          {user?.email ?? t("profile.sections.account")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* theme/language ย้ายมาไว้ในนี้แทนไอคอนแยกบน top bar — จอมือถือไม่มีที่พอ */}
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="text-sm text-muted-foreground">
            {t("app.changeLanguage")}
          </span>
          <LanguageSwitch compact size="icon" className="size-9" />
        </div>
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="text-sm text-muted-foreground">{t("app.theme")}</span>
          <ThemeToggle variant="ghost" className="size-9" />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserPen />
            {t("actions.editProfile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/policy">
            <ShieldCheck />
            {t("policy.title")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={logout}>
          <LogOut />
          {t("actions.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: Write the native shell**

Create `src/components/layout/capacitor/app-shell.tsx`:

```tsx
"use client";

import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { usePosOrderAlertListener } from "@/hooks/use-pos-order-alert-listener";
import { cn } from "@/lib/utils";
import { useAppShellData } from "@/components/layout/use-app-shell-data";
import { buildNativeNavigationModel } from "@/components/layout/native-navigation-model";
import { NativeTopBar } from "@/components/layout/capacitor/top-bar";
import { useAuthStore } from "@/stores/auth-store";

export function NativeAppShell({ children }: { children: React.ReactNode }) {
  const { i18n, t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const { breadcrumbs, fixedDataScreen, menuItems, pathname } =
    useAppShellData();
  usePosOrderAlertListener({
    branchUuid: user?.branch_uuid,
    language: i18n.language,
  });

  const model = useMemo(
    () => buildNativeNavigationModel(menuItems),
    [menuItems],
  );

  // หน้าที่มี scroll ภายในของตัวเองต้องล็อก document ไม่งั้น Android เลื่อนสองชั้น
  useEffect(() => {
    if (!fixedDataScreen) return;
    document.documentElement.classList.add("data-screen-scroll-lock");
    document.body.classList.add("data-screen-scroll-lock");

    return () => {
      document.documentElement.classList.remove("data-screen-scroll-lock");
      document.body.classList.remove("data-screen-scroll-lock");
    };
  }, [fixedDataScreen]);

  return (
    <div
      className={cn(
        "app-shell flex min-h-0 w-full flex-col text-foreground",
        fixedDataScreen ? "h-dvh overflow-hidden" : "min-h-dvh",
      )}
      data-fixed-screen={fixedDataScreen ? "true" : "false"}
      data-platform="capacitor"
    >
      <a
        href="#app-main-content"
        className="fixed left-2 top-2 z-100 -translate-y-24 rounded-md bg-background px-4 py-3 font-bold text-foreground shadow-lg transition-transform focus:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("app.skipToContent")}
      </a>

      <NativeTopBar
        breadcrumbs={breadcrumbs}
        model={model}
        pathname={pathname}
      />

      <main
        id="app-main-content"
        tabIndex={-1}
        className={cn(
          "min-w-0 flex-1 pb-(--app-shell-bottom-nav-height)",
          fixedDataScreen ? "min-h-0 overflow-hidden" : "overflow-visible",
        )}
      >
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Wire the switch point**

Replace `src/app/(protected)/layout.tsx` entirely:

```tsx
"use client";

import { AppShell } from "@/components/layout/web/app-shell";
import { NativeAppShell } from "@/components/layout/capacitor/app-shell";
import { AuthGuard } from "@/components/layout/auth-guard";
import { useIsCapacitorNativeApp } from "@/hooks/use-capacitor-native-app";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isCapacitorNativeApp = useIsCapacitorNativeApp();
  const Shell = isCapacitorNativeApp ? NativeAppShell : AppShell;

  return (
    <AuthGuard>
      <Shell>{children}</Shell>
    </AuthGuard>
  );
}
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck`
Expected: no errors

Run: `npm test`
Expected: all suites pass

- [ ] **Step 7: Verify the web app is untouched**

With the preview running, confirm the browser still shows the sidebar shell at every width — including below 768px. Any bottom nav appearing in a browser is a bug in the switch point.

- [ ] **Step 8: Commit**

```bash
git add src/components/layout/capacitor "src/app/(protected)/layout.tsx" src/app/globals.css public/locales/en/common.json public/locales/la/common.json
git commit -m "feat(layout): add the Capacitor shell skeleton with a native top bar"
```

---

### Task 5: Bottom navigation and tablet side rail

**Files:**
- Create: `src/components/layout/capacitor/nav-destination-button.tsx`
- Create: `src/components/layout/capacitor/bottom-nav.tsx`
- Create: `src/components/layout/capacitor/side-rail.tsx`
- Modify: `src/components/layout/capacitor/app-shell.tsx`

**Interfaces:**
- Consumes: `NativeNavigationModel`, `isDestinationActive` (Task 2); `menuItemLabel` (Task 1); `MenuIcon` from `@/components/common/menu-icon`
- Produces: `NavDestinationButton({ active, destination })`, `NavMoreButton({ active, icon, label, onClick })`, `NativeBottomNav({ model, moreOpen, onMoreClick, pathname })`, `NativeSideRail({ model, moreOpen, onMoreClick, pathname })`

- [ ] **Step 1: Write the shared destination button**

Create `src/components/layout/capacitor/nav-destination-button.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { MenuIcon } from "@/components/common/menu-icon";
import { menuItemLabel } from "@/components/layout/shell-menu-helpers";
import type { NativeDestination } from "@/components/layout/native-navigation-model";
import { internalRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { MenuItem } from "@/config/menu";

function DestinationIcon({ item }: { item: MenuItem }) {
  const Icon = item.icon;
  if (Icon) return <Icon className="size-5 shrink-0" />;
  if (item.iconName) return <MenuIcon value={item.iconName} className="size-5 shrink-0" />;
  return null;
}

// ปุ่มเดียวใช้ทั้ง bottom bar และ side rail — label อยู่ใต้ไอคอนเหมือนกันทั้งคู่
export function NavDestinationButton({
  active,
  destination,
}: {
  active: boolean;
  destination: NativeDestination;
}) {
  const { t } = useTranslation();
  const label = menuItemLabel(destination.item, t);

  return (
    <Link
      href={internalRoute(destination.path)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <DestinationIcon item={destination.item} />
      <span className="w-full truncate text-center text-[11px] font-semibold leading-tight">
        {label}
      </span>
    </Link>
  );
}

export function NavMoreButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span className="w-full truncate text-center text-[11px] font-semibold leading-tight">
        {label}
      </span>
    </button>
  );
}
```

- [ ] **Step 2: Write the bottom nav**

Create `src/components/layout/capacitor/bottom-nav.tsx`:

```tsx
"use client";

import { useTranslation } from "react-i18next";
import { MoreHorizontal } from "lucide-react";
import {
  isDestinationActive,
  type NativeNavigationModel,
} from "@/components/layout/native-navigation-model";
import {
  NavDestinationButton,
  NavMoreButton,
} from "@/components/layout/capacitor/nav-destination-button";

export function NativeBottomNav({
  model,
  moreOpen,
  onMoreClick,
  pathname,
}: {
  model: NativeNavigationModel;
  moreOpen: boolean;
  onMoreClick: () => void;
  pathname: string;
}) {
  const { t } = useTranslation();
  const anyDirectActive = model.direct.some((destination) =>
    isDestinationActive(destination, pathname),
  );

  return (
    <nav
      aria-label={t("app.navigation")}
      className="fixed inset-x-0 bottom-0 z-40 flex h-(--app-shell-bottom-nav-height) items-start gap-0.5 border-t border-border bg-card px-1 pt-1 pb-[env(safe-area-inset-bottom,0px)] md:hidden"
    >
      {model.direct.map((destination) => (
        <NavDestinationButton
          key={destination.path}
          active={isDestinationActive(destination, pathname)}
          destination={destination}
        />
      ))}
      {model.more.length ? (
        <NavMoreButton
          active={moreOpen || !anyDirectActive}
          icon={<MoreHorizontal className="size-5 shrink-0" />}
          label={t("app.more")}
          onClick={onMoreClick}
        />
      ) : null}
    </nav>
  );
}
```

- [ ] **Step 3: Write the side rail**

Create `src/components/layout/capacitor/side-rail.tsx`:

```tsx
"use client";

import { useTranslation } from "react-i18next";
import { MoreHorizontal } from "lucide-react";
import {
  isDestinationActive,
  type NativeNavigationModel,
} from "@/components/layout/native-navigation-model";
import {
  NavDestinationButton,
  NavMoreButton,
} from "@/components/layout/capacitor/nav-destination-button";

export function NativeSideRail({
  model,
  moreOpen,
  onMoreClick,
  pathname,
}: {
  model: NativeNavigationModel;
  moreOpen: boolean;
  onMoreClick: () => void;
  pathname: string;
}) {
  const { t } = useTranslation();
  const anyDirectActive = model.direct.some((destination) =>
    isDestinationActive(destination, pathname),
  );

  return (
    <nav
      aria-label={t("app.navigation")}
      // rail เลื่อนได้เอง ต่างจาก Flutter NavigationRail — เพิ่มจำนวนปลายทางภายหลังได้โดยไม่ต้องรื้อ
      className="hidden w-(--app-shell-side-rail-width) shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-card px-1 py-2 md:flex"
    >
      {model.direct.map((destination) => (
        <NavDestinationButton
          key={destination.path}
          active={isDestinationActive(destination, pathname)}
          destination={destination}
        />
      ))}
      {model.more.length ? (
        <NavMoreButton
          active={moreOpen || !anyDirectActive}
          icon={<MoreHorizontal className="size-5 shrink-0" />}
          label={t("app.more")}
          onClick={onMoreClick}
        />
      ) : null}
    </nav>
  );
}
```

`flex-1` inside a column rail would stretch each button; the rail's own `flex-col` plus each button's `min-h-12` keeps them compact, and `flex-1` only expands along the main axis in the row-direction bottom bar.

- [ ] **Step 4: Mount both in the shell**

In `src/components/layout/capacitor/app-shell.tsx`, add the imports:

```tsx
import { useState } from "react";
import { NativeBottomNav } from "@/components/layout/capacitor/bottom-nav";
import { NativeSideRail } from "@/components/layout/capacitor/side-rail";
```

Add state inside `NativeAppShell`, above the `return`:

```tsx
  const [moreOpen, setMoreOpen] = useState(false);
```

Then restructure the returned tree so the rail sits beside the content while the bottom bar overlays it. Replace the `<main>` element and everything after `<NativeTopBar ... />` with:

```tsx
      <div className="flex min-h-0 w-full flex-1">
        <NativeSideRail
          model={model}
          moreOpen={moreOpen}
          onMoreClick={() => setMoreOpen(true)}
          pathname={pathname}
        />
        <main
          id="app-main-content"
          tabIndex={-1}
          className={cn(
            "min-w-0 flex-1 pb-(--app-shell-bottom-nav-height)",
            fixedDataScreen ? "min-h-0 overflow-hidden" : "overflow-visible",
          )}
        >
          {children}
        </main>
      </div>

      <NativeBottomNav
        model={model}
        moreOpen={moreOpen}
        onMoreClick={() => setMoreOpen(true)}
        pathname={pathname}
      />
```

- [ ] **Step 5: Verify**

Run: `npm run typecheck`
Expected: no errors

Run: `npm test`
Expected: all suites pass

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/capacitor
git commit -m "feat(layout): add Capacitor bottom navigation and tablet side rail"
```

---

### Task 6: "More" sheet with grouped items and appearance settings

**Files:**
- Create: `src/components/layout/capacitor/more-sheet.tsx`
- Create: `src/components/ui/accordion.tsx` (via the shadcn CLI)
- Modify: `src/components/layout/capacitor/app-shell.tsx`
- Modify: `public/locales/en/common.json`, `public/locales/la/common.json`

**Interfaces:**
- Consumes: `NativeNavigationModel` (Task 2); `menuItemLabel`, `routeIsActive` (Task 1); `useAppStore` theme-color/font-scale actions
- Produces: `NativeMoreSheet({ model, onOpenChange, open, pathname })`

- [ ] **Step 1: Install the accordion primitive**

```bash
npx shadcn@latest add accordion
```

Expected: creates `src/components/ui/accordion.tsx` and adds `@radix-ui/react-accordion` to `package.json`.

- [ ] **Step 2: Write the sheet**

Create `src/components/layout/capacitor/more-sheet.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MenuIcon } from "@/components/common/menu-icon";
import {
  menuItemLabel,
  routeIsActive,
} from "@/components/layout/shell-menu-helpers";
import type { NativeNavigationModel } from "@/components/layout/native-navigation-model";
import type { MenuItem } from "@/config/menu";
import { internalRoute } from "@/lib/routes";
import { cn } from "@/lib/utils";
import {
  useAppStore,
  type FontScale,
  type ThemeColor,
} from "@/stores/app-store";

const THEME_COLORS: readonly ThemeColor[] = [
  "emerald",
  "blue",
  "amber",
  "rose",
  "violet",
];
const FONT_SCALES: readonly FontScale[] = ["sm", "md", "lg"];

export function NativeMoreSheet({
  model,
  onOpenChange,
  open,
  pathname,
}: {
  model: NativeNavigationModel;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pathname: string;
}) {
  const { t } = useTranslation();

  function close() {
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85dvh] overscroll-contain px-0 pb-[env(safe-area-inset-bottom,0px)]"
      >
        <SheetHeader className="px-4">
          <SheetTitle>{t("app.moreNavigation")}</SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-6">
          <Accordion type="multiple" className="w-full">
            {model.more.map((item) =>
              item.children?.length ? (
                <MoreGroup
                  key={item.title}
                  item={item}
                  onNavigate={close}
                  pathname={pathname}
                />
              ) : (
                <MoreLeaf
                  key={item.path ?? item.title}
                  item={item}
                  onNavigate={close}
                  pathname={pathname}
                />
              ),
            )}
          </Accordion>

          <Separator className="my-4" />
          <AppearanceSection />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MoreGroup({
  item,
  onNavigate,
  pathname,
}: {
  item: MenuItem;
  onNavigate: () => void;
  pathname: string;
}) {
  const { t } = useTranslation();

  return (
    <AccordionItem value={item.title} className="border-b-0">
      <AccordionTrigger className="min-h-12 px-2 text-sm font-semibold hover:no-underline">
        <span className="flex min-w-0 items-center gap-3">
          {item.iconName ? (
            <MenuIcon value={item.iconName} className="size-5 shrink-0" />
          ) : null}
          <span className="truncate">{menuItemLabel(item, t)}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-1">
        {item.children?.map((child) => (
          <MoreLink
            key={child.path ?? child.title}
            indented
            item={child}
            onNavigate={onNavigate}
            pathname={pathname}
          />
        ))}
      </AccordionContent>
    </AccordionItem>
  );
}

function MoreLeaf({
  item,
  onNavigate,
  pathname,
}: {
  item: MenuItem;
  onNavigate: () => void;
  pathname: string;
}) {
  return (
    <MoreLink item={item} onNavigate={onNavigate} pathname={pathname} />
  );
}

function MoreLink({
  indented,
  item,
  onNavigate,
  pathname,
}: {
  indented?: boolean;
  item: MenuItem;
  onNavigate: () => void;
  pathname: string;
}) {
  const { t } = useTranslation();
  const label = menuItemLabel(item, t);
  const active = routeIsActive(pathname, item.path);

  if (item.disabled || !item.path) {
    return (
      <span
        aria-disabled="true"
        className={cn(
          "flex min-h-12 items-center gap-3 rounded-md px-2 text-sm opacity-50",
          indented && "pl-10",
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={internalRoute(item.path)}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-md px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        indented && "pl-10",
        active ? "font-semibold text-primary" : "hover:bg-accent",
      )}
    >
      {!indented && item.iconName ? (
        <MenuIcon value={item.iconName} className="size-5 shrink-0" />
      ) : null}
      <span className="truncate">{label}</span>
    </Link>
  );
}

// FloatingSettingsButton เป็น affordance ของเว็บเดสก์ท็อป (ลากได้ ผูกกับ .app-header)
// บนแอปจริงการตั้งค่าหน้าตาอยู่ในรายการแบบ Settings — ย้ายมาไว้ที่นี่แทน
function AppearanceSection() {
  const { t } = useTranslation();
  const themeColor = useAppStore((state) => state.themeColor);
  const setThemeColor = useAppStore((state) => state.setThemeColor);
  const fontScale = useAppStore((state) => state.fontScale);
  const setFontScale = useAppStore((state) => state.setFontScale);

  return (
    <section className="flex flex-col gap-4 px-2">
      <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {t("app.appearance.title")}
      </h2>

      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold text-muted-foreground">
          {t("app.appearance.colorLabel")}
        </Label>
        <RadioGroup
          value={themeColor}
          onValueChange={(value) => setThemeColor(value as ThemeColor)}
          className="flex flex-row flex-wrap gap-3"
        >
          {THEME_COLORS.map((color) => (
            <Label
              key={color}
              htmlFor={`native-theme-color-${color}`}
              data-theme-color={color}
              className="relative flex size-11 cursor-pointer items-center justify-center rounded-full bg-primary ring-1 ring-foreground/10 ring-offset-2 ring-offset-background transition-shadow has-data-[state=checked]:ring-2 has-data-[state=checked]:ring-foreground/60"
            >
              <RadioGroupItem
                id={`native-theme-color-${color}`}
                value={color}
                className="sr-only"
              />
              <span className="sr-only">
                {t(`app.appearance.colors.${color}`)}
              </span>
            </Label>
          ))}
        </RadioGroup>
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-xs font-semibold text-muted-foreground">
          {t("app.appearance.fontSizeLabel")}
        </Label>
        <ToggleGroup
          type="single"
          variant="outline"
          value={fontScale}
          onValueChange={(value) => {
            if (value) setFontScale(value as FontScale);
          }}
          className="w-full"
        >
          {FONT_SCALES.map((scale) => (
            <ToggleGroupItem
              key={scale}
              value={scale}
              className="h-11 flex-1 text-xs font-bold"
            >
              {t(`app.appearance.fontSizes.${scale}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Mount the sheet in the shell**

In `src/components/layout/capacitor/app-shell.tsx`, add:

```tsx
import { NativeMoreSheet } from "@/components/layout/capacitor/more-sheet";
```

and render it as the last child of the shell root, after `<NativeBottomNav ... />`:

```tsx
      <NativeMoreSheet
        model={model}
        onOpenChange={setMoreOpen}
        open={moreOpen}
        pathname={pathname}
      />
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck`
Expected: no errors — if the `MoreGroup` closing tag was left wrong, this is where it fails.

Run: `npm test`
Expected: all suites pass

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/accordion.tsx src/components/layout/capacitor/more-sheet.tsx src/components/layout/capacitor/app-shell.tsx package.json package-lock.json
git commit -m "feat(layout): add the Capacitor More sheet with grouped menu and appearance settings"
```

---

### Task 7: Android hardware back button and soft-keyboard handling

**Files:**
- Create: `src/components/layout/capacitor/use-android-back-button.ts`
- Create: `src/components/layout/capacitor/use-keyboard-visible.ts`
- Modify: `src/components/layout/capacitor/app-shell.tsx`

**Interfaces:**
- Consumes: `resolveAndroidBackAction`, `NativeNavigationModel` (Task 2)
- Produces: `useAndroidBackButton({ model, onCloseOverlay, overlayOpen, pathname })`, `useKeyboardVisible()`

- [ ] **Step 1: Write the keyboard hook**

Create `src/components/layout/capacitor/use-keyboard-visible.ts`:

```ts
"use client";

import { useEffect, useState } from "react";

// เกณฑ์นี้กัน false positive จากแถบ URL ที่ยุบ/ขยายบนมือถือ ซึ่งสูงไม่ถึงคีย์บอร์ดจริง
const KEYBOARD_MIN_HEIGHT_RATIO = 0.2;

// ไม่ใช้ @capacitor/keyboard เพราะ visualViewport ให้ข้อมูลเดียวกันโดยไม่ต้องเพิ่ม native plugin
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    function sync() {
      if (!viewport) return;
      const occluded = window.innerHeight - viewport.height;
      setVisible(occluded > window.innerHeight * KEYBOARD_MIN_HEIGHT_RATIO);
    }

    sync();
    viewport.addEventListener("resize", sync);
    return () => viewport.removeEventListener("resize", sync);
  }, []);

  return visible;
}
```

- [ ] **Step 2: Write the back-button hook**

Create `src/components/layout/capacitor/use-android-back-button.ts`:

```ts
"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { useRouter } from "next/navigation";
import {
  resolveAndroidBackAction,
  type NativeNavigationModel,
} from "@/components/layout/native-navigation-model";
import { isCapacitorNativeApp } from "@/lib/capacitor-platform";
import { internalRoute } from "@/lib/routes";

export function useAndroidBackButton({
  model,
  onCloseOverlay,
  overlayOpen,
  pathname,
}: {
  model: NativeNavigationModel;
  onCloseOverlay: () => void;
  overlayOpen: boolean;
  pathname: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!isCapacitorNativeApp()) return;

    // addListener คืน Promise ของ handle — ต้องเก็บไว้ถอดตอน unmount ไม่งั้น listener ซ้อนกันทุกครั้งที่ deps เปลี่ยน
    const handle = App.addListener("backButton", ({ canGoBack }) => {
      const action = resolveAndroidBackAction({
        canGoBack,
        model,
        overlayOpen,
        pathname,
      });

      switch (action.type) {
        case "close-overlay":
          onCloseOverlay();
          return;
        case "navigate":
          router.push(internalRoute(action.path));
          return;
        case "history-back":
          router.back();
          return;
        case "minimize":
          // ห้าม App.exitApp() — ผู้ใช้ POS กดพลาดแล้วแอปตายกลางบิล
          void App.minimizeApp();
          return;
      }
    });

    return () => {
      void handle.then((listener) => listener.remove());
    };
  }, [model, onCloseOverlay, overlayOpen, pathname, router]);
}
```

- [ ] **Step 3: Wire both into the shell**

In `src/components/layout/capacitor/app-shell.tsx`, add:

```tsx
import { useCallback } from "react";
import { useAndroidBackButton } from "@/components/layout/capacitor/use-android-back-button";
import { useKeyboardVisible } from "@/components/layout/capacitor/use-keyboard-visible";
```

Inside `NativeAppShell`, after the `moreOpen` state:

```tsx
  const keyboardVisible = useKeyboardVisible();
  const closeMore = useCallback(() => setMoreOpen(false), []);

  useAndroidBackButton({
    model,
    onCloseOverlay: closeMore,
    overlayOpen: moreOpen,
    pathname,
  });
```

Add the keyboard flag to the shell root's attributes, next to `data-platform`:

```tsx
      data-keyboard-open={keyboardVisible ? "true" : "false"}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck`
Expected: no errors

Run: `npm test`
Expected: all suites pass

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/capacitor
git commit -m "feat(layout): handle Android hardware back and soft keyboard in the Capacitor shell"
```

---

### Task 8: Route-transition progress indicator

**Files:**
- Create: `src/components/layout/capacitor/route-progress.tsx`
- Modify: `src/components/layout/capacitor/app-shell.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `NativeRouteProgress()`

- [ ] **Step 1: Add the animation**

Append to `src/app/globals.css`, after the `.native-top-bar` rules:

```css
@keyframes native-route-progress {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(300%);
  }
}

.native-route-progress-bar {
  animation: native-route-progress 1.1s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .native-route-progress-bar {
    animation: none;
    transform: none;
    width: 100%;
    opacity: 0.6;
  }
}
```

- [ ] **Step 2: Write the indicator**

Create `src/components/layout/capacitor/route-progress.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useLinkStatus } from "next/link";

// รอ 120ms ก่อนโชว์ — transition ที่เร็วกว่านั้นทำให้แถบกระพริบแทนที่จะสื่อความ
const PROGRESS_DELAY_MS = 120;

export function NativeRouteProgress() {
  const { pending } = useLinkStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pending) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), PROGRESS_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden bg-transparent"
    >
      <div className="native-route-progress-bar h-full w-1/3 bg-primary" />
    </div>
  );
}
```

`useLinkStatus` only reports for the `<Link>` that owns it, so render this **inside** `NavDestinationButton`'s and `MoreLink`'s `<Link>` rather than once at shell level.

- [ ] **Step 3: Render it inside the navigating links**

In `src/components/layout/capacitor/nav-destination-button.tsx`, import it:

```tsx
import { NativeRouteProgress } from "@/components/layout/capacitor/route-progress";
```

and add `<NativeRouteProgress />` as the last child inside `NavDestinationButton`'s `<Link>`, then add `relative` to that `<Link>`'s className.

Do the same in `more-sheet.tsx`'s `MoreLink` `<Link>`.

- [ ] **Step 4: Verify**

Run: `npm run typecheck`
Expected: no errors

Run: `npm test`
Expected: all suites pass

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/capacitor src/app/globals.css
git commit -m "feat(layout): show route-transition progress on Capacitor navigation"
```

---

### Task 9: Device verification

No source changes unless a defect is found. This is the acceptance gate that the earlier tasks' unit tests cannot cover.

**Files:** none by default

- [ ] **Step 1: Build and run on a real Android device**

Confirm `capacitor.config.ts`'s `server.url` points at the dev machine (`http://localhost:3000` with `adb reverse tcp:3000 tcp:3000`), then run the app on a physical phone.

- [ ] **Step 2: Phone checks**

- Bottom nav shows exactly the first 3 permission-menu items plus More.
- Tapping a group destination (e.g. Sales) lands on its first child, and the tab stays highlighted on sibling children.
- `/pos/tables` and `/pos/order` show the nav chrome (they must not go full-screen).
- Opening a text field hides the bottom nav; dismissing the keyboard restores it.
- Hardware back: closes the More sheet first; from `/pos/order` returns to `/pos/tables`; at the dashboard it minimizes the app rather than closing it.
- Both light and dark mode.
- Lao and English, checking that long Lao labels truncate rather than wrap.

- [ ] **Step 3: Tablet checks**

Repeat on a tablet (or a >=768px emulator): the side rail replaces the bottom bar, the More sheet still opens, and content is not stretched edge-to-edge unreadably.

- [ ] **Step 4: Web regression check**

In a desktop browser and at a narrow browser width, confirm the sidebar shell is unchanged and no bottom nav appears.

- [ ] **Step 5: Record the result**

Note anything that needs follow-up in the PR description. If the tablet rail's three destinations read as too sparse, raising `NATIVE_DIRECT_DESTINATION_COUNT` for the rail is the pre-agreed one-constant change.

---

## Notes for the implementer

- `AuthGuard` renders `LoadingState` until the auth store hydrates, so neither shell is ever server-rendered. Do not add User-Agent or SSR platform detection.
- Do not fold `--app-shell-bottom-nav-height` into `--pos-system-bottom-safe-area`. The latter is consumed by modal sheet footers (`order-customer-product-options.tsx:685`, `payment-dialog-content.tsx:728`) which portal above the bottom nav; adding nav height there creates dead space.
- `FloatingSettingsButton` is deliberately absent from the Capacitor shell. Its settings live in the More sheet instead. Do not add it back — its `clampPosition()` reads `document.querySelector(".app-header")`, which the native shell does not render.
- `SidebarProvider` is deliberately absent. Verified: nothing outside `components/ui/sidebar.tsx` and the web shell consumes `useSidebar`.
- Page-transition motion is deliberately **not** in this plan (spec §9). Do not add `AnimatePresence` around `children` — it fights scroll restoration and reflows the fixed-height screens. The progress line from Task 8 is the agreed feedback mechanism.
- Verified against the installed versions while writing this plan: `useLinkStatus` is re-exported from `next/link` (Next 16.3), and `MenuIcon` forwards `className` to `DynamicIcon`.
