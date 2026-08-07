#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CURRENT_STAGE="inputs"
safe_status_file="${TRAININGOS_TENCENT_RECONCILIATION_DB_SAFE_STATUS_FILE:-}"

write_status(){
  local stage="$1" reason="${2:-}"
  [[ -n "${RUNNER_TEMP:-}" && -n "$safe_status_file" ]] || return 0
  [[ "$safe_status_file" == "$RUNNER_TEMP/"* ]] || return 0
  {
    printf 'stage=%s\n' "$stage"
    [[ -z "$reason" ]] || printf 'reason=%s\n' "$reason"
  } >"$safe_status_file"
  chmod 600 "$safe_status_file"
}

on_error(){
  write_status "$CURRENT_STAGE"
  echo "LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB status=FAIL stage=$CURRENT_STAGE"
}
trap on_error ERR

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA EXPECTED_MIGRATION_COUNT RUNNER_TEMP TRAININGOS_TENCENT_RECONCILIATION_DB_SAFE_STATUS_FILE)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || {
    write_status inputs
    echo "LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB status=FAIL stage=inputs"
    exit 2
  }
done
write_status inputs

canonical_migration_count=371
base_migration_count=370
migration_file=20260807221000_trainingos_live_classroom_tencent_reconciliation_v1.sql

CURRENT_STAGE="scope-contract"
scope_file="$RUNNER_TEMP/trainingos-scope-contract.env"
[[ -f "$scope_file" ]] || {
  write_status scope-contract
  echo "LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB status=FAIL stage=scope-contract"
  exit 2
}
read_scope(){ awk -F= -v wanted="$1" '$1 == wanted { print substr($0,index($0,"=")+1); exit }' "$scope_file"; }
expected_base_sha="$(read_scope expected_base_sha)"
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ && "$expected_base_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$EXPECTED_MIGRATION_COUNT" == "$canonical_migration_count" ]]

CURRENT_STAGE="supabase-wrapper"
bin_dir="$RUNNER_TEMP/trainingos-live-classroom-tencent-reconciliation-bin"
mkdir -p "$bin_dir"
cat >"$bin_dir/supabase" <<'WRAPPER'
#!/usr/bin/env bash
exec npx --yes supabase@latest "$@"
WRAPPER
chmod 700 "$bin_dir/supabase"
export PATH="$bin_dir:$PATH"

fresh="$RUNNER_TEMP/trainingos-live-classroom-tencent-reconciliation-fresh"
upgrade="$RUNNER_TEMP/trainingos-live-classroom-tencent-reconciliation-upgrade"
base_worktree="$RUNNER_TEMP/trainingos-live-classroom-tencent-reconciliation-base"

cleanup(){
  supabase --workdir "$fresh" stop --no-backup >/dev/null 2>&1 || true
  supabase --workdir "$upgrade" stop --no-backup >/dev/null 2>&1 || true
  git -C "$PRIVATE_REPO_PATH" worktree remove --force "$base_worktree" >/dev/null 2>&1 || true
  rm -rf "$fresh" "$upgrade" "$base_worktree" "$bin_dir"
  rm -f "$RUNNER_TEMP"/trainingos-live-classroom-tencent-reconciliation-*.env
}
trap cleanup EXIT

sealed(){
  local label="$1"; shift
  local log="$RUNNER_TEMP/trainingos-live-classroom-tencent-reconciliation-${label}.log"
  local code
  if "$@" >"$log" 2>&1; then
    return 0
  else
    code=$?
    write_status "$CURRENT_STAGE"
    echo "LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB status=FAIL stage=$CURRENT_STAGE"
    return "$code"
  fi
}

classify_start_failure(){
  local log_file="$1"
  if grep -Eqi 'failed to apply migration|migration[^[:alnum:]].*failed|error running migration|migrat(e|ing|ion).*error|sqlstate' "$log_file"; then
    printf 'migration-init'
  elif grep -Eqi 'port is already allocated|address already in use|port[^[:alnum:]].*already in use|bind[^[:alnum:]].*failed' "$log_file"; then
    printf 'port-bind'
  elif grep -Eqi 'too many requests|rate.?limit|pull rate limit|http[^[:alnum:]]*429' "$log_file"; then
    printf 'registry-rate-limit'
  elif grep -Eqi 'cannot connect to the docker|docker daemon|container runtime|pull access denied|manifest unknown|image[^[:alnum:]].*pull[^[:alnum:]].*failed' "$log_file"; then
    printf 'docker-start'
  elif grep -Eqi 'unhealthy|health.?check|not ready|timed out waiting|timeout[^[:alnum:]].*container' "$log_file"; then
    printf 'container-health'
  else
    printf 'unknown'
  fi
}

