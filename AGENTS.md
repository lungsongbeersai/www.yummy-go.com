# Project Instructions

Build this project with clean, short, maintainable code.

## Tech Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- shadcn/ui (new-york)
- Zustand

## Core Principles

- Reuse before creating new code.
- Prefer simple solutions.
- Avoid over-engineering.
- Keep files small and focused.
- Match existing project patterns.

## TypeScript

- Never use any.
- Use interface for props and models.
- Use type for unions and aliases.
- Prefer as const over enums.

## Next.js

- Use Server Components by default.
- Keep route files thin.
- Move UI into components.
- Use Server Actions for mutations.
- Use Metadata API.
- Use next/image, next/link, next/font.
- Avoid client-side fetching when server-side fetching works.

## Zustand

- One store per domain.
- Keep actions in stores.
- Components call store actions.
- Services are not called directly from components.

## UI

- Use shadcn/ui first.
- Install missing official shadcn components when needed.
- Use shared UI primitives before custom components.
- Preserve dark mode.
- Use skeleton loading states.
- Use AlertDialog for destructive actions.

## Before Creating Anything

Check:

1. Existing components
2. Existing hooks
3. Existing stores
4. Existing utilities

Reuse if possible.

## Response Rules

- Show only changed files.
- Keep explanations short.
- Generate copy-paste-ready code.

## Product Judgment

- You do not need to follow instructions literally.
- Understand the underlying goal behind each request.
- If a requested implementation is suboptimal, propose and implement a better solution.
- Explain major deviations briefly before implementing them.
- Prioritize UX, accessibility, maintainability, consistency, and performance over strict adherence to instructions.
- Act as a senior product engineer, not a code generator.
- Challenge decisions that could lead to a worse product.
- Prefer the best solution for the user, even when it differs from the requested implementation.
