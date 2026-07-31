#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CURRENT_STAGE="inputs"
on_error(){ echo "LEARNING_CONTENT_RESOLUTION_DB status=FAIL stage=$CURRENT_STAGE"; }
trap on_error ERR

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA EXPECTED_MIGRATION_COUNT LCR_DB_PROFILE_VARIANT RUNNER_TEMP)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "LEARNING_CONTENT_RESOLUTION_DB status=FAIL stage=inputs"; exit 2; }
done

case "$LCR_DB_PROFILE_VARIANT" in
  projection-v1)
    canonical_migration_count=353
    base_migration_count=352
    migration_file=20260731100000_trainingos_learning_content_resolution_projection_v1.sql
    ;;
  history-fix)
    canonical_migration_count=354
    base_migration_count=353
    migration_file=20260731110000_trainingos_lcr_historical_rights_fix_v1.sql
    ;;
  *)
    echo "LEARNING_CONTENT_RESOLUTION_DB status=FAIL stage=inputs"
    exit 2
    ;;
esac

CURRENT_STAGE="scope-contract"
scope_file="$RUNNER_TEMP/trainingos-scope-contract.env"
[[ -f "$scope_file" ]] || { echo "LEARNING_CONTENT_RESOLUTION_DB status=FAIL stage=scope-contract"; exit 2; }
read_scope(){ awk -F= -v wanted="$1" '$1 == wanted { print substr($0,index($0,"=")+1); exit }' "$scope_file"; }
expected_base_sha="$(read_scope expected_base_sha)"
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ && "$expected_base_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$EXPECTED_MIGRATION_COUNT" == "$canonical_migration_count" ]]

CURRENT_STAGE="supabase-wrapper"
bin_dir="$RUNNER_TEMP/trainingos-learning-content-resolution-bin"
mkdir -p "$bin_dir"
cat >"$bin_dir/supabase" <<'WRAPPER'
#!/usr/bin/env bash
exec npx --yes supabase@latest "$@"
WRAPPER
chmod 700 "$bin_dir/supabase"
export PATH="$bin_dir:$PATH"

fresh="$RUNNER_TEMP/trainingos-learning-content-resolution-fresh"
upgrade="$RUNNER_TEMP/trainingos-learning-content-resolution-upgrade"
base_worktree="$RUNNER_TEMP/trainingos-learning-content-resolution-base"

cleanup(){
  supabase --workdir "$fresh" stop --no-backup >/dev/null 2>&1 || true
  supabase --workdir "$upgrade" stop --no-backup >/dev/null 2>&1 || true
  git -C "$PRIVATE_REPO_PATH" worktree remove --force "$base_worktree" >/dev/null 2>&1 || true
  rm -rf "$fresh" "$upgrade" "$base_worktree" "$bin_dir"
  rm -f "$RUNNER_TEMP"/trainingos-learning-content-resolution-*.env
}
trap cleanup EXIT

sealed(){
  local label="$1"; shift
  "$@" >"$RUNNER_TEMP/trainingos-learning-content-resolution-${label}.log" 2>&1
}

manifest_count(){
  python - "$1" <<'PY'
import json, pathlib, sys
manifest=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
print(manifest.get('migrationCount', -1))
PY
}

