#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CURRENT_STAGE="inputs"
on_error(){ echo "MARKETPLACE_MATCHING_CONTEXT_DB status=FAIL stage=$CURRENT_STAGE"; }
trap on_error ERR

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA EXPECTED_MIGRATION_COUNT RUNNER_TEMP)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "MARKETPLACE_MATCHING_CONTEXT_DB status=FAIL stage=inputs"; exit 2; }
done

canonical_migration_count=367
base_migration_count=366
supabase_cli_version="2.101.0"
migration_name="20260805063000_trainingos_marketplace_matching_context_projection_v1.sql"
e2e_name="trainingos_marketplace_matching_context_projection_v1_e2e.sql"
pass_marker="TRAININGOS_MARKETPLACE_MATCHING_CONTEXT_PROJECTION_V1_E2E_PASS"
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$EXPECTED_MIGRATION_COUNT" == "$canonical_migration_count" ]]

CURRENT_STAGE="scope-contract"
scope_file="$RUNNER_TEMP/trainingos-scope-contract.env"
[[ -f "$scope_file" ]] || { echo "MARKETPLACE_MATCHING_CONTEXT_DB status=FAIL stage=scope-contract"; exit 2; }
read_scope(){ awk -F= -v wanted="$1" '$1 == wanted { print substr($0,index($0,"=")+1); exit }' "$scope_file"; }
expected_base_sha="$(read_scope expected_base_sha)"
[[ "$expected_base_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$(read_scope expected_changed_file_count)" == "8" ]]
[[ "$(read_scope migration_start)" == "20260805063000" ]]
[[ "$(read_scope migration_end)" == "20260805063000" ]]

CURRENT_STAGE="supabase-release-download"
bin_dir="$RUNNER_TEMP/trainingos-marketplace-matching-context-bin"
archive="$RUNNER_TEMP/supabase_linux_amd64-${supabase_cli_version}.tar.gz"
mkdir -p "$bin_dir"
curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location --retry 3 \
  "https://github.com/supabase/cli/releases/download/v${supabase_cli_version}/supabase_linux_amd64.tar.gz" \
  --output "$archive" \
  >"$RUNNER_TEMP/trainingos-marketplace-matching-context-supabase-download.log" 2>&1

CURRENT_STAGE="supabase-release-extract"
tar -xzf "$archive" -C "$bin_dir" \
  >"$RUNNER_TEMP/trainingos-marketplace-matching-context-supabase-extract.log" 2>&1
rm -f "$archive"
chmod 700 "$bin_dir/supabase"
export PATH="$bin_dir:$PATH"

CURRENT_STAGE="supabase-release-version"
actual_supabase_version="$(supabase --version | tr -d '\r' | awk 'NF { print $NF; exit }')"
[[ "$actual_supabase_version" == "$supabase_cli_version" ]]

fresh="$RUNNER_TEMP/trainingos-marketplace-matching-context-fresh"
upgrade="$RUNNER_TEMP/trainingos-marketplace-matching-context-upgrade"
base_repo="$RUNNER_TEMP/trainingos-marketplace-matching-context-base-repo"

cleanup(){
  supabase --workdir "$fresh" stop --no-backup >/dev/null 2>&1 || true
  supabase --workdir "$upgrade" stop --no-backup >/dev/null 2>&1 || true
  git -C "$PRIVATE_REPO_PATH" worktree remove --force "$base_repo" >/dev/null 2>&1 || true
  rm -rf "$fresh" "$upgrade" "$base_repo" "$bin_dir"
  rm -f "$archive" "$RUNNER_TEMP"/trainingos-marketplace-matching-context-*.env
}
trap cleanup EXIT

sealed(){
  local label="$1"; shift
  "$@" >"$RUNNER_TEMP/trainingos-marketplace-matching-context-${label}.log" 2>&1
}

manifest_count(){
  python - "$1" <<'PY'
import json, pathlib, sys
manifest=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
print(manifest.get('migrationCount', -1))
PY
}

