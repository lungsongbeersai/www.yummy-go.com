# Shadcn Design System Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make shadcn/ui the primary UI system and centralize developer-managed font and theme configuration without a new styling library.

**Architecture:** `components.json` remains the shadcn CLI configuration and `src/app/globals.css` remains the only semantic theme-token stylesheet. `src/design-system/` centralizes the font-variable contract and `next/font` declarations; the root layout applies their classes once.

**Tech Stack:** Next.js 16 App Router, `next/font`, TypeScript, Tailwind CSS v4, shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-18-shadcn-design-system-design.md`

## Global Constraints

- Do not add a UI, theme, CSS-in-JS, or state-management dependency.
- Use shadcn/ui components and variants before Tailwind utilities.
- Tailwind is only for semantic tokens, layout, responsive behavior, and composition not supplied by shadcn.
- `src/app/globals.css` owns light/dark color, chart, radius, and font token mappings.
- Use `next/font`; runtime font selection is out of scope.
- Preserve Android WebView compatibility and print CSS exceptions.
- Do not migrate the pre-existing full-preset component API breakages in this change.

---

## File Structure

- Create `src/design-system/config.ts`: immutable metadata for token path, theme modes, and named font variables.
- Create `src/design-system/fonts.ts`: `next/font/google` declarations and root variable classes.
- Create `src/design-system/config.test.ts`: pure configuration contract test.
- Modify `src/app/layout.tsx`: consume the shared root font classes.
- Modify `src/app/globals.css`: expose `font-lao` as a semantic Tailwind v4 token.
- Create `docs/design-system.md`: contributor reference and safe preset workflow.
- Modify `CLAUDE.md` and `AGENTS.md`: mirrored design-system conventions only; preserve AGENTS managed blocks.

### Task 1: Centralize Font Metadata and Loaders

**Files:**
- Create: `src/design-system/config.ts`, `src/design-system/fonts.ts`, `src/design-system/config.test.ts`

**Interfaces:**
- Produces `DESIGN_SYSTEM` with `tokens.stylesheet`, `theme.modes`, and `fonts.sans|lao.variable|utility`.
- Produces `appFonts` and `appFontVariables` for the root layout.

- [ ] **Step 1: Write the failing configuration contract test**

```ts
import { describe, expect, it } from "vitest";
import { DESIGN_SYSTEM } from "@/design-system/config";

describe("DESIGN_SYSTEM", () => {
  it("declares the shadcn token stylesheet and theme modes", () => {
    expect(DESIGN_SYSTEM.tokens.stylesheet).toBe("src/app/globals.css");
    expect(DESIGN_SYSTEM.theme.modes).toEqual(["light", "dark"]);
  });
  it("exposes stable semantic font variables", () => {
    expect(DESIGN_SYSTEM.fonts.sans).toEqual({ variable: "--font-sans", utility: "font-sans" });
    expect(DESIGN_SYSTEM.fonts.lao).toEqual({ variable: "--font-noto-sans-lao", utility: "font-lao" });
  });
});
```

- [ ] **Step 2: Verify the test fails**

Run `npx vitest run src/design-system/config.test.ts`; expect module-not-found for `@/design-system/config`.

- [ ] **Step 3: Implement the immutable configuration**

```ts
export const DESIGN_SYSTEM = {
  tokens: { stylesheet: "src/app/globals.css" },
  theme: { modes: ["light", "dark"] },
  fonts: {
    sans: { variable: "--font-sans", utility: "font-sans" },
    lao: { variable: "--font-noto-sans-lao", utility: "font-lao" },
  },
} as const;
```

- [ ] **Step 4: Add `src/design-system/fonts.ts`**

```ts
import { Noto_Sans, Noto_Sans_Lao } from "next/font/google";
import { DESIGN_SYSTEM } from "@/design-system/config";

const sans = Noto_Sans({ subsets: ["latin"], variable: DESIGN_SYSTEM.fonts.sans.variable });
const lao = Noto_Sans_Lao({
  subsets: ["lao"], weight: ["400", "500", "600", "700", "900"],
  display: "swap", variable: DESIGN_SYSTEM.fonts.lao.variable,
});
export const appFonts = { sans, lao } as const;
export const appFontVariables = `${appFonts.sans.variable} ${appFonts.lao.variable}`;
```

- [ ] **Step 5: Verify and commit**

Run `npx vitest run src/design-system/config.test.ts`; expect 2 passing tests.

```bash
git add src/design-system/config.ts src/design-system/fonts.ts src/design-system/config.test.ts
git commit -m "feat: centralize design system font configuration"
```

### Task 2: Wire Font Tokens into the Root Document

**Files:**
- Modify: `src/app/layout.tsx`, `src/app/globals.css`, `src/design-system/config.test.ts`

**Interfaces:**
- Consumes `appFontVariables` from `@/design-system/fonts`.
- Produces document-loaded font variables and `font-lao`.

- [ ] **Step 1: Add failing source assertions to `config.test.ts`**

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("maps the Lao variable into Tailwind", () => {
  const css = readFileSync(resolve(process.cwd(), DESIGN_SYSTEM.tokens.stylesheet), "utf8");
  expect(css).toContain("--font-lao: var(--font-noto-sans-lao);");
});
it("applies shared font variables in the root layout", () => {
  const layout = readFileSync(resolve(process.cwd(), "src/app/layout.tsx"), "utf8");
  expect(layout).toContain('import { appFontVariables } from "@/design-system/fonts";');
  expect(layout).toContain('cn("font-sans", appFontVariables)');
});
```

