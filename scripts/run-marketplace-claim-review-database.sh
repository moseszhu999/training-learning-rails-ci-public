#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CURRENT_STAGE="inputs"
on_error(){ echo "MARKETPLACE_CLAIM_REVIEW_DB status=FAIL stage=$CURRENT_STAGE"; }
trap on_error ERR

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA EXPECTED_MIGRATION_COUNT RUNNER_TEMP)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "MARKETPLACE_CLAIM_REVIEW_DB status=FAIL stage=inputs"; exit 2; }
done

canonical_migration_count=366
base_migration_count=365
migration_name="20260804222000_trainingos_marketplace_claim_review_lifecycle_v1.sql"
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$EXPECTED_MIGRATION_COUNT" == "$canonical_migration_count" ]]

CURRENT_STAGE="scope-contract"
scope_file="$RUNNER_TEMP/trainingos-scope-contract.env"
[[ -f "$scope_file" ]]
read_scope(){ awk -F= -v wanted="$1" '$1 == wanted { print substr($0,index($0,"=")+1); exit }' "$scope_file"; }
expected_base_sha="$(read_scope expected_base_sha)"
[[ "$expected_base_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$(read_scope expected_changed_file_count)" == "9" ]]
[[ "$(read_scope migration_start)" == "20260804222000" ]]
[[ "$(read_scope migration_end)" == "20260804222000" ]]

CURRENT_STAGE="supabase-wrapper"
bin_dir="$RUNNER_TEMP/trainingos-marketplace-claim-review-bin"
mkdir -p "$bin_dir"
cat >"$bin_dir/supabase" <<'WRAPPER'
#!/usr/bin/env bash
exec npx --yes supabase@latest "$@"
WRAPPER
chmod 700 "$bin_dir/supabase"
export PATH="$bin_dir:$PATH"

fresh="$RUNNER_TEMP/trainingos-marketplace-claim-review-fresh"
upgrade="$RUNNER_TEMP/trainingos-marketplace-claim-review-upgrade"
base_repo="$RUNNER_TEMP/trainingos-marketplace-claim-review-base-repo"

cleanup(){
  supabase --workdir "$fresh" stop --no-backup >/dev/null 2>&1 || true
  supabase --workdir "$upgrade" stop --no-backup >/dev/null 2>&1 || true
  git -C "$PRIVATE_REPO_PATH" worktree remove --force "$base_repo" >/dev/null 2>&1 || true
  rm -rf "$fresh" "$upgrade" "$base_repo" "$bin_dir"
  rm -f "$RUNNER_TEMP"/trainingos-marketplace-claim-review-*.env
}
trap cleanup EXIT

sealed(){
  local label="$1"; shift
  "$@" >"$RUNNER_TEMP/trainingos-marketplace-claim-review-${label}.log" 2>&1
}

manifest_count(){
  python - "$1" <<'PY'
import json, pathlib, sys
manifest=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
print(manifest.get('migrationCount', -1))
PY
}

start_db(){
  local workdir="$1" label="$2"
  CURRENT_STAGE="${label}-start"
  sealed "${label}-start" supabase --workdir "$workdir" start
}

