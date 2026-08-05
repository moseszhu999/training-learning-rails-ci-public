#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"

readonly source_runner="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-marketplace-matching-context-database.sh"
readonly runner_script="$RUNNER_TEMP/mc-v16-runner.sh"
readonly candidate_cli_version="2.109.1"
readonly candidate_health_timeout="5m"
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

cleanup_wrapper() {
  docker image rm "${primary_images[@]}" "${mirror_images[@]}" >/dev/null 2>&1 || true
  rm -f "$runner_script"
  rm -f "$RUNNER_TEMP"/trainingos-marketplace-matching-context-init-image-*.log
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

prepare_runner() {
  python - "$source_runner" "$runner_script" "$candidate_cli_version" "$candidate_health_timeout" <<'PY'
from pathlib import Path
import sys

source = Path(sys.argv[1])
target = Path(sys.argv[2])
candidate_cli_version = sys.argv[3]
candidate_health_timeout = sys.argv[4]
text = source.read_text(encoding='utf-8')

stack_replacements = (
    (
        'public.ecr.aws/supabase/postgres:17.6.1.106',
        'public.ecr.aws/supabase/postgres:17.6.1.143',
    ),
    (
        'supabase/postgres:17.6.1.106',
        'supabase/postgres:17.6.1.143',
    ),
    (
        'supabase_cli_version="2.101.0"',
        f'supabase_cli_version="{candidate_cli_version}"',
    ),
)
for old, new in stack_replacements:
    if text.count(old) != 1:
        raise SystemExit(f'stable stack replacement contract changed: {old}')
    text = text.replace(old, new, 1)
if '2.101.0' in text or '17.6.1.106' in text:
    raise SystemExit('legacy stack marker remains in candidate runner')
if 'supabase --debug --workdir' in text:
    raise SystemExit('debug start must not be present')

workdir_replacements = (
    (
        'fresh="$RUNNER_TEMP/trainingos-marketplace-matching-context-fresh"',
        'fresh="$RUNNER_TEMP/mc-f1"',
    ),
    (
        'fresh_two="$RUNNER_TEMP/trainingos-marketplace-matching-context-fresh-two"',
        'fresh_two="$RUNNER_TEMP/mc-f2"',
    ),
    (
        'upgrade="$RUNNER_TEMP/trainingos-marketplace-matching-context-upgrade"',
        'upgrade="$RUNNER_TEMP/mc-up"',
    ),
)
for old, new in workdir_replacements:
    if text.count(old) != 1:
        raise SystemExit(f'workdir replacement contract changed: {old}')
    text = text.replace(old, new, 1)

sequence_old = '''CURRENT_STAGE="workdir-initialization"
initialize_empty_workdir "$fresh" fresh-one
initialize_empty_workdir "$fresh_two" fresh-two
initialize_empty_workdir "$upgrade" upgrade

CURRENT_STAGE="fresh-one-empty-start"
'''
sequence_new = '''CURRENT_STAGE="fresh-one-initialization"
initialize_empty_workdir "$fresh" fresh-one

CURRENT_STAGE="fresh-one-empty-start"
'''
if text.count(sequence_old) != 1:
    raise SystemExit('initialization sequence contract changed')
text = text.replace(sequence_old, sequence_new, 1)

fresh_two_old = 'CURRENT_STAGE="fresh-two-empty-start"\nstart_with_marker "$fresh_two" fresh-two-empty-start\n'
fresh_two_new = '''CURRENT_STAGE="fresh-two-initialization"
initialize_empty_workdir "$fresh_two" fresh-two

CURRENT_STAGE="fresh-two-empty-start"
start_with_marker "$fresh_two" fresh-two-empty-start
'''
if text.count(fresh_two_old) != 1:
    raise SystemExit('fresh-two sequencing contract changed')
text = text.replace(fresh_two_old, fresh_two_new, 1)

upgrade_old = 'CURRENT_STAGE="upgrade-empty-start"\nstart_with_marker "$upgrade" upgrade-empty-start\n'
upgrade_new = '''CURRENT_STAGE="upgrade-initialization"
initialize_empty_workdir "$upgrade" upgrade

CURRENT_STAGE="upgrade-empty-start"
start_with_marker "$upgrade" upgrade-empty-start
'''
if text.count(upgrade_old) != 1:
    raise SystemExit('upgrade sequencing contract changed')
text = text.replace(upgrade_old, upgrade_new, 1)

health_old = '''wait_for_health_timeout(){
  local workdir="$1" label="$2" config attempt
  config="$workdir/supabase/config.toml"
  for attempt in $(seq 1 1800); do
    if [[ -f "$config" ]] && grep -Eq '^health_timeout = "5m"$' "$config"; then
      return 0
    fi
    sleep 0.1
  done
  CURRENT_STAGE="${label}-health-timeout-not-ready"
  return 1
}

initialize_empty_workdir(){
  local workdir="$1" label="$2"
  mkdir -p "$workdir"
  sealed "${label}-init" supabase --workdir "$workdir" init --force
  rm -rf "$workdir/supabase/migrations"
  mkdir -p "$workdir/supabase/migrations"
  wait_for_health_timeout "$workdir" "$label"
}
'''
health_new = f'''patch_health_timeout(){{
  local workdir="$1" label="$2" config
  config="$workdir/supabase/config.toml"
  CURRENT_STAGE="${{label}}-health-timeout-config"
  python - "$config" "{candidate_health_timeout}" <<'PY_HEALTH'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
value = sys.argv[2]
text = path.read_text(encoding='utf-8')
section = re.search(r'(?m)^\\[db\\]\\s*$', text)
if section is None:
    raise SystemExit('db section missing')
next_section = re.search(r'(?m)^\\[[^\\]]+\\]\\s*$', text[section.end():])
end = section.end() + (next_section.start() if next_section else len(text) - section.end())
block = text[section.end():end]
replacement = f'health_timeout = "{{value}}"'
if re.search(r'(?m)^\\s*health_timeout\\s*=', block):
    block = re.sub(r'(?m)^\\s*health_timeout\\s*=.*$', replacement, block, count=1)
else:
    block = '\\n' + replacement + block
path.write_text(text[:section.end()] + block + text[end:], encoding='utf-8')
PY_HEALTH
  grep -Eq '^health_timeout = "{candidate_health_timeout}"$' "$config"
}}

initialize_empty_workdir(){{
  local workdir="$1" label="$2"
  mkdir -p "$workdir"
  sealed "${{label}}-init" supabase --workdir "$workdir" init --force
  patch_health_timeout "$workdir" "$label"
  rm -rf "$workdir/supabase/migrations"
  mkdir -p "$workdir/supabase/migrations"
}}
'''
if text.count(health_old) != 1:
    raise SystemExit('health timeout sequencing contract changed')
text = text.replace(health_old, health_new, 1)
if 'wait_for_health_timeout' in text:
    raise SystemExit('legacy health timeout waiter remains')

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

for forbidden in (
    'supabase --debug --workdir',
    'trainingos-marketplace-matching-context-fresh"',
    'trainingos-marketplace-matching-context-fresh-two"',
    'trainingos-marketplace-matching-context-upgrade"',
    'CURRENT_STAGE="workdir-initialization"',
):
    if forbidden in text:
        raise SystemExit(f'forbidden legacy marker remains: {forbidden}')

target.write_text(text, encoding='utf-8')
PY
  chmod 700 "$runner_script"
  grep -q 'supabase_cli_version="2.109.1"' "$runner_script"
  grep -q 'fresh="$RUNNER_TEMP/mc-f1"' "$runner_script"
  grep -q 'fresh_two="$RUNNER_TEMP/mc-f2"' "$runner_script"
  grep -q 'upgrade="$RUNNER_TEMP/mc-up"' "$runner_script"
  grep -q 'CURRENT_STAGE="fresh-one-initialization"' "$runner_script"
  grep -q 'CURRENT_STAGE="fresh-two-initialization"' "$runner_script"
  grep -q 'CURRENT_STAGE="upgrade-initialization"' "$runner_script"
  grep -q 'patch_health_timeout(){' "$runner_script"
  ! grep -q 'supabase --debug --workdir' "$runner_script"
  ! grep -q 'wait_for_health_timeout' "$runner_script"
}

for index in "${!primary_images[@]}"; do
  prefetch_one "$index"
done
prepare_runner
bash "$runner_script"
