# Project Instructions

Build this project with clean, short, maintainable code.

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui
- Zustand

## Code Style

- Write clean code with simple names and clear structure.
- Keep code short, readable, and easy to change.
- Avoid over-engineering and unnecessary abstractions.
- Reuse existing components, hooks, utilities, and patterns.
- Prefer small components with one clear responsibility.
- Use TypeScript types instead of `any` whenever possible.
- Keep comments rare and only for logic that is not obvious.

## Next.js Structure

- Use the `app` router structure.
- Keep route files inside `app`.
- Keep reusable UI in `components`.
- Keep shadcn/ui primitives in `components/ui`.
- Keep global state stores in `stores`.
- Keep service-backed Zustand stores by domain: auth, dashboard, POS, public POS, printer, product, settings CRUD, reference data, app, and toast.
- Keep shared helpers in `lib`.
- Keep custom hooks in `hooks`.
- Keep static assets in `public`.

## Development Notes

- Answer user-facing messages in Thai by default unless the user asks for another language.
- Prefer React Server Components by default.
- Use Client Components only when state, effects, browser APIs, or Zustand are needed.
- Use Tailwind CSS for styling.
- Use shadcn/ui for common UI primitives.
- Use Zustand for client-side state management.
- Components should call store actions for service-backed workflows instead of importing service functions directly.
- Match the existing project style before adding new patterns.

## UI Patterns

- Keep the whole project visually aligned with shadcn/ui style and the configured `new-york` component style.
- Use shadcn/ui primitives and project wrappers before creating custom UI from scratch.
- Use the local shadcn skill at `.agents/skills/shadcn` before creating or modifying UI.
- Use `components/ui/chart` with Recharts for dashboard/report charts; avoid hand-written SVG charts unless there is a clear product reason.
- Keep the protected app shell route-aware with translated breadcrumbs in the header.
- Use the shared menu config as the source for sidebar labels and breadcrumb labels.
- Use skeleton loading states instead of spinner-only or pulsing-dot loaders.
- Keep reusable skeleton primitives in `components/ui` and page skeleton layouts in shared components.
- Preserve dark mode behavior when changing light mode colors or layout styling.
- Use `Field`, `Input`, `Textarea`, `Select`, and `Checkbox` for forms instead of hand-built label/control layouts.
- Use shadcn `Table`, `DropdownMenu`, `Dialog`, `AlertDialog`, `Alert`, `Empty`, and `Spinner` for data tables, row actions, confirmations, modals, warnings, empty states, and blocking save states.
- Use `AlertDialog` instead of `window.confirm` for destructive UI actions.
- Use flex/grid with `gap-*` for spacing; avoid `space-x-*` and `space-y-*` in app UI.
- Raw native controls are allowed only inside `components/ui` primitives or for non-visual mechanics such as hidden form fields/backdrop buttons.

## UI Component Rule

When creating or modifying UI components, always use the shadcn/ui agent first.

Rules:

- Check shadcn/ui components before creating custom components.
- If a needed shadcn/ui component does not exist in the project, install it with the shadcn CLI before using it.
- The user allows loading and installing any official shadcn/ui component needed for the task.
- Prefer existing shadcn/ui patterns when they fit the use case.
- Reuse existing project components when available.
- Do not create unnecessary custom UI if shadcn/ui already provides a suitable solution.
- Keep the design clean, consistent, and easy to maintain.
