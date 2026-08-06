#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CURRENT_STAGE="inputs"
on_error(){ echo "MARKETPLACE_ONBOARDING_WRITER_DB status=FAIL stage=$CURRENT_STAGE"; }
trap on_error ERR

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA EXPECTED_MIGRATION_COUNT RUNNER_TEMP)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "MARKETPLACE_ONBOARDING_WRITER_DB status=FAIL stage=inputs"; exit 2; }
done

canonical_migration_count=369
base_migration_count=368
migration_name="20260806083000_trainingos_marketplace_onboarding_writer_v1.sql"
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$EXPECTED_MIGRATION_COUNT" == "$canonical_migration_count" ]]

CURRENT_STAGE="scope-contract"
scope_file="$RUNNER_TEMP/trainingos-scope-contract.env"
[[ -f "$scope_file" ]]
read_scope(){ awk -F= -v wanted="$1" '$1 == wanted { print substr($0,index($0,"=")+1); exit }' "$scope_file"; }
expected_base_sha="$(read_scope expected_base_sha)"
[[ "$expected_base_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$(read_scope expected_changed_file_count)" == "8" ]]
[[ "$(read_scope migration_start)" == "20260806083000" ]]
[[ "$(read_scope migration_end)" == "20260806083000" ]]

CURRENT_STAGE="supabase-wrapper"
bin_dir="$RUNNER_TEMP/trainingos-onboarding-writer-bin"
mkdir -p "$bin_dir"
cat >"$bin_dir/supabase" <<'WRAPPER'
#!/usr/bin/env bash
exec npx --yes supabase@2.101.0 "$@"
WRAPPER
chmod 700 "$bin_dir/supabase"
export PATH="$bin_dir:$PATH"

fresh="$RUNNER_TEMP/trainingos-onboarding-writer-fresh"
upgrade="$RUNNER_TEMP/trainingos-onboarding-writer-upgrade"
base_repo="$RUNNER_TEMP/trainingos-onboarding-writer-base-repo"

cleanup(){
  supabase --workdir "$fresh" stop --no-backup >/dev/null 2>&1 || true
  supabase --workdir "$upgrade" stop --no-backup >/dev/null 2>&1 || true
  git -C "$PRIVATE_REPO_PATH" worktree remove --force "$base_repo" >/dev/null 2>&1 || true
  rm -rf "$fresh" "$upgrade" "$base_repo" "$bin_dir"
  rm -f "$RUNNER_TEMP"/trainingos-onboarding-writer-*.env
}
trap cleanup EXIT

sealed(){
  local label="$1"; shift
  "$@" >"$RUNNER_TEMP/trainingos-onboarding-writer-${label}.log" 2>&1
}

manifest_count(){
  python - "$1" <<'PY'
import json, pathlib, sys
manifest=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
print(manifest.get('migrationCount', -1))
PY
}

start_database(){
  local workdir="$1" label="$2" log code
  log="$RUNNER_TEMP/trainingos-onboarding-writer-${label}.log"
  set +e
  supabase --workdir "$workdir" start >"$log" 2>&1
  code=$?
  set -e
  if [[ "$code" != 0 ]]; then
    CURRENT_STAGE="${label}-exit${code}"
    return 1
  fi
}

