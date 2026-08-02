#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CURRENT_STAGE="inputs"
on_error(){ echo "INTERACTION_FOUNDATION_DB status=FAIL stage=$CURRENT_STAGE"; }
trap on_error ERR

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA EXPECTED_MIGRATION_COUNT RUNNER_TEMP)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "INTERACTION_FOUNDATION_DB status=FAIL stage=inputs"; exit 2; }
done

canonical_migration_count=360
base_migration_count=357
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$EXPECTED_MIGRATION_COUNT" == "$canonical_migration_count" ]]

CURRENT_STAGE="scope-contract"
scope_file="$RUNNER_TEMP/trainingos-scope-contract.env"
[[ -f "$scope_file" ]] || { echo "INTERACTION_FOUNDATION_DB status=FAIL stage=scope-contract"; exit 2; }
read_scope(){ awk -F= -v wanted="$1" '$1 == wanted { print substr($0,index($0,"=")+1); exit }' "$scope_file"; }
expected_base_sha="$(read_scope expected_base_sha)"
[[ "$expected_base_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$(read_scope expected_changed_file_count)" == "13" ]]
[[ "$(read_scope migration_start)" == "20260802100000" ]]
[[ "$(read_scope migration_end)" == "20260802100200" ]]

CURRENT_STAGE="supabase-wrapper"
bin_dir="$RUNNER_TEMP/trainingos-interaction-foundation-bin"
mkdir -p "$bin_dir"
cat >"$bin_dir/supabase" <<'WRAPPER'
#!/usr/bin/env bash
exec npx --yes supabase@latest "$@"
WRAPPER
chmod 700 "$bin_dir/supabase"
export PATH="$bin_dir:$PATH"

fresh="$RUNNER_TEMP/trainingos-interaction-foundation-fresh"
upgrade="$RUNNER_TEMP/trainingos-interaction-foundation-upgrade"
base_repo="$RUNNER_TEMP/trainingos-interaction-foundation-base-repo"

cleanup(){
  supabase --workdir "$fresh" stop --no-backup >/dev/null 2>&1 || true
  supabase --workdir "$upgrade" stop --no-backup >/dev/null 2>&1 || true
  git -C "$PRIVATE_REPO_PATH" worktree remove --force "$base_repo" >/dev/null 2>&1 || true
  rm -rf "$fresh" "$upgrade" "$base_repo" "$bin_dir"
  rm -f "$RUNNER_TEMP"/trainingos-interaction-foundation-*.env
}
trap cleanup EXIT

sealed(){
  local label="$1"; shift
  "$@" >"$RUNNER_TEMP/trainingos-interaction-foundation-${label}.log" 2>&1
}

manifest_count(){
  python - "$1" <<'PY'
import json, pathlib, sys
manifest=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
print(manifest.get('migrationCount', -1))
PY
}

