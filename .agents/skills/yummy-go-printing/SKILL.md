---
name: yummy-go-printing
description: Implement, review, and debug Yummy Go printer configuration and execution across the local printer agent, browser-device backend rendering, and Capacitor Android TCP ESC/POS. Use when work touches src/services/printer.ts, src/services/printer/, src/config/printer-agent.ts, src/stores/printer-store.ts, POS confirm or reprint flows, printer identity, batch payloads, ACK semantics, mobile_wifi, or TCP interface values. Do not use for report or PDF printing outside the printer domain.
---

# Yummy Go Printing

Preserve the backend printing contract and route each job through its owning platform path. Treat real API payload fields and existing tests as the source of truth.

## Inspect Before Editing

1. Read `AGENTS.md`, `package.json`, and the current printer files. Do not assume a generic ESC/POS architecture.
2. Identify the execution path:
   - Desktop/local agent: `src/services/printer.ts` posts jobs to `/print-ops` or `/print-ops-batch` with `x-agent-secret`.
   - Browser device: `src/services/printer/browser-device.ts` creates stable device identity and routes matching jobs through the backend mobile render endpoint.
   - Capacitor TCP: `src/services/printer/mobile-tcp.ts` sends backend-rendered ESC/POS base64 to `tcp://host:port` through `@deedarb/capacitor-tcp-socket`.
3. Trace the orchestration and state owners:
   - `src/services/printer.ts` owns API models, device resolution, dispatch, pending jobs, batching, and ACK behavior.
   - `src/services/printer/helpers.ts` owns normalization and ACK failure enrichment.
   - `src/config/printer-agent.ts` owns agent URLs, browser agent IDs, and interface parsing.
   - `src/stores/printer-store.ts` owns printer UI state and test-print actions.
   - `src/stores/pos-store.ts` owns POS follow-up flows that need resolved printer context.
4. Search exact backend fields before changing them: `print_batch_payloads`, `ack_success_payload`, `ack_failed_payload`, `print_summary`, `device_code`, `agent_id`, `print_mode`, `print_client`, `mobile_escpos`, and `escpos_base64`.

## Contract Guardrails

- Keep components on the layered path: component to Zustand action to printer service. Do not call printer services directly from components.
- Preserve backend field names and ACK templates exactly. Do not derive a replacement payload from adjacent fields.
- Keep kitchen and invoice semantics distinct: kitchen execution ACKs backend state; invoice execution prints without ACK.
- Treat physical printing and backend ACK as separate outcomes. A success-ACK failure after paper prints must not be reported as a physical print failure.
- Preserve the backend-defined empty-batch behavior. Kitchen jobs with backend-managed empty batches are not automatically client failures; invoice flows may surface `failed_before_print` from `print_summary`.
- Require matching `agent_id` and, when available, `device_code` before sending a local-agent job. Never send a job owned by another device.
- Preserve the browser identity fallback when the local agent is unavailable. If the agent responds but lacks required identity fields, fail instead of silently changing device ownership. Browser jobs identified by browser agent IDs and `-web-` device codes route to the backend, not the local agent.
- Keep every local batch on one resolved agent URL; split groups before dispatch when jobs target different agents.
- Gate native TCP work with `Capacitor.isNativePlatform()`. Reuse backend-rendered `escpos_base64`; do not render receipts independently in the client.
- Keep TCP interface values in `tcp://host:port` form. Base64 chunks must stay aligned to multiples of four, use `encoding: "base64"`, retain pacing unless hardware evidence supports a change, and disconnect in `finally`.
- Treat `NEXT_PUBLIC_PRINTER_AGENT_SECRET` as client-visible configuration. Never log it or describe it as a server-side secret.
- Preserve session guards around async store and POS follow-up work so results from an old login cannot mutate or print in a new session.
- Reuse the existing printer agent, Capacitor TCP plugin, and service layer. Do not add a second printing library or platform-specific state manager.

## Workflow

1. Classify the change as configuration, identity, local-agent dispatch, browser dispatch, native TCP, pending-job normalization, ACK handling, or store/POS orchestration.
2. Change the owning layer only, then update callers when the contract changes.
3. Cover success, physical failure, ACK failure, wrong-device identity, empty batch, and session-boundary behavior that is relevant to the change.
4. Keep hardware-dependent code thin. Extract pure parsing or routing logic before adding tests instead of mocking an entire printer stack.

## Validation

Run the smallest relevant gates:

- `npx vitest run src/services/printer.test.ts` for dispatch, batching, pending jobs, ACKs, identities, and backend payloads.
- `npx vitest run src/services/printer/helpers.test.ts src/services/printer/browser-device.test.ts` for normalization, interface helpers, and browser identity.
- `npx vitest run src/stores/printer-store.test.ts` for printer actions and session guards.
- `npx vitest run src/stores/pos-store.test.ts` when confirm, reprint, split invoice, or session follow-up behavior changes.
- `npx vitest run src/services/pos/requests.test.ts` when the POS-to-backend print request payload changes.
- `npm run typecheck` for model, service, or store contract changes.
- Use a real local agent, Android device, and printer only when hardware behavior is in scope; unit tests cannot prove socket timing, USB access, paper cutting, or multi-device routing.

Do not treat a successful backend render or ACK response as proof that paper was physically printed.
