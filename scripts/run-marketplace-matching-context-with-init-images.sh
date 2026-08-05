#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

readonly runner_script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-marketplace-matching-context-database.sh"
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
  for pid in "$fresh_watcher_pid" "$upgrade_watcher_pid"; do
    if [[ -n "$pid" ]]; then
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" >/dev/null 2>&1 || true
    fi
  done
  docker image rm "${primary_images[@]}" "${mirror_images[@]}" >/dev/null 2>&1 || true
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

patch_health_timeout_when_ready() {
  local config_path="$1" label="$2" log_path attempt
  log_path="$RUNNER_TEMP/trainingos-marketplace-matching-context-health-timeout-${label}.log"
  : >"$log_path"

  for attempt in $(seq 1 1800); do
    if [[ -f "$config_path" ]]; then
      python - "$config_path" "$health_timeout" >>"$log_path" 2>&1 <<'PY'
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
      grep -Eq '^health_timeout = "5m"$' "$config_path"
      return 0
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

set +e
bash "$runner_script" &
runner_pid=$!
patch_health_timeout_when_ready "$fresh_config" fresh &
fresh_watcher_pid=$!
patch_health_timeout_when_ready "$upgrade_config" upgrade &
upgrade_watcher_pid=$!

wait "$fresh_watcher_pid"
fresh_watcher_status=$?
fresh_watcher_pid=""
wait "$upgrade_watcher_pid"
upgrade_watcher_status=$?
upgrade_watcher_pid=""

if [[ "$fresh_watcher_status" != 0 || "$upgrade_watcher_status" != 0 ]]; then
  kill "$runner_pid" >/dev/null 2>&1 || true
  wait "$runner_pid" >/dev/null 2>&1 || true
  echo "MARKETPLACE_MATCHING_CONTEXT_DB status=FAIL stage=health-timeout-config"
  exit 1
fi

wait "$runner_pid"
runner_status=$?
runner_pid=""
set -e
exit "$runner_status"
