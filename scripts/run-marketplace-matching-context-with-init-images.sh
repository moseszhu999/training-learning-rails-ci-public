#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

readonly source_runner="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-marketplace-matching-context-database.sh"
readonly runner_script="$RUNNER_TEMP/trainingos-marketplace-matching-context-debug-runner.sh"
readonly health_timeout="5m"
readonly fresh_config="$RUNNER_TEMP/trainingos-marketplace-matching-context-fresh/supabase/config.toml"
readonly upgrade_config="$RUNNER_TEMP/trainingos-marketplace-matching-context-upgrade/supabase/config.toml"
readonly -a primary_images=(
  "supabase/postgres:17.6.1.106"
  "supabase/gotrue:v2.188.1"
  "supabase/realtime:v2.86.3"
  "supabase/storage-api:v1.54.1"
)
readonly -a mirror_images=(
  "public.ecr.aws/supabase/postgres:17.6.1.106"
  "public.ecr.aws/supabase/gotrue:v2.188.1"
  "public.ecr.aws/supabase/realtime:v2.86.3"
  "public.ecr.aws/supabase/storage-api:v1.54.1"
)
runner_pid=""
fresh_watcher_pid=""
upgrade_watcher_pid=""

cleanup_wrapper() {
  for pid in "$fresh_watcher_pid" "$upgrade_watcher_pid" "$runner_pid"; do
    if [[ -n "$pid" ]]; then
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" >/dev/null 2>&1 || true
    fi
  done
  docker image rm "${primary_images[@]}" "${mirror_images[@]}" >/dev/null 2>&1 || true
  rm -f "$runner_script"
  rm -f "$RUNNER_TEMP"/trainingos-marketplace-matching-context-init-image-*.log
  rm -f "$RUNNER_TEMP"/trainingos-marketplace-matching-context-health-timeout-*.log
}
trap cleanup_wrapper EXIT

pull_with_retries() {
  local image="$1" log_path="$2" attempt
  : >"$log_path"
  for attempt in 1 2 3; do
    if docker pull "$image" >>"$log_path" 2>&1; then
      return 0
    fi
    sleep $((attempt * 5))
  done
  return 1
}

prefetch_one() {
  local index="$1" primary mirror label primary_log mirror_log
  primary="${primary_images[$index]}"
  mirror="${mirror_images[$index]}"
  label="$(printf '%s' "$primary" | tr '/:.' '-')"
  primary_log="$RUNNER_TEMP/trainingos-marketplace-matching-context-init-image-${label}-primary.log"
  mirror_log="$RUNNER_TEMP/trainingos-marketplace-matching-context-init-image-${label}-mirror.log"

  if pull_with_retries "$primary" "$primary_log"; then
    :
  elif pull_with_retries "$mirror" "$mirror_log"; then
    docker tag "$mirror" "$primary" >/dev/null 2>&1
  else
    echo "MARKETPLACE_MATCHING_CONTEXT_DB status=FAIL stage=init-image-prefetch-${label}"
    return 1
  fi

  docker image inspect "$primary" --format '{{.Id}}' >/dev/null
}

prepare_debug_runner() {
  python - "$source_runner" "$runner_script" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1])
target = Path(sys.argv[2])
text = source.read_text(encoding='utf-8')

start_old = '  supabase --workdir "$workdir" db start >"$start_log" 2>&1'
start_new = '  supabase --debug --workdir "$workdir" db start >"$start_log" 2>&1'
if text.count(start_old) != 1:
    raise SystemExit('database start command contract changed')
text = text.replace(start_old, start_new, 1)

declaration_old = '  local log_path="$1" exit_code="$2" sqlstate category migration_scope resource'
declaration_new = '  local log_path="$1" exit_code="$2" sqlstate category migration_scope resource service'
if text.count(declaration_old) != 1:
    raise SystemExit('failure marker declaration contract changed')
text = text.replace(declaration_old, declaration_new, 1)

resource_old = '''  if grep -Eqi '(address already in use|port is already allocated|bind:.*failed)' "$log_path" 2>/dev/null; then
    resource="port"
  elif grep -Eqi '(pull access denied|manifest unknown|failed to pull|image.*not found)' "$log_path" 2>/dev/null; then
    resource="image"
  elif grep -Eqi '(container.*(unhealthy|failed|exited)|docker daemon|cannot connect to docker)' "$log_path" 2>/dev/null; then
    resource="container"
  elif grep -Eqi '(config.*(invalid|error)|toml.*(invalid|error))' "$log_path" 2>/dev/null; then
    resource="config"
  else
    resource="none"
  fi
'''
resource_new = '''  if grep -Eqi '(address already in use|port is already allocated|bind:.*failed)' "$log_path" 2>/dev/null; then
    resource="port"
  elif grep -Eqi '(pull access denied|manifest unknown|failed to pull|image.*not found|unable to find image)' "$log_path" 2>/dev/null; then
    resource="image"
  elif grep -Eqi '(database is not healthy|health check.*(failed|timeout)|timed out.*health|failed.*healthy|unhealthy database)' "$log_path" 2>/dev/null; then
    resource="dbhealth"
  elif grep -Eqi '(failed to connect to postgres|could not connect|connection refused|dial tcp.*5432|postgres.*connection.*failed)' "$log_path" 2>/dev/null; then
    resource="dbconnect"
  elif grep -Eqi '(failed to run migrations|error running.*migration|migration.*(failed|error))' "$log_path" 2>/dev/null; then
    resource="migrationservice"
  elif grep -Eqi '(failed to start docker container|failed to create docker container|container.*(unhealthy|failed|exited)|docker daemon|cannot connect to docker)' "$log_path" 2>/dev/null; then
    resource="container"
  elif grep -Eqi '(permission denied|operation not permitted)' "$log_path" 2>/dev/null; then
    resource="permission"
  elif grep -Eqi '(no space left on device|disk quota exceeded)' "$log_path" 2>/dev/null; then
    resource="disk"
  elif grep -Eqi '(network is unreachable|temporary failure in name resolution|tls handshake timeout|connection timed out)' "$log_path" 2>/dev/null; then
    resource="network"
  elif grep -Eqi '(config.*(invalid|error)|toml.*(invalid|error))' "$log_path" 2>/dev/null; then
    resource="config"
  else
    resource="none"
  fi

  if grep -Eqi '(supabase/gotrue|gotrue|auth migration)' "$log_path" 2>/dev/null; then
    service="auth"
  elif grep -Eqi '(supabase/realtime|realtime migration)' "$log_path" 2>/dev/null; then
    service="realtime"
  elif grep -Eqi '(supabase/storage-api|storage migration)' "$log_path" 2>/dev/null; then
    service="storage"
  elif grep -Eqi '(supabase/postgres|postgres|database|5432)' "$log_path" 2>/dev/null; then
    service="postgres"
  else
    service="none"
  fi
'''
if text.count(resource_old) != 1:
    raise SystemExit('resource classifier contract changed')