sanitize_e2e_reason(){
  local log_file="$1" candidate="" reason="" sqlstate=""
  candidate="$(grep -Eo 'TRAININGOS_LCR_[A-Z0-9_]+:[A-Z0-9]{5}' "$log_file" | tail -n 1 || true)"
  [[ -n "$candidate" ]] || return 0
  reason="${candidate%%:*}"
  sqlstate="${candidate##*:}"

  # Map the fixed historical-Rights E2E stage wrappers onto the existing
  # public-safe reason vocabulary. This preserves useful diagnostics without
  # exposing private SQL, fixture values, table names, or raw output.
  case "$reason" in
    TRAININGOS_LCR_E2E_PURPOSE_MISMATCH_FAILED)
      reason='TRAININGOS_LCR_PURPOSE_MISMATCH_ASSERTION_FAILED'
      ;;
    TRAININGOS_LCR_E2E_REGION_MISMATCH_FAILED)
      reason='TRAININGOS_LCR_REGION_MISMATCH_ASSERTION_FAILED'
      ;;
    TRAININGOS_LCR_E2E_AGE_BAND_MISMATCH_FAILED|\
    TRAININGOS_LCR_E2E_RIGHTS_SUSPENDED_FAILED|\
    TRAININGOS_LCR_E2E_USAGE_EXPIRED_FAILED|\
    TRAININGOS_LCR_E2E_RIGHTS_REVOKED_FAILED)
      reason='TRAININGOS_LCR_HISTORY_STATUS_ASSERTION_FAILED'
      ;;
    TRAININGOS_LCR_E2E_AGREEMENT_ENDED_FAILED)
      reason='TRAININGOS_LCR_HISTORY_ENDED_AGREEMENT_ASSERTION_FAILED'
      ;;
    TRAININGOS_LCR_E2E_NO_ACTIVE_COMMERCIAL_FAILED)
      reason='TRAININGOS_LCR_HISTORY_NO_ACTIVE_ACCOUNT_ASSERTION_FAILED'
      ;;
    TRAININGOS_LCR_E2E_REPLACEMENT_ACCOUNT_FAILED)
      reason='TRAININGOS_LCR_HISTORY_REPLACED_ACCOUNT_ASSERTION_FAILED'
      ;;
    TRAININGOS_LCR_E2E_UNRELATED_CLASS_HISTORY_FAILED)
      reason='TRAININGOS_LCR_HISTORY_CROSS_CLASS_ASSERTION_FAILED'
      ;;
    TRAININGOS_LCR_ZERO_RESIDUE_ASSERTION_FAILED)
      reason='TRAININGOS_LCR_E2E_STAGE_FAILED'
      ;;
  esac

  case "$reason" in
    TRAININGOS_LCR_CLASS_PLAN_REQUIRED|\
    TRAININGOS_LCR_ZERO_WRITE_ASSERTION_FAILED|\
    TRAININGOS_LCR_LOCAL_UNIT_ASSERTION_FAILED|\
    TRAININGOS_LCR_LOCAL_EXERCISE_ASSERTION_FAILED|\
    TRAININGOS_LCR_PARTNER_UNIT_RIGHTS_ASSERTION_FAILED|\
    TRAININGOS_LCR_PARTNER_EXERCISE_RIGHTS_ASSERTION_FAILED|\
    TRAININGOS_LCR_MISSING_PROVENANCE_ASSERTION_FAILED|\
    TRAININGOS_LCR_PURPOSE_MISMATCH_ASSERTION_FAILED|\
    TRAININGOS_LCR_REGION_MISMATCH_ASSERTION_FAILED|\
    TRAININGOS_LCR_MATERIAL_FAIL_CLOSED_ASSERTION_FAILED|\
    TRAININGOS_LCR_SECRET_DISCLOSURE_ASSERTION_FAILED|\
    TRAININGOS_LCR_REVOKED_RIGHTS_ASSERTION_FAILED|\
    TRAININGOS_LCR_STUDENT_DENIAL_ASSERTION_FAILED|\
    TRAININGOS_LCR_CROSS_CLASS_DENIAL_ASSERTION_FAILED|\
    TRAININGOS_LCR_UNRELATED_COURSE_ASSERTION_FAILED|\
    TRAININGOS_LCR_E2E_FIXTURE_USERS_FAILED|\
    TRAININGOS_LCR_E2E_FIXTURE_COURSE_FAILED|\
    TRAININGOS_LCR_E2E_FIXTURE_CONTENT_FAILED|\
    TRAININGOS_LCR_E2E_FIXTURE_MATERIAL_FAILED|\
    TRAININGOS_LCR_E2E_FIXTURE_COMMERCIAL_FAILED|\
    TRAININGOS_LCR_E2E_PARTNER_BINDING_FAILED|\
    TRAININGOS_LCR_E2E_AGREEMENT_FAILED|\
    TRAININGOS_LCR_E2E_SOURCE_FAILED|\
    TRAININGOS_LCR_E2E_REVIEW_REQUEST_FAILED|\
    TRAININGOS_LCR_E2E_REVIEW_APPROVAL_FAILED|\
    TRAININGOS_LCR_E2E_RIGHTS_FAILED|\
    TRAININGOS_LCR_E2E_USAGE_FAILED|\
    TRAININGOS_LCR_E2E_RESOLVE_FAILED|\
    TRAININGOS_LCR_E2E_CONTENT_ASSERTIONS_FAILED|\
    TRAININGOS_LCR_E2E_REVOCATION_FAILED|\
    TRAININGOS_LCR_E2E_ROLE_DENIALS_FAILED|\
    TRAININGOS_LCR_E2E_STAGE_FAILED|\
    TRAININGOS_LCR_HISTORY_ACTIVE_EXACT_RIGHTS_ASSERTION_FAILED|\
    TRAININGOS_LCR_HISTORY_ENDED_AGREEMENT_ASSERTION_FAILED|\
    TRAININGOS_LCR_HISTORY_NO_ACTIVE_ACCOUNT_ASSERTION_FAILED|\
    TRAININGOS_LCR_HISTORY_CROSS_CLASS_ASSERTION_FAILED|\
    TRAININGOS_LCR_HISTORY_OWNER_VERSION_ASSERTION_FAILED|\
    TRAININGOS_LCR_HISTORY_TERMINATED_ASSERTION_FAILED|\
    TRAININGOS_LCR_HISTORY_REPLACED_ACCOUNT_ASSERTION_FAILED|\
    TRAININGOS_LCR_HISTORY_STATUS_ASSERTION_FAILED|\
    TRAININGOS_LCR_HISTORY_SYMMETRY_ASSERTION_FAILED|\
    TRAININGOS_LCR_HISTORY_LOCAL_CONTENT_ASSERTION_FAILED)
      printf '%s:%s' "$reason" "$sqlstate"
      ;;
  esac
}

