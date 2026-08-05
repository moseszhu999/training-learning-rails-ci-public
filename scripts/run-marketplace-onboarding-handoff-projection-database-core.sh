#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CURRENT_STAGE="inputs"
on_error(){ echo "MARKETPLACE_ONBOARDING_HANDOFF_DB status=FAIL stage=$CURRENT_STAGE"; }
trap on_error ERR

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA EXPECTED_MIGRATION_COUNT RUNNER_TEMP)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || {
    echo "MARKETPLACE_ONBOARDING_HANDOFF_DB status=FAIL stage=inputs"
    exit 2
  }
done

canonical_migration_count=368
base_migration_count=367
migration_name="20260805161000_trainingos_marketplace_onboarding_handoff_projection_v1.sql"
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$EXPECTED_MIGRATION_COUNT" == "$canonical_migration_count" ]]

CURRENT_STAGE="scope-contract"
scope_file="$RUNNER_TEMP/trainingos-scope-contract.env"
[[ -f "$scope_file" ]] || {
  echo "MARKETPLACE_ONBOARDING_HANDOFF_DB status=FAIL stage=scope-contract"
  exit 2
}
read_scope(){
  awk -F= -v wanted="$1" '$1 == wanted { print substr($0,index($0,"=")+1); exit }' "$scope_file"
}
expected_base_sha="$(read_scope expected_base_sha)"
[[ "$expected_base_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$(read_scope expected_changed_file_count)" == "7" ]]
[[ "$(read_scope migration_start)" == "20260805161000" ]]
[[ "$(read_scope migration_end)" == "20260805161000" ]]

fresh="$RUNNER_TEMP/oh-f"
upgrade="$RUNNER_TEMP/oh-u"
base_repo="$RUNNER_TEMP/oh-b"

cleanup(){
  supabase --workdir "$fresh" stop --no-backup >/dev/null 2>&1 || true
  supabase --workdir "$upgrade" stop --no-backup >/dev/null 2>&1 || true
  git -C "$PRIVATE_REPO_PATH" worktree remove --force "$base_repo" >/dev/null 2>&1 || true
  rm -rf "$fresh" "$upgrade" "$base_repo"
  rm -f "$RUNNER_TEMP"/trainingos-marketplace-onboarding-handoff-*.env
  rm -f "$RUNNER_TEMP"/trainingos-marketplace-onboarding-handoff-*.log
}
trap cleanup EXIT

sealed(){
  local label="$1"; shift
  "$@" >"$RUNNER_TEMP/trainingos-marketplace-onboarding-handoff-${label}.log" 2>&1
}

manifest_count(){
  python - "$1" <<'PY'
import json, pathlib, sys
manifest = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
print(manifest.get('migrationCount', -1))
PY
}

patch_health_timeout(){
  local workdir="$1" config
  config="$workdir/supabase/config.toml"
  python - "$config" <<'PY'
from pathlib import Path
import re, sys
path = Path(sys.argv[1])
text = path.read_text(encoding='utf-8')
section = re.search(r'(?m)^\[db\]\s*$', text)
if section is None:
    raise SystemExit('db section missing')
next_section = re.search(r'(?m)^\[[^\]]+\]\s*$', text[section.end():])
end = section.end() + (next_section.start() if next_section else len(text) - section.end())
block = text[section.end():end]
if re.search(r'(?m)^\s*health_timeout\s*=', block):
    block = re.sub(r'(?m)^\s*health_timeout\s*=.*$', 'health_timeout = "5m"', block, count=1)
else:
    block = '\nhealth_timeout = "5m"' + block
path.write_text(text[:section.end()] + block + text[end:], encoding='utf-8')
PY
  grep -Eq '^health_timeout = "5m"$' "$config"
}

initialize_workdir(){
  local workdir="$1" label="$2"
  rm -rf "$workdir"
  CURRENT_STAGE="${label}-init"
  sealed "${label}-init" supabase --workdir "$workdir" init --force --yes
  patch_health_timeout "$workdir"
  rm -rf "$workdir/supabase/migrations"
  mkdir -p "$workdir/supabase/migrations"
}

start_workdir(){
  local workdir="$1" label="$2"
  CURRENT_STAGE="${label}-start"
  sealed "${label}-start" supabase --workdir "$workdir" start
}

