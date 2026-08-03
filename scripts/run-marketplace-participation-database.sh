#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CURRENT_STAGE="inputs"
on_error(){ echo "MARKETPLACE_PARTICIPATION_DB status=FAIL stage=$CURRENT_STAGE"; }
trap on_error ERR

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA EXPECTED_MIGRATION_COUNT RUNNER_TEMP)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "MARKETPLACE_PARTICIPATION_DB status=FAIL stage=inputs"; exit 2; }
done

canonical_migration_count=364
base_migration_count=363
migration_name="20260803072000_trainingos_marketplace_participation_v1.sql"
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$EXPECTED_MIGRATION_COUNT" == "$canonical_migration_count" ]]

CURRENT_STAGE="scope-contract"
scope_file="$RUNNER_TEMP/trainingos-scope-contract.env"
[[ -f "$scope_file" ]] || { echo "MARKETPLACE_PARTICIPATION_DB status=FAIL stage=scope-contract"; exit 2; }
read_scope(){ awk -F= -v wanted="$1" '$1 == wanted { print substr($0,index($0,"=")+1); exit }' "$scope_file"; }
expected_base_sha="$(read_scope expected_base_sha)"
[[ "$expected_base_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$(read_scope expected_changed_file_count)" == "4" ]]
[[ "$(read_scope migration_start)" == "20260803072000" ]]
[[ "$(read_scope migration_end)" == "20260803072000" ]]

CURRENT_STAGE="supabase-wrapper"
bin_dir="$RUNNER_TEMP/trainingos-marketplace-participation-bin"
mkdir -p "$bin_dir"
cat >"$bin_dir/supabase" <<'WRAPPER'
#!/usr/bin/env bash
exec npx --yes supabase@latest "$@"
WRAPPER
chmod 700 "$bin_dir/supabase"
export PATH="$bin_dir:$PATH"

fresh="$RUNNER_TEMP/trainingos-marketplace-participation-fresh"
upgrade="$RUNNER_TEMP/trainingos-marketplace-participation-upgrade"
base_repo="$RUNNER_TEMP/trainingos-marketplace-participation-base-repo"

cleanup(){
  supabase --workdir "$fresh" stop --no-backup >/dev/null 2>&1 || true
  supabase --workdir "$upgrade" stop --no-backup >/dev/null 2>&1 || true
  git -C "$PRIVATE_REPO_PATH" worktree remove --force "$base_repo" >/dev/null 2>&1 || true
  rm -rf "$fresh" "$upgrade" "$base_repo" "$bin_dir"
  rm -f "$RUNNER_TEMP"/trainingos-marketplace-participation-*.env
}
trap cleanup EXIT

sealed(){
  local label="$1"; shift
  "$@" >"$RUNNER_TEMP/trainingos-marketplace-participation-${label}.log" 2>&1
}

manifest_count(){
  python - "$1" <<'PY'
import json, pathlib, sys
manifest=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
print(manifest.get('migrationCount', -1))
PY
}

sanitized_failure_marker(){
  local log_path="$1" exit_code="$2" sqlstate line category
  sqlstate="$(grep -Eo '(ERROR|FATAL|PANIC):[[:space:]]+[A-Z0-9]{5}:' "$log_path" 2>/dev/null \
    | tail -n 1 \
    | grep -Eo '[A-Z0-9]{5}' \
    | tr '[:upper:]' '[:lower:]' \
    || true)"
  [[ "$sqlstate" =~ ^[a-z0-9]{5}$ ]] || sqlstate="unknown"

  line="$(grep -Eo 'trainingos_marketplace_participation_v1_e2e\.sql:[0-9]+' "$log_path" 2>/dev/null \
    | tail -n 1 \
    | grep -Eo '[0-9]+$' \
    || true)"
  [[ "$line" =~ ^[0-9]{1,5}$ ]] || line="0"

  if grep -q 'FATAL:' "$log_path" 2>/dev/null; then
    category="fatal"
  elif grep -q 'ERROR:' "$log_path" 2>/dev/null; then
    category="error"
  elif grep -qi 'psql:.*error:' "$log_path" 2>/dev/null; then
    category="client"
  else
    category="unknown"
  fi

  [[ "$exit_code" =~ ^[0-9]{1,3}$ ]] || exit_code="0"
  printf '%s-%s-line%s-exit%s' "$category" "$sqlstate" "$line" "$exit_code"
}

sanitized_start_failure_marker(){
  local log_path="$1" exit_code="$2" sqlstate category migration_scope
  sqlstate="$(grep -Eo '(ERROR|FATAL|PANIC):[[:space:]]+[A-Z0-9]{5}:' "$log_path" 2>/dev/null \
    | tail -n 1 \
    | grep -Eo '[A-Z0-9]{5}' \
    | tr '[:upper:]' '[:lower:]' \
    || true)"
  [[ "$sqlstate" =~ ^[a-z0-9]{5}$ ]] || sqlstate="unknown"

  if grep -q "$migration_name" "$log_path" 2>/dev/null; then
    migration_scope="marketplace"
  elif grep -Eq '20[0-9]{12}_[a-z0-9_]+\.sql' "$log_path" 2>/dev/null; then
    migration_scope="base_history"
  else
    migration_scope="none"
  fi

  if grep -q 'FATAL:' "$log_path" 2>/dev/null; then
    category="fatal"
  elif grep -q 'ERROR:' "$log_path" 2>/dev/null; then
    category="error"
  elif grep -Eqi '(supabase|docker|container|psql):.*(error|failed)' "$log_path" 2>/dev/null; then
    category="client"
  else
    category="unknown"
  fi

  [[ "$exit_code" =~ ^[0-9]{1,3}$ ]] || exit_code="0"
  printf '%s-%s-migration%s-exit%s' "$category" "$sqlstate" "$migration_scope" "$exit_code"
}