run_e2e(){
  local workdir="$1" label="$2" status_file db_url residue log_file reason code
  CURRENT_STAGE="${label}-status"
  status_file="$RUNNER_TEMP/trainingos-learning-content-resolution-${label}.env"
  supabase --workdir "$workdir" status -o env >"$status_file" 2>&1
  db_url="$(grep '^DB_URL=' "$status_file" | sed 's/^DB_URL=//' | tr -d '"')"
  [[ -n "$db_url" ]]
  CURRENT_STAGE="${label}-sql-e2e"
  log_file="$RUNNER_TEMP/trainingos-learning-content-resolution-${label}-sql-e2e.log"
  set +e
  psql "$db_url" -X -v ON_ERROR_STOP=1 \
    -f "$PRIVATE_REPO_PATH/tests/sql/trainingos_learning_content_resolution_projection_v1_e2e.sql" \
    >"$log_file" 2>&1
  code=$?
  set -e
  if [[ "$code" -ne 0 ]]; then
    reason="$(sanitize_e2e_reason "$log_file")"
    if [[ -n "$reason" ]]; then
      echo "LEARNING_CONTENT_RESOLUTION_DB status=FAIL stage=${label}-sql-e2e reason=$reason"
    fi
    return "$code"
  fi
  grep -q 'PASS' "$log_file"
  CURRENT_STAGE="${label}-zero-residue"
  residue="$(psql "$db_url" -X -At -v ON_ERROR_STOP=1 -c "select count(*) from public.profiles where id::text like '8a010000-%'" 2>/dev/null)"
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
echo "LEARNING_CONTENT_RESOLUTION_DB status=PASS variant=$LCR_DB_PROFILE_VARIANT canonical_migrations=$canonical_migration_count fresh=PASS second_replay=PASS upgrade=PASS sql_e2e=PASS zero_residue=PASS cleanup=PASS"
