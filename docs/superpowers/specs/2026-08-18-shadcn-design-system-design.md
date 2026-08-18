# Shadcn Design System Configuration

## Objective

Make shadcn/ui the project’s primary UI system and make visual foundations configurable at development time. Theme, colors, radius, and fonts must each have a single documented source of truth without adding a second UI or styling library.

## Scope

- Document the component and styling decision order in `CLAUDE.md` and `AGENTS.md`.
- Establish a central TypeScript design-system configuration for font metadata and CSS variable names.
- Retain `src/app/globals.css` as the authoritative shadcn token stylesheet for light and dark themes.
- Align `src/app/layout.tsx` with the font configuration and expose the configured font variables on the document root.
- Document the safe shadcn preset workflow for future visual changes.

## Non-goals

- No end-user theme editor or Settings screen.
- No new UI, theme, or CSS-in-JS dependency.
- No broad migration of existing feature markup or custom CSS in this change.
- No full `shadcn apply` preset application. The current full preset update already changed component APIs and requires a separate compatibility migration.

## Architecture

```text
shadcn preset / components.json
            |
            v
src/app/globals.css (semantic CSS tokens: light + dark)
            |
            +--> shadcn/ui component variants
            +--> Tailwind semantic utilities (bg-primary, text-muted-foreground)

src/design-system/config.ts (font and token metadata)
            |
            v
src/app/layout.tsx (next/font loaders + root CSS variables)
```

`components.json` remains the source for shadcn CLI settings. `globals.css` owns color, chart, radius, and theme-mode tokens because shadcn and Tailwind v4 consume those CSS variables directly. A small TypeScript configuration module owns the names and intent of document-level font variables, preventing feature code from choosing fonts independently.

## Styling Decision Order

1. Use an existing local shadcn/ui component and its documented props or variants.
2. Compose existing shadcn/ui components before adding markup or classes.
3. Use semantic Tailwind utilities only for layout, responsive behavior, and component composition that shadcn does not cover.
4. Add a reusable shadcn variant or shared component when the pattern appears more than once.
5. Add scoped custom CSS only for platform compatibility, print layouts, animation, or browser capabilities that cannot be expressed through the preceding options. Explain why with a concise comment.

Feature code must not use raw palette colors, arbitrary font families, or ad-hoc global CSS. It uses semantic tokens and the approved font classes instead.

## Preset Workflow

Before switching the visual style, inspect the active and incoming presets. Apply visual-only changes with:

```bash
pnpm dlx shadcn@latest apply --preset <preset-code> --only theme,font
```

Do not run full `apply` unless an approved migration covers every overwritten component and the affected call sites. Review the diff and run typecheck before accepting a preset change.

## Verification

- Typecheck verifies the font configuration and imports.
- ESLint verifies TypeScript and React conventions.
- The existing theme toggle is checked in light and dark modes in browser, Electron, and Capacitor builds.
- A focused test covers pure design-system configuration helpers, if helper logic is added.

## Risks and Decisions

Fonts loaded by `next/font` are chosen at build time. The configuration is developer-managed, which matches the requested preset workflow and preserves Next.js font optimization. Runtime font selection would require preloading every supported font and is intentionally out of scope.

The pre-existing Android WebView compatibility CSS and print-specific styles remain allowed exceptions; removing them would risk broken native rendering and print output.