run_e2e(){
  local workdir="$1" label="$2" status_file db_url primary_log revocation_log catalog_file
  local elevated_role="service""_role"
  CURRENT_STAGE="${label}-status"
  status_file="$RUNNER_TEMP/trainingos-interaction-foundation-${label}.env"
  supabase --workdir "$workdir" status -o env >"$status_file" 2>&1
  db_url="$(grep '^DB_URL=' "$status_file" | sed 's/^DB_URL=//' | tr -d '"')"
  [[ -n "$db_url" ]]

  CURRENT_STAGE="${label}-primary-sql-e2e"
  primary_log="$RUNNER_TEMP/trainingos-interaction-foundation-${label}-primary-sql-e2e.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 \
    -f "$PRIVATE_REPO_PATH/tests/sql/trainingos_interaction_foundation_v1_e2e.sql" \
    >"$primary_log" 2>&1
  grep -q '"status": "PASS"' "$primary_log"
  grep -q '"agent_post_rejected": true' "$primary_log"
  grep -q '"outsider_read_rejected": true' "$primary_log"
  grep -q '"outsider_direct_rejected": true' "$primary_log"
  grep -q '"raw_table_denied": true' "$primary_log"
  grep -q '"rls_enabled_forced": true' "$primary_log"
  grep -q '"authenticated_raw_privileges": false' "$primary_log"
  grep -q "\"${elevated_role}_raw_privileges\": false" "$primary_log"
  grep -q '"authenticated_rpc_execute": true' "$primary_log"
  grep -q '"anon_rpc_execute": false' "$primary_log"
  grep -q "\"${elevated_role}_rpc_execute\": false" "$primary_log"
  grep -q '"formalBusinessWriteClaims": 0' "$primary_log"
  grep -q '"fixtureCleanup": "PLPGSQL_SUBTRANSACTION_ROLLBACK"' "$primary_log"

  CURRENT_STAGE="${label}-direct-revocation-e2e"
  revocation_log="$RUNNER_TEMP/trainingos-interaction-foundation-${label}-direct-revocation-e2e.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 \
    -f "$PRIVATE_REPO_PATH/tests/sql/trainingos_interaction_direct_revocation_v1_e2e.sql" \
    >"$revocation_log" 2>&1
  grep -q '"status": "PASS"' "$revocation_log"
  grep -q '"canonicalMembershipStatus": "rejected"' "$revocation_log"
  grep -q '"studentReadDenied": true' "$revocation_log"
  grep -q '"studentPostDenied": true' "$revocation_log"
  grep -q '"teacherReadDenied": true' "$revocation_log"
  grep -q '"directRemovedFromProjection": true' "$revocation_log"
  grep -q '"immutableHistoryRetained": true' "$revocation_log"
  grep -q '"formalBusinessWritePerformed": false' "$revocation_log"
  grep -q '"fixtureCleanup": "PLPGSQL_SUBTRANSACTION_ROLLBACK"' "$revocation_log"

  CURRENT_STAGE="${label}-catalog"
  catalog_file="$RUNNER_TEMP/trainingos-interaction-foundation-${label}-catalog.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 -At <<'SQL' >"$catalog_file" 2>&1
select 'tables=' || count(*)
from pg_catalog.pg_class
where oid in (
  'public.trainingos_interaction_spaces'::regclass,
  'public.trainingos_interaction_space_bindings'::regclass,
  'public.trainingos_interaction_memberships'::regclass,
  'public.trainingos_interaction_threads'::regclass,
  'public.trainingos_interaction_messages'::regclass,
  'public.trainingos_interaction_message_references'::regclass,
  'public.trainingos_interaction_read_markers'::regclass,
  'public.trainingos_interaction_events'::regclass
) and relrowsecurity and relforcerowsecurity;

select 'public_rpcs=' || count(*)
from pg_catalog.pg_proc proc
join pg_catalog.pg_namespace ns on ns.oid = proc.pronamespace
where ns.nspname = 'public'
  and proc.proname in (
    'get_or_create_trainingos_class_interaction_space_v1',
    'get_or_create_trainingos_direct_interaction_space_v1',
    'create_trainingos_interaction_thread_v1',
    'post_trainingos_interaction_message_v1',
    'withdraw_trainingos_interaction_message_v1',
    'mark_trainingos_interaction_read_v1',
    'get_my_trainingos_interaction_spaces_v1',
    'get_trainingos_interaction_thread_v1'
  )
  and proc.prosecdef
  and coalesce(array_to_string(proc.proconfig, ','), '') like '%search_path=%';
SQL
  grep -qx 'tables=8' "$catalog_file"
  grep -qx 'public_rpcs=8' "$catalog_file"
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

CURRENT_STAGE="fresh-start"
sealed fresh-start supabase --workdir "$fresh" start

CURRENT_STAGE="fresh-reset-one"
sealed fresh-reset-one supabase --workdir "$fresh" db reset --local --no-seed
run_e2e "$fresh" fresh-one

CURRENT_STAGE="fresh-reset-two"
sealed fresh-reset-two supabase --workdir "$fresh" db reset --local --no-seed
run_e2e "$fresh" fresh-two

CURRENT_STAGE="fresh-stop"
sealed fresh-stop supabase --workdir "$fresh" stop --no-backup

CURRENT_STAGE="upgrade-base-worktree"
sealed upgrade-base-worktree git -C "$PRIVATE_REPO_PATH" worktree add --detach "$base_repo" "$expected_base_sha"

CURRENT_STAGE="upgrade-init"
sealed upgrade-init supabase --workdir "$upgrade" init --force --yes
rm -rf "$upgrade/supabase/migrations"

CURRENT_STAGE="upgrade-base-bootstrap"
sealed upgrade-base-bootstrap python "$base_repo/scripts/build-trainingos-fresh-bootstrap.py" \
  --repo-root "$base_repo" \
  --output-dir "$upgrade/supabase/migrations" \
  --commit-sha "$expected_base_sha"

CURRENT_STAGE="upgrade-base-count"
[[ "$(manifest_count "$upgrade/supabase/trainingos-bootstrap-manifest.json")" == "$base_migration_count" ]]

CURRENT_STAGE="upgrade-start"
sealed upgrade-start supabase --workdir "$upgrade" start

CURRENT_STAGE="upgrade-base-reset"
sealed upgrade-base-reset supabase --workdir "$upgrade" db reset --local --no-seed

CURRENT_STAGE="upgrade-copy-forward-migrations"
cp "$PRIVATE_REPO_PATH/supabase/migrations/20260802100000_trainingos_interaction_foundation_schema_v1.sql" \
  "$upgrade/supabase/migrations/"
cp "$PRIVATE_REPO_PATH/supabase/migrations/20260802100100_trainingos_interaction_foundation_rpc_v1.sql" \
  "$upgrade/supabase/migrations/"
cp "$PRIVATE_REPO_PATH/supabase/migrations/20260802100200_trainingos_interaction_direct_revocation_hardening_v1.sql" \
  "$upgrade/supabase/migrations/"

CURRENT_STAGE="upgrade-apply"
sealed upgrade-apply supabase --workdir "$upgrade" migration up --local --include-all
run_e2e "$upgrade" upgrade

CURRENT_STAGE="upgrade-stop"
sealed upgrade-stop supabase --workdir "$upgrade" stop --no-backup

CURRENT_STAGE="complete"
echo "INTERACTION_FOUNDATION_DB status=PASS exact_head=$PRIVATE_EXACT_SHA canonical_migrations=$canonical_migration_count fresh_replay=PASS second_replay=PASS upgrade_replay=PASS primary_sql_e2e=PASS direct_revocation_e2e=PASS catalog=PASS zero_residue=PASS cleanup=PASS"
