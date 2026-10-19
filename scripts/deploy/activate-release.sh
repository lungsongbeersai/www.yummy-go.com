#!/usr/bin/env bash
set -Eeuo pipefail
umask 027

# Run as root on the VPS. The existing physical application directory is left intact
# for first-deploy rollback and as the source of runtime .env files.
ARCHIVE=${1:?Usage: activate-release.sh ARCHIVE RELEASE_ID}
RELEASE_ID=${2:?Missing release id}
APP_DIR=${APP_DIR:-/var/www/front-end/yummy-go/www.yummy-go.com}
DEPLOY_ROOT=${DEPLOY_ROOT:-${APP_DIR}-deploy}
SERVICE=${SERVICE:-yummy-go-fe.service}
SYSTEMD_ROOT=${SYSTEMD_ROOT:-/etc/systemd/system}
PORT=${PORT:-3002}
CANDIDATE_PORT=${CANDIDATE_PORT:-13002}
KEEP_RELEASES=${KEEP_RELEASES:-5}
HEALTH_ATTEMPTS=${HEALTH_ATTEMPTS:-30}
HEALTH_DELAY=${HEALTH_DELAY:-1}

die() { echo "ERROR: $*" >&2; exit 1; }
http_ok() {
  [[ $(curl --silent --show-error --max-time 2 --output /dev/null --write-out '%{http_code}' "$1" 2>/dev/null) == 200 ]]
}
[[ $(id -u) == 0 ]] || die "Run this script with sudo"
[[ $RELEASE_ID =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$ ]] || die "Invalid release id"
[[ $SERVICE =~ ^[a-zA-Z0-9_.@-]+\.service$ ]] || die "Invalid service name"
for path in "$APP_DIR" "$DEPLOY_ROOT" "$SYSTEMD_ROOT"; do
  [[ $path =~ ^/[a-zA-Z0-9_./-]+$ && $path != / && $path != *..* ]] || die "Unsafe deployment path: $path"
done
[[ $DEPLOY_ROOT != "$APP_DIR" && $DEPLOY_ROOT != "$APP_DIR/"* ]] || die "Releases must be outside the live directory"
[[ $KEEP_RELEASES =~ ^[0-9]+$ && $KEEP_RELEASES -ge 2 && $KEEP_RELEASES -le 20 ]] || die "KEEP_RELEASES must be 2..20"
[[ $HEALTH_ATTEMPTS =~ ^[0-9]+$ && $HEALTH_ATTEMPTS -ge 1 && $HEALTH_ATTEMPTS -le 120 ]] || die "Invalid health attempts"
[[ $PORT =~ ^[0-9]+$ && $CANDIDATE_PORT =~ ^[0-9]+$ && $PORT != "$CANDIDATE_PORT" ]] || die "Invalid/distinct ports required"
((PORT >= 1024 && PORT <= 65535 && CANDIDATE_PORT >= 1024 && CANDIDATE_PORT <= 65535)) || die "Ports must be 1024..65535"
[[ -f $ARCHIVE && -d $APP_DIR ]] || die "Archive or legacy application directory missing"

CURRENT=$DEPLOY_ROOT/current
RELEASES=$DEPLOY_ROOT/releases
RELEASE=$RELEASES/$RELEASE_ID
DROPIN_DIR=$SYSTEMD_ROOT/$SERVICE.d
DROPIN=$DROPIN_DIR/99-yummygo-release.conf
mkdir -p "$RELEASES"
chmod 755 "$DEPLOY_ROOT" "$RELEASES"
exec 9>"$DEPLOY_ROOT/deploy.lock"
flock -n 9 || die "Another deployment is running"
[[ ! -e $RELEASE && ! -L $RELEASE ]] || die "Release already exists"
[[ ! -e $CURRENT || -L $CURRENT ]] || die "current must be a symlink"

