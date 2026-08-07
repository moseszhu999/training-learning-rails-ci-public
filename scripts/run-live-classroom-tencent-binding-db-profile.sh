#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CURRENT_STAGE="inputs"
on_error(){ echo "LIVE_CLASSROOM_TENCENT_BINDING_DB status=FAIL stage=$CURRENT_STAGE"; }
trap on_error ERR

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA EXPECTED_MIGRATION_COUNT RUNNER_TEMP)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "LIVE_CLASSROOM_TENCENT_BINDING_DB status=FAIL stage=inputs"; exit 2; }
done

canonical_migration_count=369
base_migration_count=368
migration_file=20260807220000_trainingos_live_classroom_tencent_binding_v1.sql

CURRENT_STAGE="scope-contract"
scope_file="$RUNNER_TEMP/trainingos-scope-contract.env"
[[ -f "$scope_file" ]] || { echo "LIVE_CLASSROOM_TENCENT_BINDING_DB status=FAIL stage=scope-contract"; exit 2; }
read_scope(){ awk -F= -v wanted="$1" '$1 == wanted { print substr($0,index($0,"=")+1); exit }' "$scope_file"; }
expected_base_sha="$(read_scope expected_base_sha)"
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ && "$expected_base_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$EXPECTED_MIGRATION_COUNT" == "$canonical_migration_count" ]]

CURRENT_STAGE="supabase-wrapper"
bin_dir="$RUNNER_TEMP/trainingos-live-classroom-tencent-binding-bin"
mkdir -p "$bin_dir"
cat >"$bin_dir/supabase" <<'WRAPPER'
#!/usr/bin/env bash
exec npx --yes supabase@latest "$@"
WRAPPER
chmod 700 "$bin_dir/supabase"
export PATH="$bin_dir:$PATH"

fresh="$RUNNER_TEMP/trainingos-live-classroom-tencent-binding-fresh"
upgrade="$RUNNER_TEMP/trainingos-live-classroom-tencent-binding-upgrade"
base_worktree="$RUNNER_TEMP/trainingos-live-classroom-tencent-binding-base"

cleanup(){
  supabase --workdir "$fresh" stop --no-backup >/dev/null 2>&1 || true
  supabase --workdir "$upgrade" stop --no-backup >/dev/null 2>&1 || true
  git -C "$PRIVATE_REPO_PATH" worktree remove --force "$base_worktree" >/dev/null 2>&1 || true
  rm -rf "$fresh" "$upgrade" "$base_worktree" "$bin_dir"
  rm -f "$RUNNER_TEMP"/trainingos-live-classroom-tencent-binding-*.env
}
trap cleanup EXIT

sealed(){
  local label="$1"; shift
  local log="$RUNNER_TEMP/trainingos-live-classroom-tencent-binding-${label}.log"
  local code
  if "$@" >"$log" 2>&1; then
    return 0
  else
    code=$?
    echo "LIVE_CLASSROOM_TENCENT_BINDING_DB status=FAIL stage=$CURRENT_STAGE"
    return "$code"
  fi
}

manifest_count(){
  python - "$1" <<'PY'
import json, pathlib, sys
manifest=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
print(manifest.get('migrationCount', -1))
PY
}

sanitize_e2e_reason(){
  local log_file="$1" candidate=""
  candidate="$(grep -Eo 'TRAININGOS_TENCENT_BINDING_E2E_[A-Z0-9_]+:[A-Z0-9]{5}' "$log_file" | tail -n 1 || true)"
  case "$candidate" in
    TRAININGOS_TENCENT_BINDING_E2E_CONTROL_CURSOR_FAILED:*|\
    TRAININGOS_TENCENT_BINDING_E2E_ACL_FAILED:*|\
    TRAININGOS_TENCENT_BINDING_E2E_CLAIM_REPLAY_FAILED:*|\
    TRAININGOS_TENCENT_BINDING_E2E_CONCURRENT_CLAIM_FAILED:*|\
    TRAININGOS_TENCENT_BINDING_E2E_FINALIZE_FAILED:*|\
    TRAININGOS_TENCENT_BINDING_E2E_ROOM_CONFLICT_FAILED:*|\
    TRAININGOS_TENCENT_BINDING_E2E_STUDENT_READ_FAILED:*|\
    TRAININGOS_TENCENT_BINDING_E2E_TERMINAL_FAILED:*|\
    TRAININGOS_TENCENT_BINDING_E2E_FAILURE_STATE_FAILED:*|\
    TRAININGOS_TENCENT_BINDING_E2E_FAILED_RECLAIM_FAILED:*|\
    TRAININGOS_TENCENT_BINDING_E2E_UNRELATED_READ_FAILED:*)
      printf '%s' "$candidate"
      ;;
  esac
}

