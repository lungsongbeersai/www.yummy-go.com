---
name: yummy-go-electron
description: Implement, review, and debug the Yummy Go Electron desktop shell and customer-display integration. Use when work touches electron/main.ts, electron/preload.ts, src/types/electron.d.ts, the /customer-display flow, BrowserWindow or display selection, IPC or contextBridge, the packaged Next server lifecycle, or electron-builder packaging. Do not use for browser-only or Capacitor-only changes.
---

# Yummy Go Electron

Preserve the existing Next.js plus Electron architecture while keeping the desktop bridge narrow, typed, secure, and compatible with the browser fallback.

## Inspect Before Editing

1. Read `AGENTS.md`, `package.json`, and the files in scope. Treat current dependency versions and repository code as authoritative.
2. Trace the full contract when changing IPC or customer-display behavior:
   - `electron/main.ts` owns app lifecycle, windows, physical display selection, IPC handlers, and the packaged Next server.
   - `electron/preload.ts` exposes the renderer bridge through `contextBridge`.
   - `src/types/electron.d.ts` declares the renderer-visible API.
   - `src/features/customer-display/shared/customer-display-sync.ts` owns payload publishing and the browser fallback.
   - `src/features/pos/table-selection/hooks/use-customer-display-workflow.ts` owns the cashier-side display workflow.
   - `src/features/customer-display/display/customer-display-page.tsx` consumes display messages.
3. Search for every IPC channel and `window.electronAPI` consumer before changing a name or payload.
4. Verify current Electron APIs against official Electron documentation when behavior is version-sensitive.

## Implementation Guardrails

- Keep `contextIsolation: true` and `nodeIntegration: false` on every renderer window.
- Expose narrow functions from preload; never expose `ipcRenderer`, `webContents`, filesystem access, or arbitrary channel names to renderer code.
- Validate new IPC arguments at the main-process boundary and return typed, serializable results.
- Update `electron/preload.ts` and `src/types/electron.d.ts` together. Update every renderer caller in the same change.
- Return cleanup functions for renderer listeners and remove listeners when components unmount.
- Preserve the customer-display readiness queue, close/reset behavior, and display-disconnect handling unless the requested behavior explicitly replaces them.
- Preserve the non-Electron path based on `BroadcastChannel` and `localStorage`; web and Capacitor targets must still work when `window.electronAPI` is absent.
- Reuse the existing Next server plus `electron-builder` setup. Do not introduce Electron Forge, electron-vite, a second packager, or another state manager.
- Keep development-only behavior behind `isDev` or an equivalent explicit guard. Do not enable production DevTools or load untrusted remote content into a privileged window.
- Keep route files thin and substantial UI or workflow logic under `src/features/`.

## Workflow

1. Classify the change as window lifecycle, IPC contract, customer-display sync, renderer UI, server lifecycle, or packaging.
2. Make the smallest change at the owning layer; do not duplicate the same state or fallback logic in a second component.
3. Add or update pure-logic tests for payload transforms, browser fallback behavior, and display-selection helpers when those contracts change.
4. Check the diff for synchronized IPC channel names, payload types, listener cleanup, and failure handling.

## Validation

Run the smallest relevant gates, then expand when risk requires it:

- `npm run electron:build` for all main/preload changes.
- `npm run typecheck` for bridge or renderer contract changes.
- `npx vitest run src/features/customer-display/shared/customer-display-sync.test.ts` for payload transport changes.
- `npx vitest run src/features/pos/table-selection/customer-display-picker-utils.test.ts` for display-selection helper changes.
- Use a short `npm run dev:desktop` check when static evidence cannot prove window, IPC, or multi-monitor behavior.
- Run `npm run electron:pack` only for installer or packaging work where an actual packaged artifact is part of the requested outcome.

Do not treat a successful web build as proof that the Electron main process, preload bridge, or multi-monitor flow works.