- [ ] **Step 2: Verify the source assertions fail**

Run `npx vitest run src/design-system/config.test.ts`; expect the two new assertions to fail.

- [ ] **Step 3: Replace local layout fonts**

Remove the `Noto_Sans` and `Noto_Sans_Lao` imports and local declarations from `src/app/layout.tsx`. Import `appFontVariables` and change the html class to `cn("font-sans", appFontVariables)`.

- [ ] **Step 4: Expose the semantic Lao token**

Inside the existing `@theme inline` block in `src/app/globals.css`, add exactly:

```css
--font-lao: var(--font-noto-sans-lao);
```

Do not relocate platform, print, or animation CSS.

- [ ] **Step 5: Verify and commit**

Run `npx vitest run src/design-system/config.test.ts`; expect 4 passing tests. Run `npm run typecheck`; record its known full-preset failures, confirming none originate from `src/design-system/` or the root font wiring.

```bash
git add src/app/layout.tsx src/app/globals.css src/design-system/config.test.ts
git commit -m "feat: expose design system font tokens"
```

### Task 3: Publish Design-System Rules

**Files:**
- Create: `docs/design-system.md`
- Modify: `CLAUDE.md`, `AGENTS.md`

**Interfaces:**
- Documents `components.json`, `src/app/globals.css`, `src/design-system/config.ts`, and `src/design-system/fonts.ts` as sources of truth.

- [ ] **Step 1: Create the contributor guide**

Create headings `Sources of Truth`, `Component and Styling Decision Order`, `Theme Tokens`, `Typography`, `Safe shadcn Preset Changes`, and `Allowed CSS Exceptions`. State: shadcn component/variant first; composition second; semantic Tailwind only for allowed gaps; no raw colors or arbitrary font families; custom CSS only for platform/print/motion/browser limits.

- [ ] **Step 2: Document the safe preset command**

Include this exact command and explain that full apply needs an approved component API migration:

```bash
pnpm dlx shadcn@latest apply --preset <preset-code> --only theme,font
```

- [ ] **Step 3: Mirror the agent rules**

Add an identical `**Design system**` bullet after `**UI**` in `CLAUDE.md` and `AGENTS.md`, covering decision order, CSS restrictions, source-of-truth files, `next/font`, and the safe preset command. Do not modify the Hermes-Evolution or generated Next.js blocks in `AGENTS.md`.

- [ ] **Step 4: Verify and commit**

Run `git diff --check -- CLAUDE.md AGENTS.md docs/design-system.md` (expect exit 0) and `rg -n "Design system|shadcn/ui|--only theme,font" CLAUDE.md AGENTS.md docs/design-system.md` (expect matches in all files).

```bash
git add CLAUDE.md AGENTS.md docs/design-system.md
git commit -m "docs: establish shadcn design system rules"
```

### Task 4: Final Verification

**Files:** verify all Task 1–3 files.

- [ ] **Step 1: Run focused tests**

Run `npx vitest run src/design-system/config.test.ts`; expect 4 passing tests.

- [ ] **Step 2: Run lint and typecheck**

Run `npm run lint` and `npm run typecheck`. Report separately the known full-preset failures only; changed files must not introduce further failures.

- [ ] **Step 3: Check both modes manually**

Run `npm run dev`. On login and an authenticated screen, switch light/dark mode, check contrast and no hydration flash, and inspect an element using `font-lao` to confirm it resolves to `var(--font-noto-sans-lao)`.

- [ ] **Step 4: Commit only corrections discovered by verification**

```bash
git status --short
git add <only corrected files>
git commit -m "fix: verify design system configuration"
```

Skip this commit when verification needs no corrections.

## Self-Review

- Spec coverage: Task 1 centralizes metadata and fonts; Task 2 wires Next.js and Tailwind; Task 3 creates the contributor and agent rules; Task 4 verifies the scoped change.
- Placeholder scan: no unresolved implementation actions; full preset compatibility work remains explicitly excluded.
- Type consistency: `DESIGN_SYSTEM` and `appFontVariables` are defined before use and retain the same names in every task.