service_user=$(systemctl show "$SERVICE" -p User --value)
service_group=$(systemctl show "$SERVICE" -p Group --value)
working_dir=$(systemctl show "$SERVICE" -p WorkingDirectory --value)
exec_start=$(systemctl show "$SERVICE" -p ExecStart --value)
[[ -n $service_user && $service_user != root ]] || die "Expected an explicit non-root service User"
[[ -n $service_group ]] || service_group=$(id -gn "$service_user")
[[ $working_dir == "$APP_DIR" || $working_dir == "$CURRENT" ]] || die "Unexpected WorkingDirectory; inspect unit before migration: $working_dir"
systemctl is-active --quiet "$SERVICE" || die "Existing service must be healthy before deployment"
http_ok "http://127.0.0.1:$PORT/login" || die "Existing application is unhealthy"
NODE_BIN=${NODE_BIN:-$(runuser -u "$service_user" -- bash -lc 'command -v node')}
[[ $NODE_BIN =~ ^/[a-zA-Z0-9_./-]+$ && -x $NODE_BIN ]] || die "Node executable not found for service user"
"$NODE_BIN" - "$exec_start" "$APP_DIR" "$CURRENT" "$PORT" <<'NODE'
const [execStart, appDir, current, port] = process.argv.slice(2);
const invocations = [...execStart.matchAll(/\{\s*path=([^;]+?)\s*;\s*argv\[\]=(.*?)\s*;/g)];
if (invocations.length !== 1) throw new Error('Expected one inspectable systemd ExecStart');
const executable = invocations[0][1].trim();
const args = invocations[0][2].trim().split(/\s+/);
if (args.shift() !== executable) throw new Error('Unexpected ExecStart argv');
if (executable === `${current}/start-service.sh` && args.length === 0) process.exit(0);
if (/\/(?:node|nodejs)$/.test(executable)) {
  if (args.shift() !== `${appDir}/node_modules/next/dist/bin/next`) throw new Error('Unexpected Node entry point');
} else if (!/\/(?:npm|next)$/.test(executable)) {
  throw new Error('Unsupported legacy ExecStart; inspect unit before migration');
}
if (/\/npm$/.test(executable) && args[0] === 'run') args.shift();
if (args.shift() !== 'start') throw new Error('Expected npm/next start');
if (args[0] === '--') args.shift();
while (args.length) {
  const flag = args.shift();
  if (['-p', '--port'].includes(flag) && args.shift() === port) continue;
  if (flag === `--port=${port}`) continue;
  if (['-H', '--hostname'].includes(flag) && ['127.0.0.1', '0.0.0.0', 'localhost'].includes(args.shift())) continue;
  throw new Error('Unexpected legacy start flags; inspect unit before migration');
}
NODE

previous_target=$(readlink "$CURRENT" || true)
if [[ -n $previous_target ]]; then
  [[ $previous_target == "$RELEASES/"* && -d $previous_target ]] || die "current points outside managed releases"
fi
backup=$(mktemp -d "$DEPLOY_ROOT/.activate-XXXXXX")
had_dropin=0
if [[ -e $DROPIN ]]; then
  cp -p "$DROPIN" "$backup/dropin"
  had_dropin=1
fi
candidate_pid=
activated=0
committed=0
stop_candidate() {
  if [[ -n $candidate_pid ]]; then
    kill "$candidate_pid" 2>/dev/null || true
    wait "$candidate_pid" 2>/dev/null || true
    candidate_pid=
  fi
}
replace_current() {
  ln -s "$1" "$DEPLOY_ROOT/.current-$RELEASE_ID"
  mv -Tf "$DEPLOY_ROOT/.current-$RELEASE_ID" "$CURRENT"
}
diagnostics() {
  systemctl status "$SERVICE" --no-pager -l || true
  journalctl -u "$SERVICE" -n 100 --no-pager || true
}
healthy() {
  local port=$1 expected=$2 asset=${3:-} marker attempt
  for ((attempt = 0; attempt < HEALTH_ATTEMPTS; attempt++)); do
    if [[ -n $expected ]]; then
      marker=$(curl --fail --silent --show-error --max-time 2 "http://127.0.0.1:$port/__yummygo_release.txt" 2>/dev/null) || marker=
      [[ $marker == "$expected" ]] || { sleep "$HEALTH_DELAY"; continue; }
    fi
    if http_ok "http://127.0.0.1:$port/login" && \
      { [[ -z $asset ]] || http_ok "http://127.0.0.1:$port/_next/static/$asset"; }; then
      return 0
    fi
    sleep "$HEALTH_DELAY"
  done
  return 1
}
cleanup() {
  local result=$? rollback_failed=0
  trap - EXIT HUP INT TERM
  stop_candidate
  if ((activated && !committed)); then
    echo "Activation failed; restoring previous release and service settings" >&2
    if [[ -n $previous_target ]]; then
      replace_current "$previous_target" || rollback_failed=1
    else
      rm -f "$CURRENT" || rollback_failed=1
    fi
    if ((had_dropin)); then
      cp -p "$backup/dropin" "$DROPIN" || rollback_failed=1
    else
      rm -f "$DROPIN" || rollback_failed=1
    fi
    if ((!rollback_failed)) && systemctl daemon-reload && systemctl restart "$SERVICE" && healthy "$PORT" "${previous_target##*/}"; then
      echo "Previous service restored" >&2
    else
      echo "ERROR: Rollback did not restore service health; manual intervention required" >&2
      diagnostics
      result=1
      rollback_failed=1
    fi
  fi
  rm -f "$DEPLOY_ROOT/.current-$RELEASE_ID"
  if ((result == 0)); then
    rm -rf "$backup"
  else
    echo "Deployment diagnostics retained at $backup (root access only)" >&2
  fi
  if ((!committed && !rollback_failed)); then rm -rf "$RELEASE"; fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM

# Artifacts come only from this repository's CI. Reject absolute/traversal names
# before extraction and any env files accidentally included by a packager.
tar -tzf "$ARCHIVE" >"$backup/members"
while IFS= read -r member; do
  [[ $member != /* && /$member/ != */../* ]] || die "Unsafe archive member"
  [[ /$member/ != */.env/* && /$member/ != */.env.* ]] || die "Archive contains environment files"
done <"$backup/members"
mkdir "$RELEASE"
tar -xzf "$ARCHIVE" -C "$RELEASE" --no-same-owner
[[ -s $RELEASE/server.js && -s $RELEASE/.next/BUILD_ID && -d $RELEASE/.next/static && -f $RELEASE/.release.json ]] || die "Incomplete standalone artifact"
asset_path=$("$NODE_BIN" - "$RELEASE/.release.json" "$RELEASE_ID" "$RELEASE" "$APP_DIR" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const [file, releaseId, release, appDir] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
if (manifest.releaseId !== releaseId || manifest.platform !== process.platform || manifest.arch !== process.arch || manifest.nodeMajor !== Number(process.versions.node.split('.')[0]) || manifest.nodeMajor < 22) {
  throw new Error('Artifact runtime mismatch: CI and VPS must use the same platform, architecture and Node major >= 22');
}
if (manifest.buildId !== fs.readFileSync(path.join(release, '.next/BUILD_ID'), 'utf8').trim() || fs.readFileSync(path.join(release, 'public/__yummygo_release.txt'), 'utf8') !== releaseId) {
  throw new Error('Artifact manifest does not match build identity');
}
if (typeof manifest.asset !== 'string' || !/^[a-zA-Z0-9_./-]+\.(?:js|css)$/.test(manifest.asset) || manifest.asset.includes('..') || !fs.statSync(path.join(release, '.next/static', manifest.asset)).isFile()) {
  throw new Error('Artifact has no valid static probe asset');
}
require(path.join(release, 'node_modules/@next/env')).loadEnvConfig(appDir, false, { info() {}, error() {} });
for (const key of ['NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_BASE_URL', 'NEXT_PUBLIC_SOCKET_URL', 'NEXT_PUBLIC_PRINTER_AGENT_URL', 'NEXT_PUBLIC_PRINTER_AGENT_SECRET', 'NEXT_PUBLIC_BASE_PATH', 'NEXT_PUBLIC_MOBILE_TCP_DEBUG']) {
  if (process.env[key] && manifest.publicEnvironment?.[key] !== crypto.createHash('sha256').update(process.env[key]).digest('hex')) {
    throw new Error(`Public build configuration differs for ${key}; align the CI secret and VPS env before deploying`);
  }
}
process.stdout.write(manifest.asset);
NODE
)

# Keep each original static tree separate so copying old chunks into a new release
# never causes unbounded accumulation through successive deployments.
cp -a "$RELEASE/.next/static" "$RELEASE/.deploy-static"
retained_count=1
: >"$backup/retained"
if [[ -n $previous_target ]]; then
  printf '%s\n' "$previous_target" >>"$backup/retained"
  retained_count=2
fi
while IFS= read -r old_release; do
  [[ $old_release != "$previous_target" && -f $old_release/.activated ]] || continue
  ((retained_count < KEEP_RELEASES)) || break
  printf '%s\n' "$old_release" >>"$backup/retained"
  retained_count=$((retained_count + 1))
done < <(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d ! -path "$RELEASE" -printf '%T@ %p\n' | sort -nr | cut -d ' ' -f 2-)
while IFS= read -r old_release; do
  [[ -d $old_release/.deploy-static ]] || continue
  cp -an "$old_release/.deploy-static/." "$RELEASE/.next/static/"
done <"$backup/retained"
if [[ -d $APP_DIR/.next/static ]]; then
  cp -an "$APP_DIR/.next/static/." "$RELEASE/.next/static/"
fi

# Set ownership before adding links so recursive chown never reaches legacy env files.
chown -R "$service_user:$service_group" "$RELEASE"

# Next loads these in its normal precedence. Links preserve permissions and keep
# secrets out of archives/release copies, including the first migration.
for env_name in .env .env.local .env.production .env.production.local; do
  if [[ -e $APP_DIR/$env_name ]]; then
    ln -s "$APP_DIR/$env_name" "$RELEASE/$env_name"
    runuser -u "$service_user" -- test -r "$APP_DIR/$env_name" || die "Service user cannot read $env_name"
  fi
done
cat >"$RELEASE/start-service.sh" <<EOF
#!/bin/sh
exec /usr/bin/env NODE_ENV=production PORT=$PORT HOSTNAME=127.0.0.1 "$NODE_BIN" "$CURRENT/server.js"
EOF
chmod 750 "$RELEASE/start-service.sh"
chown "$service_user:$service_group" "$RELEASE/start-service.sh"

# A process on the alternate port must identify this release, preventing an
# already-bound port from being mistaken for a healthy candidate.
runuser -u "$service_user" -- /usr/bin/env NODE_ENV=production PORT="$CANDIDATE_PORT" HOSTNAME=127.0.0.1 \
  "$NODE_BIN" "$RELEASE/server.js" >"$backup/candidate.log" 2>&1 &
candidate_pid=$!
if ! healthy "$CANDIDATE_PORT" "$RELEASE_ID" "$asset_path" || ! kill -0 "$candidate_pid" 2>/dev/null; then
  echo "Candidate diagnostics: $backup/candidate.log (root access only)" >&2
  die "Candidate failed readiness; existing service is unchanged"
fi
stop_candidate

mkdir -p "$DROPIN_DIR"
cat >"$backup/dropin.new" <<EOF
[Service]
WorkingDirectory=$CURRENT
ExecStart=
ExecStart=$CURRENT/start-service.sh
EOF
chmod 644 "$backup/dropin.new"
activated=1
replace_current "$RELEASE"
cp "$backup/dropin.new" "$DROPIN"
systemctl daemon-reload
[[ $(systemctl show "$SERVICE" -p WorkingDirectory --value) == "$CURRENT" ]] || die "WorkingDirectory override was not applied"
[[ $(systemctl show "$SERVICE" -p ExecStart --value) == *"$CURRENT/start-service.sh"* ]] || die "ExecStart override was not applied"
if ! systemctl restart "$SERVICE" || ! systemctl is-active --quiet "$SERVICE" || ! healthy "$PORT" "$RELEASE_ID" "$asset_path"; then
  diagnostics
  die "New release failed service readiness"
fi
touch "$RELEASE/.activated"
committed=1

# Protect both current and the immediate rollback target even when timestamps
# differ from release order. Cleanup runs only after a successful activation.
while IFS= read -r old_release; do
  [[ $old_release != "$RELEASE" ]] || continue
  retained=0
  while IFS= read -r retained_release; do
    if [[ $old_release == "$retained_release" ]]; then retained=1; break; fi
  done <"$backup/retained"
  if ((!retained)); then rm -rf "$old_release"; fi
done < <(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | cut -d ' ' -f 2-)
echo "Activated $RELEASE_ID; retained up to $KEEP_RELEASES releases"
