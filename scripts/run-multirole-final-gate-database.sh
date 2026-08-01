#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CURRENT_STAGE="inputs"
on_error(){ echo "MULTIROLE_FINAL_GATE_DB status=FAIL stage=$CURRENT_STAGE"; }
trap on_error ERR

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA EXPECTED_MIGRATION_COUNT RUNNER_TEMP)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "MULTIROLE_FINAL_GATE_DB status=FAIL stage=inputs"; exit 2; }
done

canonical_migration_count=357
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$EXPECTED_MIGRATION_COUNT" == "$canonical_migration_count" ]]

CURRENT_STAGE="scope-contract"
scope_file="$RUNNER_TEMP/trainingos-scope-contract.env"
[[ -f "$scope_file" ]] || { echo "MULTIROLE_FINAL_GATE_DB status=FAIL stage=scope-contract"; exit 2; }
read_scope(){ awk -F= -v wanted="$1" '$1 == wanted { print substr($0,index($0,"=")+1); exit }' "$scope_file"; }
[[ "$(read_scope expected_changed_file_count)" == "3" ]]
[[ "$(read_scope migration_start)" == "none" ]]
[[ "$(read_scope migration_end)" == "none" ]]

CURRENT_STAGE="supabase-wrapper"
bin_dir="$RUNNER_TEMP/trainingos-multirole-final-gate-bin"
mkdir -p "$bin_dir"
cat >"$bin_dir/supabase" <<'WRAPPER'
#!/usr/bin/env bash
exec npx --yes supabase@latest "$@"
WRAPPER
chmod 700 "$bin_dir/supabase"
export PATH="$bin_dir:$PATH"

fresh="$RUNNER_TEMP/trainingos-multirole-final-gate-fresh"

cleanup(){
  supabase --workdir "$fresh" stop --no-backup >/dev/null 2>&1 || true
  rm -rf "$fresh" "$bin_dir"
  rm -f "$RUNNER_TEMP"/trainingos-multirole-final-gate-*.env
}
trap cleanup EXIT

sealed(){
  local label="$1"; shift
  "$@" >"$RUNNER_TEMP/trainingos-multirole-final-gate-${label}.log" 2>&1
}

manifest_count(){
  python - "$1" <<'PY'
import json, pathlib, sys
manifest=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
print(manifest.get('migrationCount', -1))
PY
}

run_e2e(){
  local label="$1" status_file db_url log_file residue
  CURRENT_STAGE="${label}-status"
  status_file="$RUNNER_TEMP/trainingos-multirole-final-gate-${label}.env"
  supabase --workdir "$fresh" status -o env >"$status_file" 2>&1
  db_url="$(grep '^DB_URL=' "$status_file" | sed 's/^DB_URL=//' | tr -d '"')"
  [[ -n "$db_url" ]]

  CURRENT_STAGE="${label}-sql-e2e"
  log_file="$RUNNER_TEMP/trainingos-multirole-final-gate-${label}-sql-e2e.log"
  psql "$db_url" -X -v ON_ERROR_STOP=1 \
    -f "$PRIVATE_REPO_PATH/tests/sql/trainingos_class_operations_assignment_v1_e2e.sql" \
    >"$log_file" 2>&1
  grep -q '"status": "PASS"' "$log_file"
  grep -q '"teacherAuthorityGranted": false' "$log_file"
  grep -q '"gradingAuthorityGranted": false' "$log_file"
  grep -q '"assessmentAuthorityGranted": false' "$log_file"
  grep -q '"publicationAuthorityGranted": false' "$log_file"
  grep -q '"administratorAuthorityGranted": false' "$log_file"

  CURRENT_STAGE="${label}-zero-residue"
  residue="$(psql "$db_url" -X -At -v ON_ERROR_STOP=1 -c "select concat_ws('|', (select count(*) from public.trainingos_class_operations_assignments where class_id = '9c100000-0000-4000-8000-000000000001'::uuid), (select count(*) from public.trainingos_class_operations_assignment_events where class_id = '9c100000-0000-4000-8000-000000000001'::uuid), (select count(*) from auth.users where id::text like '9c010000-%'), (select count(*) from public.profiles where id::text like '9c010000-%'));" 2>/dev/null)"
  [[ "$residue" == "0|0|0|0" ]]
}

rm -rf "$fresh"
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
run_e2e first

CURRENT_STAGE="fresh-reset-two"
sealed fresh-reset-two supabase --workdir "$fresh" db reset --local --no-seed
run_e2e second

CURRENT_STAGE="fresh-stop"
sealed fresh-stop supabase --workdir "$fresh" stop --no-backup

CURRENT_STAGE="complete"
echo "MULTIROLE_FINAL_GATE_DB status=PASS exact_head=$PRIVATE_EXACT_SHA canonical_migrations=$canonical_migration_count fresh_replay=PASS second_replay=PASS sql_e2e=PASS zero_residue=PASS cleanup=PASS"
