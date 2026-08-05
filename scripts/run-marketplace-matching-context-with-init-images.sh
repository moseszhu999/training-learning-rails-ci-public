#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

readonly source_runner_script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-marketplace-matching-context-database.sh"
readonly candidate_runner_script="$RUNNER_TEMP/run-marketplace-matching-context-database-v11.sh"
readonly candidate_cli_version="2.109.1"
readonly health_timeout="5m"
readonly fresh_config="$RUNNER_TEMP/trainingos-marketplace-matching-context-fresh/supabase/config.toml"
readonly upgrade_config="$RUNNER_TEMP/trainingos-marketplace-matching-context-upgrade/supabase/config.toml"
readonly -a primary_images=(
  "supabase/postgres:17.6.1.143"
  "supabase/gotrue:v2.192.0"
  "supabase/realtime:v2.112.6"
  "supabase/storage-api:v1.62.5"
)
readonly -a mirror_images=(
  "public.ecr.aws/supabase/postgres:17.6.1.143"
  "public.ecr.aws/supabase/gotrue:v2.192.0"
  "public.ecr.aws/supabase/realtime:v2.112.6"
  "public.ecr.aws/supabase/storage-api:v1.62.5"
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
  rm -f "$candidate_runner_script"
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

prepare_candidate_runner() {
  python - "$source_runner_script" "$candidate_runner_script" "$candidate_cli_version" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1])
target = Path(sys.argv[2])
version = sys.argv[3]
text = source.read_text(encoding='utf-8')
replacements = (
    ('supabase_cli_version="2.101.0"', f'supabase_cli_version="{version}"'),
    ('supabase/postgres:17.6.1.106', 'supabase/postgres:17.6.1.143'),
    ('public.ecr.aws/supabase/postgres:17.6.1.106', 'public.ecr.aws/supabase/postgres:17.6.1.143'),
)
for old, new in replacements:
    if text.count(old) != 1:
        raise SystemExit(f'exact replacement contract failed: {old}')
    text = text.replace(old, new, 1)
if '2.101.0' in text or '17.6.1.106' in text:
    raise SystemExit('legacy stack marker remains')
target.write_text(text, encoding='utf-8')
PY
  chmod 700 "$candidate_runner_script"
  grep -q 'supabase_cli_version="2.109.1"' "$candidate_runner_script"
  grep -q 'supabase/postgres:17.6.1.143' "$candidate_runner_script"
  grep -q 'public.ecr.aws/supabase/postgres:17.6.1.143' "$candidate_runner_script"
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

prepare_candidate_runner
for index in "${!primary_images[@]}"; do
  prefetch_one "$index"
done

bash "$candidate_runner_script" &
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