text = text.replace(resource_old, resource_new, 1)

category_old = "  elif grep -Eqi '(docker|container|supabase):.*(error|failed|unhealthy)' \"$log_path\" 2>/dev/null; then"
category_new = "  elif grep -Eqi '(docker|container|supabase|postgres|database|migration):.*(error|failed|unhealthy|timeout|refused)' \"$log_path\" 2>/dev/null; then"
if text.count(category_old) != 1:
    raise SystemExit('category classifier contract changed')
text = text.replace(category_old, category_new, 1)

printf_old = '''  printf '%s-%s-migration%s-resource%s-exit%s' \\
    "$category" "$sqlstate" "$migration_scope" "$resource" "$exit_code"
'''
printf_new = '''  printf '%s-%s-migration%s-resource%s-service%s-exit%s' \\
    "$category" "$sqlstate" "$migration_scope" "$resource" "$service" "$exit_code"
'''
if text.count(printf_old) != 1:
    raise SystemExit('failure marker format contract changed')
text = text.replace(printf_old, printf_new, 1)

target.write_text(text, encoding='utf-8')
PY
  chmod 700 "$runner_script"
}

patch_health_timeout_when_ready() {
  local config_path="$1" label="$2" log_path attempt
  log_path="$RUNNER_TEMP/trainingos-marketplace-matching-context-health-timeout-${label}.log"
  : >"$log_path"

  for attempt in $(seq 1 1800); do
    if [[ -f "$config_path" ]]; then
      if python - "$config_path" "$health_timeout" >>"$log_path" 2>&1 <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
health_timeout = sys.argv[2]
text = path.read_text(encoding='utf-8')
section = re.search(r'(?m)^\[db\]\s*$', text)
if section is None:
    raise SystemExit('db section missing')
next_section = re.search(r'(?m)^\[[^\]]+\]\s*$', text[section.end():])
end = section.end() + (next_section.start() if next_section else len(text) - section.end())
block = text[section.end():end]
replacement = f'\nhealth_timeout = "{health_timeout}"'
if re.search(r'(?m)^\s*health_timeout\s*=', block):
    block = re.sub(
        r'(?m)^\s*health_timeout\s*=.*$',
        replacement.strip(),
        block,
        count=1,
    )
else:
    block = replacement + block
updated = text[:section.end()] + block + text[end:]
path.write_text(updated, encoding='utf-8')
PY
      then
        if grep -Eq '^health_timeout = "5m"$' "$config_path"; then
          return 0
        fi
      fi
    fi
    if [[ -n "$runner_pid" ]] && ! kill -0 "$runner_pid" >/dev/null 2>&1; then
      echo "runner exited before ${label} config" >>"$log_path"
      return 1
    fi
    sleep 0.1
  done

  echo "timed out waiting for ${label} config" >>"$log_path"
  return 1
}

for index in "${!primary_images[@]}"; do
  prefetch_one "$index"
done
prepare_debug_runner

bash "$runner_script" &
runner_pid=$!
patch_health_timeout_when_ready "$fresh_config" fresh &
fresh_watcher_pid=$!
patch_health_timeout_when_ready "$upgrade_config" upgrade &
upgrade_watcher_pid=$!

set +e
wait "$fresh_watcher_pid"
fresh_watcher_status=$?
fresh_watcher_pid=""
wait "$upgrade_watcher_pid"
upgrade_watcher_status=$?
upgrade_watcher_pid=""

if [[ "$fresh_watcher_status" != 0 || "$upgrade_watcher_status" != 0 ]]; then
  kill "$runner_pid" >/dev/null 2>&1 || true
  wait "$runner_pid" >/dev/null 2>&1 || true
  runner_pid=""
  echo "MARKETPLACE_MATCHING_CONTEXT_DB status=FAIL stage=health-timeout-config"
  exit 1
fi

wait "$runner_pid"
runner_status=$?
runner_pid=""
set -e
exit "$runner_status"