sanitized_start_failure_marker(){
  local log_path="$1" exit_code="$2" sqlstate category migration_scope resource
  sqlstate="$(grep -Eo '(ERROR|FATAL|PANIC):[[:space:]]+[A-Z0-9]{5}:' "$log_path" 2>/dev/null \
    | tail -n 1 \
    | grep -Eo '[A-Z0-9]{5}' \
    | tr '[:upper:]' '[:lower:]' \
    || true)"
  [[ "$sqlstate" =~ ^[a-z0-9]{5}$ ]] || sqlstate="unknown"

  if grep -q "$migration_name" "$log_path" 2>/dev/null; then
    migration_scope="matching_context"
  elif grep -Eq '20[0-9]{12}_[a-z0-9_]+\.sql' "$log_path" 2>/dev/null; then
    migration_scope="base_history"
  else
    migration_scope="none"
  fi

  if grep -Eqi '(address already in use|port is already allocated|bind:.*failed)' "$log_path" 2>/dev/null; then
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

  if grep -q 'FATAL:' "$log_path" 2>/dev/null; then
    category="fatal"
  elif grep -q 'ERROR:' "$log_path" 2>/dev/null; then
    category="error"
  elif grep -Eqi '(docker|container|supabase):.*(error|failed|unhealthy)' "$log_path" 2>/dev/null; then
    category="client"
  else
    category="unknown"
  fi

  [[ "$exit_code" =~ ^[0-9]{1,3}$ ]] || exit_code="0"
  printf '%s-%s-migration%s-resource%s-exit%s' \
    "$category" "$sqlstate" "$migration_scope" "$resource" "$exit_code"
}

start_with_marker(){
  local workdir="$1" label="$2" start_log start_code marker
  start_log="$RUNNER_TEMP/trainingos-marketplace-matching-context-${label}.log"
  set +e
  supabase --workdir "$workdir" start >"$start_log" 2>&1
  start_code=$?
  set -e
  if [[ "$start_code" != 0 ]]; then
    marker="$(sanitized_start_failure_marker "$start_log" "$start_code")"
    CURRENT_STAGE="${label}-${marker}"
    return 1
  fi
}

run_e2e(){
  local workdir="$1" label="$2" status_file db_url e2e_log residue_log catalog_log

  CURRENT_STAGE="${label}-status"
  status_file="$RUNNER_TEMP/trainingos-marketplace-matching-context-${label}.env"
  supabase --workdir "$workdir" status -o env >"$status_file" 2>&1
  db_url="$(grep '^DB_URL=' "$status_file" | sed 's/^DB_URL=//' | tr -d '"')"
  [[ -n "$db_url" ]]

  CURRENT_STAGE="${label}-sql-e2e"
  e2e_log="$RUNNER_TEMP/trainingos-marketplace-matching-context-${label}-sql-e2e.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 -v VERBOSITY=verbose \
    -c 'begin;' \
    -f "$PRIVATE_REPO_PATH/tests/sql/$e2e_name" \
    -c 'rollback;' >"$e2e_log" 2>&1
  grep -q "$pass_marker" "$e2e_log"

  CURRENT_STAGE="${label}-rollback-residue"
  residue_log="$RUNNER_TEMP/trainingos-marketplace-matching-context-${label}-residue.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 -At <<'SQL' >"$residue_log" 2>&1
select 'fixtures=' || count(*)
from public.profiles
where employee_or_student_number in ('MATCH-D-001', 'MATCH-S-001', 'MATCH-X-001');
select 'supply=' || count(*) from public.trainingos_marketplace_supply_participations;
select 'demand=' || count(*) from public.trainingos_marketplace_demands;
select 'contact=' || count(*) from public.trainingos_marketplace_contact_requests;
select 'handoff=' || count(*) from public.trainingos_marketplace_handoff_proposals;
select 'events=' || count(*) from public.trainingos_marketplace_participation_events;
SQL
  grep -qx 'fixtures=0' "$residue_log"
  grep -qx 'supply=0' "$residue_log"
  grep -qx 'demand=0' "$residue_log"
  grep -qx 'contact=0' "$residue_log"
  grep -qx 'handoff=0' "$residue_log"
  grep -qx 'events=0' "$residue_log"

  CURRENT_STAGE="${label}-catalog"
  catalog_log="$RUNNER_TEMP/trainingos-marketplace-matching-context-${label}-catalog.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 -At <<'SQL' >"$catalog_log" 2>&1
select 'function_count=' || count(*)
from pg_catalog.pg_proc proc
join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
where namespace.nspname = 'public'
  and proc.proname = 'get_trainingos_marketplace_matching_context_v1'
  and proc.prosecdef
  and proc.provolatile = 's'
  and coalesce(array_to_string(proc.proconfig, ','), '') like '%search_path=%';
select 'authenticated_execute=' || has_function_privilege(
  'authenticated',
  'public.get_trainingos_marketplace_matching_context_v1(integer)',
  'EXECUTE'
);
select 'anon_execute=' || has_function_privilege(
  'anon',
  'public.get_trainingos_marketplace_matching_context_v1(integer)',
  'EXECUTE'
);
select 'public_execute=' || exists (
  select 1
  from pg_catalog.pg_proc proc
  join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
  cross join lateral pg_catalog.aclexplode(
    coalesce(proc.proacl, pg_catalog.acldefault('f', proc.proowner))
  ) privilege
  where namespace.nspname = 'public'
    and proc.proname = 'get_trainingos_marketplace_matching_context_v1'
    and privilege.grantee = 0
    and privilege.privilege_type = 'EXECUTE'
);
select 'new_tables=' || count(*)
from pg_catalog.pg_class relation
join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relname = 'trainingos_marketplace_matching_context';
SQL
  grep -qx 'function_count=1' "$catalog_log"
  grep -qx 'authenticated_execute=true' "$catalog_log"
  grep -qx 'anon_execute=false' "$catalog_log"
  grep -qx 'public_execute=false' "$catalog_log"
  grep -qx 'new_tables=0' "$catalog_log"
}