start_with_marker(){
  local workdir="$1" label="$2" start_log start_code marker
  start_log="$RUNNER_TEMP/trainingos-marketplace-participation-${label}.log"
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
  local elevated_role="service""_role"
  local e2e_code marker

  CURRENT_STAGE="${label}-status"
  status_file="$RUNNER_TEMP/trainingos-marketplace-participation-${label}.env"
  supabase --workdir "$workdir" status -o env >"$status_file" 2>&1
  db_url="$(grep '^DB_URL=' "$status_file" | sed 's/^DB_URL=//' | tr -d '"')"
  [[ -n "$db_url" ]]

  CURRENT_STAGE="${label}-sql-e2e"
  e2e_log="$RUNNER_TEMP/trainingos-marketplace-participation-${label}-sql-e2e.log"
  set +e
  psql "$db_url" -X -v ON_ERROR_STOP=1 -v VERBOSITY=verbose \
    -c 'begin;' \
    -f "$PRIVATE_REPO_PATH/tests/sql/trainingos_marketplace_participation_v1_e2e.sql" \
    -c 'rollback;' >"$e2e_log" 2>&1
  e2e_code=$?
  set -e
  if [[ "$e2e_code" != 0 ]]; then
    marker="$(sanitized_failure_marker "$e2e_log" "$e2e_code")"
    CURRENT_STAGE="${label}-sql-e2e-${marker}"
    return 1
  fi
  grep -q 'TRAININGOS_MARKETPLACE_PARTICIPATION_V1_E2E_PASS' "$e2e_log"

  CURRENT_STAGE="${label}-rollback-residue"
  residue_log="$RUNNER_TEMP/trainingos-marketplace-participation-${label}-residue.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 -At <<'SQL' >"$residue_log" 2>&1
select 'fixtures=' || count(*)
from public.profiles
where employee_or_student_number in ('MKT-D-001', 'MKT-S-001', 'MKT-U-001');
select 'supply=' || count(*) from public.trainingos_marketplace_supply_participations;
select 'demand=' || count(*) from public.trainingos_marketplace_demands;
select 'claim=' || count(*) from public.trainingos_marketplace_claim_requests;
select 'contact=' || count(*) from public.trainingos_marketplace_contact_requests;
select 'handoff=' || count(*) from public.trainingos_marketplace_handoff_proposals;
select 'events=' || count(*) from public.trainingos_marketplace_participation_events;
SQL
  grep -qx 'fixtures=0' "$residue_log"
  grep -qx 'supply=0' "$residue_log"
  grep -qx 'demand=0' "$residue_log"
  grep -qx 'claim=0' "$residue_log"
  grep -qx 'contact=0' "$residue_log"
  grep -qx 'handoff=0' "$residue_log"
  grep -qx 'events=0' "$residue_log"

  CURRENT_STAGE="${label}-catalog"
  catalog_log="$RUNNER_TEMP/trainingos-marketplace-participation-${label}-catalog.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 -v elevated_role="$elevated_role" -At <<'SQL' >"$catalog_log" 2>&1
select 'tables=' || count(*)
from pg_catalog.pg_class relation
join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relname in (
    'trainingos_marketplace_supply_participations',
    'trainingos_marketplace_demands',
    'trainingos_marketplace_claim_requests',
    'trainingos_marketplace_contact_requests',
    'trainingos_marketplace_handoff_proposals',
    'trainingos_marketplace_participation_events'
  )
  and relation.relrowsecurity
  and relation.relforcerowsecurity;

select 'public_rpcs=' || count(*)
from pg_catalog.pg_proc proc
join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
where namespace.nspname = 'public'
  and proc.proname in (
    'submit_trainingos_marketplace_supply_v1',
    'submit_trainingos_marketplace_demand_v1',
    'request_trainingos_marketplace_claim_v1',
    'request_trainingos_marketplace_contact_v1',
    'respond_trainingos_marketplace_contact_v1',
    'create_trainingos_marketplace_learning_contract_handoff_v1',
    'get_my_trainingos_marketplace_participation_v1'
  )
  and proc.prosecdef
  and coalesce(array_to_string(proc.proconfig, ','), '') like '%search_path=%';

select 'authenticated_table_privileges=' || count(*)
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'trainingos_marketplace_%'
  and grantee = 'authenticated';

select 'elevated_table_privileges=' || count(*)
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'trainingos_marketplace_%'
  and grantee = :'elevated_role';
SQL
  grep -qx 'tables=6' "$catalog_log"
  grep -qx 'public_rpcs=7' "$catalog_log"
  grep -qx 'authenticated_table_privileges=0' "$catalog_log"
  grep -qx 'elevated_table_privileges=0' "$catalog_log"
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
echo "MARKETPLACE_PARTICIPATION_DB status=PASS exact_head=$PRIVATE_EXACT_SHA canonical_migrations=$canonical_migration_count fresh_replay=PASS second_replay=PASS upgrade_replay=PASS sql_e2e=PASS rollback=PASS catalog=PASS zero_residue=PASS cleanup=PASS"