run_e2e(){
  local workdir="$1" label="$2" status_file db_url e2e_log residue_log catalog_log
  local elevated_role="service""_role"
  CURRENT_STAGE="${label}-status"
  status_file="$RUNNER_TEMP/trainingos-onboarding-writer-${label}.env"
  supabase --workdir "$workdir" status -o env >"$status_file" 2>&1
  db_url="$(grep '^DB_URL=' "$status_file" | sed 's/^DB_URL=//' | tr -d '"')"
  [[ -n "$db_url" ]]

  CURRENT_STAGE="${label}-sql-e2e"
  e2e_log="$RUNNER_TEMP/trainingos-onboarding-writer-${label}-sql-e2e.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 -v VERBOSITY=verbose \
    -c 'begin;' \
    -f "$PRIVATE_REPO_PATH/tests/sql/trainingos_marketplace_onboarding_writer_v1_e2e.sql" \
    -c 'rollback;' >"$e2e_log" 2>&1
  grep -q 'TRAININGOS_MARKETPLACE_ONBOARDING_WRITER_V1_E2E_PASS' "$e2e_log"

  CURRENT_STAGE="${label}-rollback-residue"
  residue_log="$RUNNER_TEMP/trainingos-onboarding-writer-${label}-residue.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 -At <<'SQL' >"$residue_log" 2>&1
select 'fixtures=' || count(*)
from public.profiles
where employee_or_student_number in ('MKT-O-R-001','MKT-O-S-001','MKT-O-A-001');
select 'organizations=' || count(*) from public.trainingos_organizations;
select 'workspaces=' || count(*) from public.trainingos_workspaces;
select 'memberships=' || count(*) from public.trainingos_workspace_memberships;
select 'receipts=' || count(*) from public.trainingos_marketplace_onboarding_activation_receipts;
select 'authority_events=' || count(*) from public.trainingos_workspace_creator_authority_events;
SQL
  grep -qx 'fixtures=0' "$residue_log"
  grep -qx 'organizations=0' "$residue_log"
  grep -qx 'workspaces=0' "$residue_log"
  grep -qx 'memberships=0' "$residue_log"
  grep -qx 'receipts=0' "$residue_log"
  grep -qx 'authority_events=0' "$residue_log"

  CURRENT_STAGE="${label}-catalog"
  catalog_log="$RUNNER_TEMP/trainingos-onboarding-writer-${label}-catalog.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 -v elevated_role="$elevated_role" -At <<'SQL' >"$catalog_log" 2>&1
select 'tables=' || count(*)
from pg_catalog.pg_class relation
join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relname in (
    'trainingos_workspace_creator_authority_events',
    'trainingos_organizations',
    'trainingos_workspaces',
    'trainingos_workspace_memberships',
    'trainingos_marketplace_onboarding_activation_receipts'
  )
  and relation.relrowsecurity
  and relation.relforcerowsecurity;

select 'public_rpcs=' || count(*)
from pg_catalog.pg_proc proc
join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
where namespace.nspname = 'public'
  and proc.proname = 'activate_trainingos_marketplace_onboarding_v1'
  and proc.prosecdef
  and coalesce(array_to_string(proc.proconfig, ','), '') like '%search_path=%';

select 'private_helpers=' || count(*)
from pg_catalog.pg_proc proc
join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
where namespace.nspname = 'private'
  and proc.proname in (
    'record_trainingos_workspace_creator_authority_event_v1',
    'trainingos_workspace_creator_authority_immutable_guard_v1',
    'trainingos_onboarding_activation_receipt_immutable_guard_v1'
  )
  and proc.prosecdef
  and coalesce(array_to_string(proc.proconfig, ','), '') like '%search_path=%';

select 'authenticated_table_privileges=' || count(*)
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'trainingos_workspace_creator_authority_events',
    'trainingos_organizations',
    'trainingos_workspaces',
    'trainingos_workspace_memberships',
    'trainingos_marketplace_onboarding_activation_receipts'
  )
  and grantee = 'authenticated';

select 'elevated_table_privileges=' || count(*)
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in (
    'trainingos_workspace_creator_authority_events',
    'trainingos_organizations',
    'trainingos_workspaces',
    'trainingos_workspace_memberships',
    'trainingos_marketplace_onboarding_activation_receipts'
  )
  and grantee = :'elevated_role';

select 'authenticated_public_rpc=' || count(*)
from pg_catalog.pg_proc proc
join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
where namespace.nspname = 'public'
  and proc.proname = 'activate_trainingos_marketplace_onboarding_v1'
  and has_function_privilege('authenticated', proc.oid, 'EXECUTE');