run_e2e(){
  local workdir="$1" label="$2" status_file db_url residue log_file reason code
  CURRENT_STAGE="${label}-status"
  status_file="$RUNNER_TEMP/trainingos-live-classroom-tencent-binding-${label}.env"
  supabase --workdir "$workdir" status -o env >"$status_file" 2>&1
  db_url="$(grep '^DB_URL=' "$status_file" | sed 's/^DB_URL=//' | tr -d '"')"
  [[ -n "$db_url" ]]

  CURRENT_STAGE="${label}-sql-e2e"
  log_file="$RUNNER_TEMP/trainingos-live-classroom-tencent-binding-${label}-sql-e2e.log"
  set +e
  psql "$db_url" -X -v ON_ERROR_STOP=1 \
    -f "$PRIVATE_REPO_PATH/tests/sql/trainingos_live_classroom_tencent_binding_v1_e2e.sql" \
    >"$log_file" 2>&1
  code=$?
  set -e
  if [[ "$code" -ne 0 ]]; then
    reason="$(sanitize_e2e_reason "$log_file")"
    if [[ -n "$reason" ]]; then
      echo "LIVE_CLASSROOM_TENCENT_BINDING_DB status=FAIL stage=${label}-sql-e2e reason=$reason"
    else
      echo "LIVE_CLASSROOM_TENCENT_BINDING_DB status=FAIL stage=${label}-sql-e2e"
    fi
    return "$code"
  fi
  grep -q '"status": "PASS"\|"status":"PASS"\|PASS' "$log_file"

  CURRENT_STAGE="${label}-zero-residue"
  residue="$(psql "$db_url" -X -At -v ON_ERROR_STOP=1 -c "select (select count(*) from public.profiles where id::text like '8b010000-%') + (select count(*) from public.trainingos_live_classroom_tencent_bindings where class_id::text like '8b100000-%')" 2>/dev/null)"
  [[ "$residue" == 0 ]]
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
CURRENT_STAGE="fresh-reset-two"
sealed fresh-reset-two supabase --workdir "$fresh" db reset --local --no-seed
run_e2e "$fresh" fresh
CURRENT_STAGE="fresh-stop"
sealed fresh-stop supabase --workdir "$fresh" stop --no-backup

rm -rf "$upgrade" "$base_worktree"
CURRENT_STAGE="upgrade-worktree"
sealed upgrade-worktree git -C "$PRIVATE_REPO_PATH" worktree add --detach "$base_worktree" "$expected_base_sha"
CURRENT_STAGE="upgrade-init"
sealed upgrade-init supabase --workdir "$upgrade" init --force --yes
rm -rf "$upgrade/supabase/migrations"
CURRENT_STAGE="upgrade-bootstrap"
sealed upgrade-bootstrap python "$base_worktree/scripts/build-trainingos-fresh-bootstrap.py" \
  --repo-root "$base_worktree" \
  --output-dir "$upgrade/supabase/migrations" \
  --commit-sha "$expected_base_sha"
CURRENT_STAGE="upgrade-migration-count"
[[ "$(manifest_count "$upgrade/supabase/trainingos-bootstrap-manifest.json")" == "$base_migration_count" ]]
CURRENT_STAGE="upgrade-start"
sealed upgrade-start supabase --workdir "$upgrade" start
CURRENT_STAGE="upgrade-base-reset"
sealed upgrade-base-reset supabase --workdir "$upgrade" db reset --local --no-seed
CURRENT_STAGE="upgrade-copy-migration"
cp "$PRIVATE_REPO_PATH/supabase/migrations/$migration_file" "$upgrade/supabase/migrations/"
CURRENT_STAGE="upgrade-apply"
sealed upgrade-apply supabase --workdir "$upgrade" migration up --local
run_e2e "$upgrade" upgrade
CURRENT_STAGE="upgrade-stop"
sealed upgrade-stop supabase --workdir "$upgrade" stop --no-backup

CURRENT_STAGE="complete"
echo "LIVE_CLASSROOM_TENCENT_BINDING_DB status=PASS canonical_migrations=$canonical_migration_count fresh=PASS second_replay=PASS upgrade=PASS sql_e2e=PASS zero_residue=PASS cleanup=PASS"