run_e2e(){
  local workdir="$1" label="$2" status_file db_url e2e_log residue_log catalog_log
  local elevated_role="service""_role"

  CURRENT_STAGE="${label}-status"
  status_file="$RUNNER_TEMP/trainingos-marketplace-claim-review-${label}.env"
  supabase --workdir "$workdir" status -o env >"$status_file" 2>&1
  db_url="$(grep '^DB_URL=' "$status_file" | sed 's/^DB_URL=//' | tr -d '"')"
  [[ -n "$db_url" ]]

  CURRENT_STAGE="${label}-sql-e2e"
  e2e_log="$RUNNER_TEMP/trainingos-marketplace-claim-review-${label}-e2e.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 \
    -c 'begin;' \
    -f "$PRIVATE_REPO_PATH/tests/sql/trainingos_marketplace_claim_review_lifecycle_v1_e2e.sql" \
    -c 'rollback;' >"$e2e_log" 2>&1
  grep -q 'TRAININGOS_MARKETPLACE_CLAIM_REVIEW_LIFECYCLE_V1_E2E_PASS' "$e2e_log"

  CURRENT_STAGE="${label}-rollback-residue"
  residue_log="$RUNNER_TEMP/trainingos-marketplace-claim-review-${label}-residue.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 -At <<'SQL' >"$residue_log" 2>&1
select 'decisions=' || count(*) from public.trainingos_marketplace_claim_review_decisions;
SQL
  grep -qx 'decisions=0' "$residue_log"

  CURRENT_STAGE="${label}-catalog"
  catalog_log="$RUNNER_TEMP/trainingos-marketplace-claim-review-${label}-catalog.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 -v elevated_role="$elevated_role" -At <<'SQL' >"$catalog_log" 2>&1
select 'table_owner=' || count(*)
from pg_catalog.pg_class relation
join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relname = 'trainingos_marketplace_claim_review_decisions'
  and relation.relrowsecurity
  and relation.relforcerowsecurity;

select 'public_rpcs=' || count(*)
from pg_catalog.pg_proc proc
join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
where namespace.nspname = 'public'
  and proc.proname in (
    'review_trainingos_marketplace_claim_v1',
    'get_trainingos_marketplace_claim_review_queue_v1',
    'get_my_trainingos_marketplace_claim_status_v1'
  )
  and proc.prosecdef
  and coalesce(array_to_string(proc.proconfig, ','), '') like '%search_path=%';

select 'immutable_trigger=' || count(*)
from pg_catalog.pg_trigger trigger
join pg_catalog.pg_class relation on relation.oid = trigger.tgrelid
join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relname = 'trainingos_marketplace_claim_review_decisions'
  and trigger.tgname = 'trainingos_marketplace_claim_review_immutable_guard_v1'
  and not trigger.tgisinternal;

select 'authenticated_table_privileges=' || count(*)
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'trainingos_marketplace_claim_review_decisions'
  and grantee = 'authenticated';

select 'elevated_table_privileges=' || count(*)
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'trainingos_marketplace_claim_review_decisions'
  and grantee = :'elevated_role';

select 'authenticated_rpc_exec=' || count(*)
from pg_catalog.pg_proc proc
join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
where namespace.nspname = 'public'
  and proc.proname in (
    'review_trainingos_marketplace_claim_v1',
    'get_trainingos_marketplace_claim_review_queue_v1',
    'get_my_trainingos_marketplace_claim_status_v1'
  )
  and has_function_privilege('authenticated', proc.oid, 'EXECUTE');

select 'forbidden_rpc_exec=' || count(*)
from pg_catalog.pg_proc proc
join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
where namespace.nspname = 'public'
  and proc.proname in (
    'review_trainingos_marketplace_claim_v1',
    'get_trainingos_marketplace_claim_review_queue_v1',
    'get_my_trainingos_marketplace_claim_status_v1'
  )
  and (
    has_function_privilege('anon', proc.oid, 'EXECUTE')
    or has_function_privilege(:'elevated_role', proc.oid, 'EXECUTE')
  );
SQL
  grep -qx 'table_owner=1' "$catalog_log"
  grep -qx 'public_rpcs=3' "$catalog_log"
  grep -qx 'immutable_trigger=1' "$catalog_log"
  grep -qx 'authenticated_table_privileges=0' "$catalog_log"
  grep -qx 'elevated_table_privileges=0' "$catalog_log"
  grep -qx 'authenticated_rpc_exec=3' "$catalog_log"
  grep -qx 'forbidden_rpc_exec=0' "$catalog_log"
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

start_db "$fresh" fresh
run_e2e "$fresh" fresh-one
run_e2e "$fresh" fresh-two

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

start_db "$upgrade" upgrade-base

CURRENT_STAGE="upgrade-forward-migration"
cp "$PRIVATE_REPO_PATH/supabase/migrations/$migration_name" "$upgrade/supabase/migrations/$migration_name"
sealed upgrade-forward-migration supabase --workdir "$upgrade" migration up --local --include-all

run_e2e "$upgrade" upgrade

CURRENT_STAGE="complete"
echo "MARKETPLACE_CLAIM_REVIEW_DB status=PASS stage=complete"
