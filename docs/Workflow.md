# Workflow

## Branching

Numbered feature branches, `feature-N` — run `git branch -a` for the current number rather than trusting a number written here. The `ship-feature` skill drives the intended flow: commit on `feature-N` → merge into an integration `feature` branch → delete `feature-N` → cut the next `feature-N+1`. Merging into `main` is a manual, separate step — not automatic.

`TODO(owner): confirm` — as of 2026-09-30 no `feature` branch exists locally or on `origin`; recent history instead merges `main` into `feature-N` directly (e.g. `Merge branch 'main' into feature-80`). Confirm which flow is current before running `ship-feature`.

`TODO(owner): confirm` — no branch-protection rule or required review was found configured in this repo (no `.github` PR template, no CODEOWNERS). Treat direct pushes to `main` as possible today; that doesn't mean they're safe — see Verification below.

## Commits

`TODO(owner): confirm` — no commit-message convention is enforced (no commitlint, no husky, no `.gitmessage`). Recent history mixes Conventional Commits (`fix(pos): …`, `feat(product): …`) with free-form and date-only messages (`29/09/2026`). Do not assume Conventional Commits or any other format is expected; if the user wants one adopted, record that decision in `Decisions.md` first rather than applying it unilaterally.

## What must pass before you push

CI (`.github/workflows/deploy-static.yml`) generates Next route types (`next typegen`), runs `typecheck`, `lint`, `test`, deployment fixture tests, and `build` on push to `main`, then activates a standalone release for `yummy-go-fe.service` on the VPS. Route generation is necessary on a fresh checkout because `next-env.d.ts` and `.next/types` are not committed. Before pushing anything to `main` (or asking the user to), run the same checks locally:

```bash
npm run typecheck
npm run lint
npm test
node --test scripts/deploy/deploy-release.test.mjs
npm run build
```

The deployment fixtures use temporary directories, mocked systemd/user commands, and real localhost HTTP servers. They never contact the VPS. On macOS, small test shims emulate Linux `mv -T`, `find -printf`, and the deployment lock command; production uses Linux coreutils and `flock`.

## Deploy

Push to `main` builds with `npm run build` (`next build --webpack`) on GitHub Actions, using Ubuntu 22.04 x64 and Node 22. `scripts/deploy/package-release.mjs` packages the Next standalone server, traced dependencies, `public`, and `.next/static`; it excludes `.env` and `.env.*` throughout the artifact. No dependency installation or build runs on the serving VPS.

`scripts/deploy/activate-release.sh` is transferred with the archive and run with sudo. The physical legacy directory `/var/www/front-end/yummy-go/www.yummy-go.com` stays intact. Releases live in the sibling `www.yummy-go.com-deploy/releases/<commit>-<run>-<attempt>`, and `www.yummy-go.com-deploy/current` is an atomic symlink. The script locks deployments, requires a healthy existing service, and inspects the actual systemd `User`, `Group`, `WorkingDirectory`, and `ExecStart`. It supports an existing npm/Next `start` unit with the legacy working directory or the previously managed release launcher. An unfamiliar unit or unexpected start flags fail before switching; inspect that unit and update the reviewed contract instead of bypassing the check. The repository does not contain the production unit, so this inspection happens on deployment.

The artifact manifest must match the VPS OS, architecture, and exact Node major (at least 22), and its build identity/static probe must match the packaged files. If the VPS currently uses another Node major or architecture, align CI and the service runtime before deploying; the script fails safely. Matching OS/architecture/Node major does not prove libc compatibility; the real candidate startup and asset/SSR health checks run on the VPS before activation.

The candidate starts as the existing service user on localhost port 13002. It must return its exact release marker, `/login`, and a compiled JS/CSS asset. After readiness, the script adds `/etc/systemd/system/yummy-go-fe.service.d/99-yummygo-release.conf`, overriding only `WorkingDirectory` and `ExecStart`; existing service identity, hardening, environment and EnvironmentFiles remain. The launcher explicitly sets `NODE_ENV=production`, `PORT=3002` and `HOSTNAME=127.0.0.1` for the standalone server, even if older unit environment values differ. It reloads systemd, verifies the effective override, restarts, and checks the same marker/SSR/asset on port 3002. A failure restores the prior symlink and drop-in, restarts the previous service, and checks health. Failed rollback retains the candidate and diagnostics for manual recovery. Candidate logs remain in a root-readable deployment diagnostics directory and are not printed by CI.

The serving process still restarts once during activation; this reduces the interruption to a restart, not zero downtime. A push to `main` remains a real production deployment behind Cloudflare at `https://yummy-go.com`. Candidate checks do not place orders or mutate the Backend, and do not replace a production latency measurement or device acceptance.

Successful activation retains at most five releases, protecting the active and immediate previous release. New releases also serve the original static chunks from the retained generations plus the fixed legacy static tree so already-open cashiers can fetch their existing JS/CSS. Each release stores its own original static tree separately; merged chunks do not accumulate forever. Browser sessions older than the retained generations may need a refresh. The unchanged legacy directory provides the fixed legacy assets and runtime env files; do not delete it without first migrating those dependencies. Interrupted/failed deployment diagnostics are deliberately preserved for investigation and can be removed after review.

## Desktop build

`electron:pack` / `electron:pack:dir` build the Windows NSIS installer **locally**, not in CI: `next build --webpack` → `electron:build` (compiles `electron/*.ts`) → `electron:stage` (stages the standalone Next runtime) → `electron-builder`. There is no automated desktop release pipeline; a packaged build is a manual, local action.

## Environment

Copy `.env.example` → `.env.local` for local dev. Required: `NEXT_PUBLIC_BASE_URL`. Optional: `NEXT_PUBLIC_PRINTER_AGENT_URL` (defaults to `http://127.0.0.1:7777`), `NEXT_PUBLIC_PRINTER_AGENT_SECRET`, `NEXT_PUBLIC_SOCKET_URL` (defaults to the API URL). Production `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, and `NEXT_PUBLIC_BASE_URL` come from GitHub Secrets during the CI build because Next inlines public variables. The build also accepts optional GitHub Secrets `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_PRINTER_AGENT_URL`, `NEXT_PUBLIC_PRINTER_AGENT_SECRET`, `NEXT_PUBLIC_BASE_PATH`, and `NEXT_PUBLIC_MOBILE_TCP_DEBUG`; absent/empty secrets stay unset so existing defaults still apply.

Runtime `.env`, `.env.local`, `.env.production`, and `.env.production.local` remain in the legacy VPS directory and are linked into each release with Next's normal precedence; the workflow never overwrites their values or permissions. Before the first CI-built deploy, configure any nonempty optional public values from those files as matching GitHub Secrets. The manifest records only configuration fingerprints for required and optional public variables, and deployment fails before cutover if an existing VPS public value differs from the built artifact; neither values nor fingerprints are logged. This includes a legacy `.env.local` API URL overriding `.env.production`. To intentionally change such a value, align the VPS env and CI secret together before deployment. The env-file check uses Next's env loader and the deploy process environment; it cannot inspect runtime-only overrides injected by custom systemd `Environment`/`EnvironmentFile` entries, which need to be reviewed when migrating the unit. Changing only the runtime env cannot change an already-built browser bundle. Never commit real env values.