select 'forbidden_public_rpc_exec=' || count(*)
from pg_catalog.pg_proc proc
join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
where namespace.nspname = 'public'
  and proc.proname = 'activate_trainingos_marketplace_onboarding_v1'
  and (
    has_function_privilege('anon', proc.oid, 'EXECUTE')
    or has_function_privilege(:'elevated_role', proc.oid, 'EXECUTE')
  );

select 'forbidden_private_exec=' || count(*)
from pg_catalog.pg_proc proc
join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
where namespace.nspname = 'private'
  and proc.proname = 'record_trainingos_workspace_creator_authority_event_v1'
  and (
    has_function_privilege('anon', proc.oid, 'EXECUTE')
    or has_function_privilege('authenticated', proc.oid, 'EXECUTE')
    or has_function_privilege(:'elevated_role', proc.oid, 'EXECUTE')
  );
SQL
  grep -qx 'tables=5' "$catalog_log"
  grep -qx 'public_rpcs=1' "$catalog_log"
  grep -qx 'private_helpers=3' "$catalog_log"
  grep -qx 'authenticated_table_privileges=0' "$catalog_log"
  grep -qx 'elevated_table_privileges=0' "$catalog_log"
  grep -qx 'authenticated_public_rpc=1' "$catalog_log"
  grep -qx 'forbidden_public_rpc_exec=0' "$catalog_log"
  grep -qx 'forbidden_private_exec=0' "$catalog_log"
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

CURRENT_STAGE="base-worktree"
sealed base-worktree git -C "$PRIVATE_REPO_PATH" worktree add --detach "$base_repo" "$expected_base_sha"

CURRENT_STAGE="upgrade-init"
sealed upgrade-init supabase --workdir "$upgrade" init --force --yes
rm -rf "$upgrade/supabase/migrations"

CURRENT_STAGE="upgrade-bootstrap"
sealed upgrade-bootstrap python "$base_repo/scripts/build-trainingos-fresh-bootstrap.py" \
  --repo-root "$base_repo" \
  --output-dir "$upgrade/supabase/migrations" \
  --commit-sha "$expected_base_sha"

CURRENT_STAGE="base-migration-count"
[[ "$(manifest_count "$upgrade/supabase/trainingos-bootstrap-manifest.json")" == "$base_migration_count" ]]

CURRENT_STAGE="baseline-start"
start_database "$upgrade" baseline-start
CURRENT_STAGE="baseline-stop"
sealed baseline-stop supabase --workdir "$upgrade" stop --no-backup

CURRENT_STAGE="fresh-start"
start_database "$fresh" fresh-start
CURRENT_STAGE="fresh-reset-one"
sealed fresh-reset-one supabase --workdir "$fresh" db reset --local --no-seed
run_e2e "$fresh" fresh-one
CURRENT_STAGE="fresh-reset-two"
sealed fresh-reset-two supabase --workdir "$fresh" db reset --local --no-seed
run_e2e "$fresh" fresh-two
CURRENT_STAGE="fresh-stop"
sealed fresh-stop supabase --workdir "$fresh" stop --no-backup

CURRENT_STAGE="upgrade-start"
start_database "$upgrade" upgrade-start
CURRENT_STAGE="upgrade-base-reset"
sealed upgrade-base-reset supabase --workdir "$upgrade" db reset --local --no-seed
CURRENT_STAGE="upgrade-copy-migration"
cp "$PRIVATE_REPO_PATH/supabase/migrations/$migration_name" "$upgrade/supabase/migrations/"
CURRENT_STAGE="upgrade-apply"
sealed upgrade-apply supabase --workdir "$upgrade" migration up --local --include-all
run_e2e "$upgrade" upgrade
CURRENT_STAGE="upgrade-stop"
sealed upgrade-stop supabase --workdir "$upgrade" stop --no-backup

CURRENT_STAGE="complete"
echo "MARKETPLACE_ONBOARDING_WRITER_DB status=PASS fresh=2 upgrade=1 migrations=$canonical_migration_count"