rm -rf "$fresh" "$upgrade" "$base_repo"

CURRENT_STAGE="fresh-init"
sealed fresh-init supabase --workdir "$fresh" init --force --yes
rm -rf "$fresh/supabase/migrations"

CURRENT_STAGE="fresh-bootstrap"
sealed fresh-bootstrap python "$PRIVATE_REPO_PATH/scripts/build-trainingos-fresh-bootstrap.py" \
  --repo-root "$PRIVATE_REPO_PATH" \
  --output-dir "$fresh/supabase/migrations" \
  --commit-sha "$PRIVATE_EXACT_SHA"

CURRENT_STAGE="fresh-migration-count"
[[ "$(manifest_count "$fresh/supabase/trainingos-bootstrap-manifest.json")" == "$canonical_migration_count" ]]

CURRENT_STAGE="baseline-base-worktree"
sealed baseline-base-worktree git -C "$PRIVATE_REPO_PATH" worktree add --detach "$base_repo" "$expected_base_sha"

CURRENT_STAGE="baseline-init"
sealed baseline-init supabase --workdir "$upgrade" init --force --yes
rm -rf "$upgrade/supabase/migrations"

CURRENT_STAGE="baseline-bootstrap"
sealed baseline-bootstrap python "$base_repo/scripts/build-trainingos-fresh-bootstrap.py" \
  --repo-root "$base_repo" \
  --output-dir "$upgrade/supabase/migrations" \
  --commit-sha "$expected_base_sha"

CURRENT_STAGE="baseline-migration-count"
[[ "$(manifest_count "$upgrade/supabase/trainingos-bootstrap-manifest.json")" == "$base_migration_count" ]]

CURRENT_STAGE="baseline-start"
start_with_marker "$upgrade" baseline-start

CURRENT_STAGE="baseline-stop"
sealed baseline-stop supabase --workdir "$upgrade" stop --no-backup

CURRENT_STAGE="fresh-start"
start_with_marker "$fresh" fresh-start

CURRENT_STAGE="fresh-reset"
sealed fresh-reset supabase --workdir "$fresh" db reset --local --no-seed
run_e2e "$fresh" fresh-one
run_e2e "$fresh" fresh-two

CURRENT_STAGE="fresh-stop"
sealed fresh-stop supabase --workdir "$fresh" stop --no-backup

CURRENT_STAGE="upgrade-start"
start_with_marker "$upgrade" upgrade-start

CURRENT_STAGE="upgrade-base-reset"
sealed upgrade-base-reset supabase --workdir "$upgrade" db reset --local --no-seed

CURRENT_STAGE="upgrade-copy-forward-migration"
cp "$PRIVATE_REPO_PATH/supabase/migrations/$migration_name" "$upgrade/supabase/migrations/"

CURRENT_STAGE="upgrade-apply"
sealed upgrade-apply supabase --workdir "$upgrade" migration up --local --include-all
run_e2e "$upgrade" upgrade

CURRENT_STAGE="upgrade-stop"
sealed upgrade-stop supabase --workdir "$upgrade" stop --no-backup

CURRENT_STAGE="complete"
echo "MARKETPLACE_MATCHING_CONTEXT_DB status=PASS exact_head=$PRIVATE_EXACT_SHA canonical_migrations=$canonical_migration_count supabase_cli=$supabase_cli_version fresh_replay=PASS second_replay=PASS upgrade_replay=PASS sql_e2e=PASS rollback=PASS catalog=PASS zero_residue=PASS cleanup=PASS"
