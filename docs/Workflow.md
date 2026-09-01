# Workflow

## Branching

Observed and current convention: numbered feature branches, `feature-N` (current: `feature-70`; recent history: `feature-62`, `feature-60`, `feature-23`...). The `ship-feature` skill drives the intended flow: commit on `feature-N` → merge into an integration `feature` branch → delete `feature-N` → cut the next `feature-N+1`. `git log` shows a real `merge feature into main` commit, confirming `feature` → `main` is a manual, separate step — not automatic.

`TODO(owner): confirm` — no branch-protection rule or required review was found configured in this repo (no `.github` PR template, no CODEOWNERS). Treat direct pushes to `main` as possible today; that doesn't mean they're safe — see Verification below.

## Commits

`TODO(owner): confirm` — no commit-message convention is enforced (no commitlint, no husky, no `.gitmessage`). Recent history is inconsistent ("deploy", "git push", "update offline to online"). Do not assume Conventional Commits or any other format is expected; if the user wants one adopted, record that decision in `Decisions.md` first rather than applying it unilaterally.

## What must pass before you push

CI (`.github/workflows/deploy-static.yml`) runs **only `npm run build`** on push to `main`, then restarts the `yummy-go-fe.service` systemd unit on the VPS. It does not run `typecheck`, `lint`, or `test` — there is no other gate. Before pushing anything to `main` (or asking the user to), run all four locally:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

A green `build` with a broken `typecheck` will still deploy.

## Deploy

Push to `main` → GitHub Actions rsyncs the repo to the production VPS (excludes `.git`, `node_modules`, `.env*`, `.next`), runs `npm ci`, `npm run build` on the server (Node ≥ 22, enforced by `scripts/check-node-version.mjs`), and restarts `yummy-go-fe.service` (serves `https://yummy-go.com` behind Cloudflare, port 3002 locally on the VPS). The workflow polls the local port and fails loudly (prints `systemctl status` + last 150 journal lines) if the service doesn't come back up. This is a real production deploy with no staging step in CI — treat a push to `main` accordingly.

## Desktop build

`electron:pack` / `electron:pack:dir` build the Windows NSIS installer **locally**, not in CI: `next build --webpack` → `electron:build` (compiles `electron/*.ts`) → `electron:stage` (stages the standalone Next runtime) → `electron-builder`. There is no automated desktop release pipeline; a packaged build is a manual, local action.

## Environment

Copy `.env.example` → `.env.local` for local dev. Required: `NEXT_PUBLIC_BASE_URL`. Optional: `NEXT_PUBLIC_PRINTER_AGENT_URL` (defaults to `http://127.0.0.1:7777`), `NEXT_PUBLIC_PRINTER_AGENT_SECRET`, `NEXT_PUBLIC_SOCKET_URL` (defaults to the API URL). Production env vars (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BASE_URL`) are written to `.env.production` on the VPS by the deploy workflow from GitHub Secrets — never commit real values for these.