sealed_start(){
  local label="$1"; shift
  local log="$RUNNER_TEMP/trainingos-live-classroom-tencent-reconciliation-${label}.log"
  local code category safe_stage
  if "$@" >"$log" 2>&1; then
    return 0
  else
    code=$?
    category="$(classify_start_failure "$log")"
    safe_stage="$CURRENT_STAGE"
    [[ "$category" == 'unknown' ]] || safe_stage="${CURRENT_STAGE}-${category}"
    CURRENT_STAGE="$safe_stage"
    write_status "$CURRENT_STAGE"
    echo "LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB status=FAIL stage=$CURRENT_STAGE"
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
  candidate="$(grep -Eo 'TRAININGOS_TENCENT_RECONCILIATION_E2E_[A-Z0-9_]+:[A-Z0-9]{5}' "$log_file" | tail -n 1 || true)"
  case "$candidate" in
    TRAININGOS_TENCENT_RECONCILIATION_E2E_CONTROL_CURSOR_FAILED:*|\
    TRAININGOS_TENCENT_RECONCILIATION_E2E_ACL_FAILED:*|\
    TRAININGOS_TENCENT_RECONCILIATION_E2E_CLAIM_FAILED:*|\
    TRAININGOS_TENCENT_RECONCILIATION_E2E_CONTEXT_FAILED:*|\
    TRAININGOS_TENCENT_RECONCILIATION_E2E_BAD_DIGEST_FAILED:*|\
    TRAININGOS_TENCENT_RECONCILIATION_E2E_RECONCILE_FAILED:*|\
    TRAININGOS_TENCENT_RECONCILIATION_E2E_ROOM_CONFLICT_FAILED:*|\
    TRAININGOS_TENCENT_RECONCILIATION_E2E_STUDENT_READ_FAILED:*|\
    TRAININGOS_TENCENT_RECONCILIATION_E2E_FAILED_CONTEXT_FAILED:*|\
    TRAININGOS_TENCENT_RECONCILIATION_E2E_FAILED_TERMINAL_FAILED:*)
      printf '%s' "$candidate"
      ;;
  esac
}

run_e2e(){
  local workdir="$1" label="$2" status_file db_url residue log_file reason code
  CURRENT_STAGE="${label}-status"
  status_file="$RUNNER_TEMP/trainingos-live-classroom-tencent-reconciliation-${label}.env"
  supabase --workdir "$workdir" status -o env >"$status_file" 2>&1
  db_url="$(grep '^DB_URL=' "$status_file" | sed 's/^DB_URL=//' | tr -d '"')"
  [[ -n "$db_url" ]]

  CURRENT_STAGE="${label}-sql-e2e"
  log_file="$RUNNER_TEMP/trainingos-live-classroom-tencent-reconciliation-${label}-sql-e2e.log"
  set +e
  psql "$db_url" -X -v ON_ERROR_STOP=1 \
    -f "$PRIVATE_REPO_PATH/tests/sql/trainingos_live_classroom_tencent_reconciliation_v1_e2e.sql" \
    >"$log_file" 2>&1
  code=$?
  set -e
  if [[ "$code" -ne 0 ]]; then
    reason="$(sanitize_e2e_reason "$log_file")"
    write_status "${label}-sql-e2e" "$reason"
    if [[ -n "$reason" ]]; then
      echo "LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB status=FAIL stage=${label}-sql-e2e reason=$reason"
    else
      echo "LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB status=FAIL stage=${label}-sql-e2e"
    fi
    return "$code"
  fi
  grep -q '"status": "PASS"\|"status":"PASS"\|PASS' "$log_file"

  CURRENT_STAGE="${label}-zero-residue"
  residue="$(psql "$db_url" -X -At -v ON_ERROR_STOP=1 -c "select (select count(*) from public.profiles where id::text like '8c010000-%') + (select count(*) from public.trainingos_live_classroom_tencent_bindings where class_id::text like '8c100000-%')" 2>/dev/null)"
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
sealed_start fresh-start supabase --workdir "$fresh" start
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
sealed_start upgrade-start supabase --workdir "$upgrade" start
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
write_status complete
echo "LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB status=PASS canonical_migrations=$canonical_migration_count fresh=PASS second_replay=PASS upgrade=PASS sql_e2e=PASS zero_residue=PASS cleanup=PASS"
