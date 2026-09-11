# Web AppHeader Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the web `AppHeader` (in `src/components/layout/web/app-shell.tsx`) to look modern, minimal, clean, elegant, and premium — soft glass surface, tighter typographic hierarchy, and a grouped right-side action toolbar — with zero change to behavior, routes, data flow, or layout height.

**Architecture:** Pure Tailwind className changes to the existing `AppHeader` and `AppBreadcrumb` functions in one file. No new components, no new props, no new dependencies. All colors/spacing come from existing semantic tokens already defined in `src/app/globals.css` (`bg-background`, `bg-muted`, `border-border`, `text-muted-foreground`, `ring-primary`, etc.) plus Tailwind's built-in opacity-suffix syntax (`bg-background/80`) which composes with any token.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, shadcn/ui.

## Global Constraints

- No raw palette colors, arbitrary fonts, or new global CSS (CLAUDE.md Non-negotiable #8) — every value in this plan is an existing semantic token, an opacity-suffixed existing token, or a bare Tailwind utility (`rounded-full`, `gap-*`, `p-1`) with no color of its own.
- `--app-shell-header-height` must not change — do not add height, padding-block, or line-height changes to the `<header>` element itself; every change here is background/border/radius/hover/typography only.
- Every existing `aria-label`, `Tooltip` trigger/content, i18n key (`t("...")`), and `data-icon` attribute stays exactly as-is — this is a visual-only pass.
- Full keyboard operability and visible focus states must be preserved (Design.md accessibility floor) — do not remove or replace any `focus-visible:ring` behavior that shadcn's `Button`/`DropdownMenuTrigger` provide by default.
- Verification per task is `npm run typecheck`, `npm run lint`, and a manual check in the browser preview (light + dark theme) — this codebase does not unit-test components (CLAUDE.md / component test convention confirmed in `docs/superpowers/plans/2026-08-28-pos-operational-motion-polish.md`).

---

## Task 1: Header surface + brand block

**Files:**
- Modify: `src/components/layout/web/app-shell.tsx:191` (`<header>` className)
- Modify: `src/components/layout/web/app-shell.tsx:198-224` (brand `Link`, `Avatar`, `branchTitle` span)
- Modify: `src/components/layout/web/app-shell.tsx:236` (remove the vertical `Separator`)

**Interfaces:** None — pure className changes. Nothing else in the codebase depends on this task's output; Task 2 and Task 3 touch different, non-overlapping lines in the same file.

- [ ] **Step 1: Give the header a glass surface instead of a hard border**

In `src/components/layout/web/app-shell.tsx`, find the `<header>` opening tag (around line 191):

```tsx
    <header className="app-header sticky top-0 z-40 flex h-(--app-shell-header-height) w-full items-center justify-between gap-2 border-b border-border px-2 sm:px-4 lg:gap-4 lg:px-6">
```

Replace with:

```tsx
    <header className="app-header sticky top-0 z-40 flex h-(--app-shell-header-height) w-full items-center justify-between gap-2 bg-background/80 px-2 shadow-sm backdrop-blur-md sm:px-4 lg:gap-4 lg:px-6">
```

(Dropped `border-b border-border`, added `bg-background/80 backdrop-blur-md shadow-sm`. Height, sticky, z-index, padding, gap unchanged.)

- [ ] **Step 2: Remove the hard divider between brand and nav**

Find the `Separator` right after the brand `Tooltip` block (around line 236):

```tsx
        <Separator orientation="vertical" className="hidden h-12 md:block" />

        <div className="flex min-w-0 flex-1 items-center gap-1 md:gap-2">
```

Replace with:

```tsx
        <div className="flex min-w-0 flex-1 items-center gap-1 md:gap-2 md:pl-2">
```

(Deletes the `Separator` element entirely; `md:pl-2` recovers a little of the breathing room the separator's own width used to provide, without a hard line. The `Separator` import at the top of the file is still used elsewhere in this codebase — do not remove the import statement.)

- [ ] **Step 3: Verify the `Separator` import is still needed elsewhere**

Run:

```bash
grep -rn "Separator" src/components/layout/web/app-shell.tsx
```

Expected: the `import { Separator } from "@/components/ui/separator";` line still has no other usage in this file after Step 2 — if so, remove that import line (unused import fails `npm run lint`). If some other usage remains, leave the import.

- [ ] **Step 4: Soften the avatar, tighten the brand name**

Find the `Avatar` and its children (around lines 205-210):

```tsx
              <Avatar className="size-12.5 shrink-0 rounded-md">
                <AvatarImage src={logoSrc} alt={branchTitle} />
                <AvatarFallback className="rounded-md font-black">
                  {userInitials(user)}
                </AvatarFallback>
              </Avatar>
```

Replace with:

```tsx
              <Avatar className="size-12.5 shrink-0 rounded-xl ring-1 ring-border/50 transition-shadow group-hover:ring-primary/30 group-focus-visible:ring-primary/30">
                <AvatarImage src={logoSrc} alt={branchTitle} />
                <AvatarFallback className="rounded-xl font-black">
                  {userInitials(user)}
                </AvatarFallback>
              </Avatar>
```

Then find the parent `Link` (around line 198) and add the `group` class so `group-hover`/`group-focus-visible` above can target it:

```tsx
              className={cn(
                "hidden min-w-0 shrink-0 items-center md:flex",
```

Replace with:

```tsx
              className={cn(
                "group hidden min-w-0 shrink-0 items-center md:flex",
```

Then find the `branchTitle` span (around line 217):

```tsx
                <span className="truncate text-base font-black text-primary">
                  {branchTitle}
                </span>
```

Replace with:

```tsx
                <span className="truncate text-base font-black tracking-tight text-primary">
                  {branchTitle}
                </span>
```

- [ ] **Step 5: Typecheck and lint**

Run:

```bash
npm run typecheck
```

Expected: no errors.

Run:

```bash
npm run lint
```

Expected: no errors (confirms the `Separator` import was handled correctly in Step 3).

- [ ] **Step 6: Manual visual check**

Start the dev server preview (`npm run dev`), open a protected route (any page behind `AuthGuard`), and confirm at `md`+ width:
- Header background is translucent/blurred (visible if you scroll page content behind it), with a soft shadow instead of a hard bottom line.
- No vertical divider between the store logo/name and the back button/breadcrumb area.
- Avatar has rounded corners (not a hard square) and a subtle ring that becomes more visible on hover/focus of the brand link.
- Store name text looks slightly tighter (`tracking-tight`).

Check both light and dark theme via `ThemeToggle`.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/web/app-shell.tsx
git commit -m "$(cat <<'EOF'
Redesign header surface and brand block for a softer, premium look

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Navigation (back button) + breadcrumb hierarchy

**Files:**
- Modify: `src/components/layout/web/app-shell.tsx:239-270` (`SidebarTrigger` tooltip button, mobile `ChevronLeft` button, desktop back `Button`)
- Modify: `src/components/layout/web/app-shell.tsx:370-385` (`AppBreadcrumb`'s `renderItem` function)
- Modify: `src/components/layout/web/app-shell.tsx:400,439` (`BreadcrumbSeparator` usages)

**Interfaces:** None — pure className changes. Depends on nothing from Task 1 (non-overlapping lines); can be reviewed independently.

- [ ] **Step 1: Pill-hover the mobile icon buttons**

Find the `SidebarTrigger` (around line 241-244):

```tsx
              <SidebarTrigger
                aria-label={t("app.openMenu")}
                className="size-11 shrink-0 sm:size-9 md:hidden"
              />
```

Replace with:

```tsx
              <SidebarTrigger
                aria-label={t("app.openMenu")}
                className="size-11 shrink-0 rounded-full hover:bg-muted sm:size-9 md:hidden"
              />
```

Find the mobile back `Button` (around lines 250-259):

```tsx
              <Button
                type="button"
                variant="ghost"
                className="size-11 shrink-0 text-primary sm:size-9 md:hidden"
                aria-label={t("actions.back")}
                onClick={() => router.back()}
              >
                <ChevronLeft data-icon="inline-start" />
              </Button>
```

Replace the `className` line with:

```tsx
                className="size-11 shrink-0 rounded-full text-primary hover:bg-muted sm:size-9 md:hidden"
```

- [ ] **Step 2: Pill-hover the desktop back button**

Find the desktop back `Button` (around lines 262-270):

```tsx
          <Button
            type="button"
            variant="ghost"
            className="hidden h-10 gap-2 px-2 text-primary md:inline-flex"
            onClick={() => router.back()}
          >
            <ChevronLeft data-icon="inline-start" />
            {t("actions.back")}
          </Button>
```

Replace the `className` line with:

```tsx
            className="hidden h-10 gap-2 rounded-full px-3 text-primary hover:bg-muted md:inline-flex"
```

(`px-2` → `px-3` so the now-visible pill background has room to breathe around the text; `gap-2` and icon/text content unchanged.)

- [ ] **Step 3: Add hierarchy to breadcrumb trail vs. current page**

Find `renderItem` inside `AppBreadcrumb` (around lines 370-385):

```tsx
  function renderItem(item: BreadcrumbTrailItem, current: boolean) {
    const title = menuItemLabel(item, t);
    if (current || item.disabled || !item.path) {
      return (
        <BreadcrumbPage className="truncate font-semibold">
          {title}
        </BreadcrumbPage>
      );
    }

    return (
      <BreadcrumbLink asChild className="truncate">
        <Link href={internalRoute(item.path)}>{title}</Link>
      </BreadcrumbLink>
    );
  }
```

Replace with:

```tsx
  function renderItem(item: BreadcrumbTrailItem, current: boolean) {
    const title = menuItemLabel(item, t);
    if (current) {
      return (
        <BreadcrumbPage className="truncate font-semibold text-foreground">
          {title}
        </BreadcrumbPage>
      );
    }
    if (item.disabled || !item.path) {
      return (
        <BreadcrumbPage className="truncate text-muted-foreground/70">
          {title}
        </BreadcrumbPage>
      );
    }

    return (
      <BreadcrumbLink asChild className="truncate text-muted-foreground/70">
        <Link href={internalRoute(item.path)}>{title}</Link>
      </BreadcrumbLink>
    );
  }
```

(Splits the old combined `current || item.disabled || !item.path` branch into a `current` branch — unchanged behavior, styled as the strong/foreground item — and a separate disabled/no-path branch, now visually matched to the muted trail-link styling instead of accidentally looking as bold as the current page.)

- [ ] **Step 4: Fade the breadcrumb separators**

Find both `BreadcrumbSeparator` usages (around lines 400 and 439) — they currently have no className:

```tsx
            <BreadcrumbSeparator />
```

Replace **each** occurrence with:

```tsx
            <BreadcrumbSeparator className="opacity-50" />
```

- [ ] **Step 5: Typecheck and lint**

Run:

```bash
npm run typecheck
```

Expected: no errors.

Run:

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Manual visual check**

On a protected route with a multi-level breadcrumb (e.g. navigate two levels deep into Reports):
- Mobile width: back icon button and sidebar-trigger icon button show a soft rounded hover background.
- Desktop width (`lg`+, where breadcrumb is visible): back button (icon+text) shows the same pill hover; breadcrumb trail items are visually lighter/muted than the current (last) page, which is bold and full-contrast; separators between crumbs are subtle/faded.
- Click through: back button still navigates back, breadcrumb links still navigate, overflow ellipsis dropdown (if breadcrumb has 4+ levels) still opens and its items still navigate.
- Check both light and dark theme.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/web/app-shell.tsx
git commit -m "$(cat <<'EOF'
Add pill hover states and breadcrumb hierarchy to header navigation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Right-side action toolbar + profile

**Files:**
- Modify: `src/components/layout/web/app-shell.tsx:281-354` (the right-side `div` containing refresh/theme/notification/language/profile)

**Interfaces:** None — pure className/JSX-wrapper changes. Depends on nothing from Task 1 or Task 2 (non-overlapping lines); can be reviewed independently.

- [ ] **Step 1: Wrap refresh/theme/notification/language in a pill toolbar**

Find the right-side action `div` (around lines 281-303):

```tsx
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {isCapacitorNativeApp ? (
          // Capacitor ไม่มี pull-to-refresh/ปุ่ม reload ของเบราว์เซอร์ให้ผู้ใช้ ต้องมีทางรีโหลด
          // เอง โดยเฉพาะช่วง dev ที่ server.url ชี้ dev server ในเครื่อง
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="size-11 shrink-0 sm:size-9"
                aria-label={t("app.refreshApp")}
                onClick={() => window.location.reload()}
              >
                <RefreshCw />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("app.refreshApp")}</TooltipContent>
          </Tooltip>
        ) : null}
        <ThemeToggle variant="ghost" className="size-11 sm:size-9" />
        <NotificationMenu triggerClassName="size-11 sm:size-9" />
        <LanguageSwitch compact size="icon" className="size-11 sm:size-9" />
        <DropdownMenu>
```

Replace with:

```tsx
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-0.5 rounded-full bg-muted/40 p-1">
          {isCapacitorNativeApp ? (
            // Capacitor ไม่มี pull-to-refresh/ปุ่ม reload ของเบราว์เซอร์ให้ผู้ใช้ ต้องมีทางรีโหลด
            // เอง โดยเฉพาะช่วง dev ที่ server.url ชี้ dev server ในเครื่อง
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="size-11 shrink-0 rounded-full hover:bg-background sm:size-9"
                  aria-label={t("app.refreshApp")}
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("app.refreshApp")}</TooltipContent>
            </Tooltip>
          ) : null}
          <ThemeToggle
            variant="ghost"
            className="size-11 rounded-full hover:bg-background sm:size-9"
          />
          <NotificationMenu triggerClassName="size-11 rounded-full hover:bg-background sm:size-9" />
          <LanguageSwitch
            compact
            size="icon"
            className="size-11 rounded-full hover:bg-background sm:size-9"
          />
        </div>
        <DropdownMenu>
```

(New wrapping `div` provides the pill container; each button inside gains `rounded-full hover:bg-background` so it visually "lifts" off the `bg-muted/40` pill on hover, replacing the default ghost-button hover. `ThemeToggle`, `NotificationMenu`, `LanguageSwitch` already accept a `className`/`triggerClassName` prop for their trigger button per their existing usage here — no prop-shape change needed.)

- [ ] **Step 2: Match the profile trigger's hover to the toolbar family**

Find the `DropdownMenuTrigger`'s `Button` (around lines 306-311, now shifted a few lines down after Step 1's edit — locate by content, not exact line number):

```tsx
                <Button
                  variant="ghost"
                  aria-label={user?.email ?? t("profile.sections.account")}
                  className="h-11 min-w-11 gap-2 px-0 sm:h-10 sm:min-w-10 sm:px-2"
                >
```

Replace the `className` line with:

```tsx
                  className="h-11 min-w-11 gap-2 rounded-full px-0 hover:bg-muted sm:h-10 sm:min-w-10 sm:px-2"
```

- [ ] **Step 3: Typecheck and lint**

Run:

```bash
npm run typecheck
```

Expected: no errors.

Run:

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Manual visual check**

On a protected route, at desktop width:
- Theme toggle, notification bell, language switch (and refresh icon, if testing in a Capacitor/native build — otherwise skip, it won't render on web) sit inside one soft rounded-pill background, close together with no visible separators between them.
- Hovering/focusing each individual button shows a distinct lighter "lift" background against the pill's own tint.
- Profile avatar+email+chevron button, just to the right of the pill, shows a matching soft rounded hover background; clicking it still opens the dropdown with Edit Profile / Policy / Sign Out working as before.
- Repeat at mobile/tablet width — icons should still be tappable at their existing touch-target size (`size-11` on mobile), just with the added pill treatment.
- Check both light and dark theme — `bg-muted/40` and `hover:bg-background` should both read clearly in each.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/web/app-shell.tsx
git commit -m "$(cat <<'EOF'
Group header right-side actions into a pill toolbar

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