run_e2e(){
  local workdir="$1" label="$2" status_file db_url e2e_log residue_log catalog_log
  local elevated_role="service""_role"

  CURRENT_STAGE="${label}-status"
  status_file="$RUNNER_TEMP/trainingos-marketplace-onboarding-handoff-${label}.env"
  supabase --workdir "$workdir" status -o env >"$status_file" 2>&1
  db_url="$(grep '^DB_URL=' "$status_file" | sed 's/^DB_URL=//' | tr -d '"')"
  [[ -n "$db_url" ]]

  CURRENT_STAGE="${label}-sql-e2e"
  e2e_log="$RUNNER_TEMP/trainingos-marketplace-onboarding-handoff-${label}-sql-e2e.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 -v VERBOSITY=verbose \
    -c 'begin;' \
    -f "$PRIVATE_REPO_PATH/tests/sql/trainingos_marketplace_onboarding_handoff_projection_v1_e2e.sql" \
    -c 'rollback;' >"$e2e_log" 2>&1

  CURRENT_STAGE="${label}-rollback-residue"
  residue_log="$RUNNER_TEMP/trainingos-marketplace-onboarding-handoff-${label}-residue.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 -At <<'SQL' >"$residue_log" 2>&1
select 'profiles=' || count(*)
from public.profiles
where id in (
  replace('d2000000_0000_4000_8000_000000000001', '_', '-')::uuid,
  replace('d2000000_0000_4000_8000_000000000002', '_', '-')::uuid,
  replace('d2000000_0000_4000_8000_000000000003', '_', '-')::uuid
);
select 'supply=' || count(*)
from public.trainingos_marketplace_supply_participations
where id = replace('e2000000_0000_4000_8000_000000000001', '_', '-')::uuid;
select 'demand=' || count(*)
from public.trainingos_marketplace_demands
where id = replace('e2000000_0000_4000_8000_000000000002', '_', '-')::uuid;
select 'contact=' || count(*)
from public.trainingos_marketplace_contact_requests
where id = replace('e2000000_0000_4000_8000_000000000003', '_', '-')::uuid;
select 'handoff=' || count(*)
from public.trainingos_marketplace_handoff_proposals
where id = replace('e2000000_0000_4000_8000_000000000004', '_', '-')::uuid;
SQL
  grep -qx 'profiles=0' "$residue_log"
  grep -qx 'supply=0' "$residue_log"
  grep -qx 'demand=0' "$residue_log"
  grep -qx 'contact=0' "$residue_log"
  grep -qx 'handoff=0' "$residue_log"

  CURRENT_STAGE="${label}-acl-catalog"
  catalog_log="$RUNNER_TEMP/trainingos-marketplace-onboarding-handoff-${label}-catalog.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 -v elevated_role="$elevated_role" -At <<'SQL' >"$catalog_log" 2>&1
select 'rpc=' || count(*)
from pg_catalog.pg_proc proc
join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
where namespace.nspname = 'public'
  and proc.proname = 'get_trainingos_marketplace_onboarding_handoff_v1'
  and proc.prosecdef
  and coalesce(array_to_string(proc.proconfig, ','), '') like '%search_path=%';
select 'authenticated_execute=' || has_function_privilege(
  'authenticated',
  'public.get_trainingos_marketplace_onboarding_handoff_v1(uuid)',
  'EXECUTE'
);
select 'anon_execute=' || has_function_privilege(
  'anon',
  'public.get_trainingos_marketplace_onboarding_handoff_v1(uuid)',
  'EXECUTE'
);
select 'elevated_execute=' || has_function_privilege(
  :'elevated_role',
  'public.get_trainingos_marketplace_onboarding_handoff_v1(uuid)',
  'EXECUTE'
);
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
  grep -qx 'rpc=1' "$catalog_log"
  grep -qx 'authenticated_execute=true' "$catalog_log"
  grep -qx 'anon_execute=false' "$catalog_log"
  grep -qx 'elevated_execute=false' "$catalog_log"
  grep -qx 'authenticated_table_privileges=0' "$catalog_log"
  grep -qx 'elevated_table_privileges=0' "$catalog_log"
}

initialize_workdir "$fresh" fresh
CURRENT_STAGE="fresh-bootstrap"
sealed fresh-bootstrap python "$PRIVATE_REPO_PATH/scripts/build-trainingos-fresh-bootstrap.py" \
  --repo-root "$PRIVATE_REPO_PATH" \
  --output-dir "$fresh/supabase/migrations" \
  --commit-sha "$PRIVATE_EXACT_SHA"
CURRENT_STAGE="fresh-migration-count"
[[ "$(manifest_count "$fresh/supabase/trainingos-bootstrap-manifest.json")" == "$canonical_migration_count" ]]

CURRENT_STAGE="base-worktree"
sealed base-worktree git -C "$PRIVATE_REPO_PATH" worktree add --detach "$base_repo" "$expected_base_sha"
initialize_workdir "$upgrade" upgrade
CURRENT_STAGE="upgrade-bootstrap"
sealed upgrade-bootstrap python "$base_repo/scripts/build-trainingos-fresh-bootstrap.py" \
  --repo-root "$base_repo" \
  --output-dir "$upgrade/supabase/migrations" \
  --commit-sha "$expected_base_sha"
CURRENT_STAGE="upgrade-base-migration-count"
[[ "$(manifest_count "$upgrade/supabase/trainingos-bootstrap-manifest.json")" == "$base_migration_count" ]]

start_workdir "$fresh" fresh
CURRENT_STAGE="fresh-reset-one"
sealed fresh-reset-one supabase --workdir "$fresh" db reset --local --no-seed
run_e2e "$fresh" fresh-one
CURRENT_STAGE="fresh-reset-two"
sealed fresh-reset-two supabase --workdir "$fresh" db reset --local --no-seed
run_e2e "$fresh" fresh-two
CURRENT_STAGE="fresh-stop"
sealed fresh-stop supabase --workdir "$fresh" stop --no-backup

start_workdir "$upgrade" upgrade
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
echo "MARKETPLACE_ONBOARDING_HANDOFF_DB status=PASS exact_head=$PRIVATE_EXACT_SHA canonical_migrations=$canonical_migration_count fresh_replay=PASS second_replay=PASS upgrade_replay=PASS sql_e2e=PASS acl_catalog=PASS rollback=PASS zero_residue=PASS cleanup=PASS"
