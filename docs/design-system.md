# Design System

## Sources of Truth

- `components.json` configures the shadcn CLI and local UI primitive paths.
- `src/app/globals.css` owns all semantic color, radius, chart, and light/dark theme tokens.
- `src/design-system/config.ts` names the supported theme modes and approved font variables.
- `src/design-system/fonts.ts` owns the `next/font` declarations applied by the root layout.

## Component and Styling Decision Order

1. Use an existing shadcn/ui component and its documented variants or props.
2. Compose existing shadcn/ui components before adding new markup or styles.
3. Use semantic Tailwind utilities only for layout, responsive behavior, and composition that shadcn/ui does not provide.
4. Add a shared component or shadcn variant when a pattern is reused.
5. Add scoped custom CSS only when platform compatibility, print layout, motion, or browser limitations require it.

Feature code must not use raw palette colors, arbitrary font families, or new global CSS.

## Adding Components

Browse and install official components from [ui.shadcn.com](https://ui.shadcn.com/). Check `src/components/ui/` first — do not re-add components that are already present, and do not hand-roll UI that shadcn already provides.

```bash
npx shadcn@latest add button dialog
npx shadcn@latest add          # list available components
npx shadcn@latest search       # search registries
npx shadcn@latest docs button  # get docs and example URLs
```

The CLI writes source files into `src/components/ui/` and installs any required dependencies. To preview upstream changes before updating an existing component, use `--dry-run` and `--diff`; do not overwrite local customizations without review.

## Theme Tokens

Use semantic tokens such as `bg-primary`, `text-muted-foreground`, and `border-border`. Update the light and dark CSS variables in `src/app/globals.css` to change the visual theme; do not hard-code colors in feature components.

## Typography

Document fonts are loaded through `next/font` in `src/design-system/fonts.ts`. Use `font-sans` for the default typeface and `font-lao` where Lao typography must be explicit.

## Safe shadcn Preset Changes

Inspect the current and incoming preset before changing visual foundations. Apply visual-only preset changes with:

```bash
pnpm dlx shadcn@latest apply --preset <preset-code> --only theme,font
```

Full `apply` can overwrite local UI components and change their APIs. It requires an approved migration plan, diff review, and a successful typecheck before acceptance.

## Allowed CSS Exceptions

Existing Android WebView compatibility, native touch-target behavior, printing styles, and reduced-motion support are intentional exceptions. Keep these styles scoped and document why the equivalent cannot be expressed with shadcn/ui or semantic Tailwind utilities.
