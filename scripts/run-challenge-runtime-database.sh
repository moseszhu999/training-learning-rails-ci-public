#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CURRENT_STAGE="scope-file"
on_error(){ echo "CHALLENGE_DATABASE status=FAIL stage=$CURRENT_STAGE"; }
trap on_error ERR

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA EXPECTED_MIGRATION_COUNT RUNNER_TEMP)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo 'CHALLENGE_DATABASE status=FAIL stage=scope-file'; exit 2; }
done

scope_file="$RUNNER_TEMP/trainingos-scope-contract.env"
[[ -f "$scope_file" ]]
read_scope(){ awk -F= -v wanted="$1" '$1 == wanted { print substr($0,index($0,"=")+1); exit }' "$scope_file"; }

CURRENT_STAGE="scope-contract"
expected_base_sha="$(read_scope expected_base_sha)"
expected_changed_file_count="$(read_scope expected_changed_file_count)"
migration_start="$(read_scope migration_start)"
migration_end="$(read_scope migration_end)"
[[ "$(read_scope validation_profile)" == challenge-runtime ]]
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ && "$expected_base_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$expected_changed_file_count" =~ ^(0|[1-9][0-9]{0,5})$ ]]
[[ "$EXPECTED_MIGRATION_COUNT" =~ ^(0|[1-9][0-9]{0,5})$ ]]
if [[ "$migration_start" != none || "$migration_end" != none ]]; then
  [[ "$migration_start" =~ ^[0-9]{14}$ && "$migration_end" =~ ^[0-9]{14}$ ]]
fi

changed_files="$(git -C "$PRIVATE_REPO_PATH" diff --name-only "$expected_base_sha" "$PRIVATE_EXACT_SHA" | sort)"
postmerge_expected="$(printf '%s\n' \
  tests/sql/trainingos_challenge_runtime_v1_e2e_runner.sql \
  tests/test_trainingos_assessment_resume_execution_contract.py \
  tests/test_trainingos_student_exercise_execution_contract.py | sort)"
suite=''
runner_sql=''
concurrency_runner=''
CURRENT_STAGE="suite-selection"
if [[ "$changed_files" == "$postmerge_expected" ]]; then
  suite=postmerge
  runner_sql="$PRIVATE_REPO_PATH/tests/sql/trainingos_challenge_runtime_v1_e2e_runner.sql"
elif grep -q '^packages/training-challenge/src/' <<<"$changed_files"; then
  suite=canonical
  runner_sql="$PRIVATE_REPO_PATH/tests/sql/trainingos_challenge_runtime_v1_e2e_runner.sql"
elif grep -q '^packages/training-challenge-proof/' <<<"$changed_files"; then
  suite=proof
  runner_sql="$PRIVATE_REPO_PATH/tests/sql/trainingos_challenge_proof_share_v1_e2e_runner.sql"
elif grep -q '^packages/training-invite-growth/' <<<"$changed_files"; then
  suite=invite
  runner_sql="$PRIVATE_REPO_PATH/tests/sql/trainingos_invite_growth_runtime_v1_e2e_runner.sql"
  concurrency_runner="$PRIVATE_REPO_PATH/scripts/run-trainingos-invite-growth-concurrency-e2e.sh"
else
  false
fi

fresh_project="$RUNNER_TEMP/trainingos-challenge-fresh"
upgrade_project="$RUNNER_TEMP/trainingos-challenge-upgrade"
base_worktree="$RUNNER_TEMP/trainingos-challenge-base"
cleanup(){
  supabase --workdir "$fresh_project" stop --no-backup >/dev/null 2>&1 || true
  supabase --workdir "$upgrade_project" stop --no-backup >/dev/null 2>&1 || true
  git -C "$PRIVATE_REPO_PATH" worktree remove --force "$base_worktree" >/dev/null 2>&1 || true
  rm -rf "$fresh_project" "$upgrade_project" "$base_worktree"
  rm -f "$RUNNER_TEMP"/trainingos-challenge-*-status.env
  rm -f "$RUNNER_TEMP"/trainingos-challenge-*-e2e.log
  rm -f "$RUNNER_TEMP"/trainingos-challenge-*-migration.log
}
trap cleanup EXIT

CURRENT_STAGE="runner-contract"
[[ "$(git -C "$PRIVATE_REPO_PATH" rev-parse HEAD)" == "$PRIVATE_EXACT_SHA" ]]
[[ "$(git -C "$PRIVATE_REPO_PATH" merge-base "$expected_base_sha" "$PRIVATE_EXACT_SHA")" == "$expected_base_sha" ]]
actual_count="$(sed '/^$/d' <<<"$changed_files" | wc -l | tr -d ' ')"
[[ "$actual_count" == "$expected_changed_file_count" ]]
[[ -f "$runner_sql" ]]
[[ -z "$concurrency_runner" || -f "$concurrency_runner" ]]
if [[ "$suite" == invite ]]; then
  invite_e2e="$PRIVATE_REPO_PATH/tests/sql/trainingos_invite_growth_runtime_v1_e2e.sql"
  [[ -f "$invite_e2e" ]]
  grep -Fq '\ir trainingos_invite_growth_runtime_v1_e2e.sql' "$runner_sql"
  grep -Fq 'TRAININGOS_INVITE_GROWTH_FIXTURE_ROLLBACK' "$invite_e2e"
  grep -Fq 'TRAININGOS_INVITE_GROWTH_ZERO_RESIDUE_FAILED' "$invite_e2e"
else
  grep -Eiq '^[[:space:]]*rollback;' "$runner_sql"
fi
if [[ "$suite" == postmerge ]]; then
  grep -Fq '\ir trainingos_challenge_runtime_v1_e2e.sql' "$runner_sql"
fi

CURRENT_STAGE="migration-contract"
mapfile -t migrations < <(
  grep -E '^supabase/migrations/[0-9]{14}_[^/]*(challenge|invite|growth|attribution|proof|sharing)[^/]*\.sql$' <<<"$changed_files" | sort || true
)
if [[ "$suite" == postmerge ]]; then
  [[ "${#migrations[@]}" == 0 ]]
  [[ "$migration_start" == none && "$migration_end" == none ]]
else
  [[ "${#migrations[@]}" -gt 0 ]]
  [[ "$migration_start" =~ ^[0-9]{14}$ && "$migration_end" =~ ^[0-9]{14}$ ]]
  for migration in "${migrations[@]}"; do
    stamp="$(basename "$migration" | cut -c1-14)"
    [[ "$stamp" -ge "$migration_start" && "$stamp" -le "$migration_end" ]]
  done
fi
source_migration_count="$(find "$PRIVATE_REPO_PATH/supabase/migrations" -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
if [[ "$EXPECTED_MIGRATION_COUNT" != 0 ]]; then
  [[ "$EXPECTED_MIGRATION_COUNT" == "$source_migration_count" ]]
fi

sanitize_database_detail(){
  local sealed_log="$1"
  python - "$sealed_log" <<'PY'
import pathlib
import re
import sys

text = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8', errors='replace')
known = (
    ('TRAININGOS_CHALLENGE_PROOF_E2E_ASSERTION_FAILED', 'proof-assertion'),
    ('TRAININGOS_CHALLENGE_PROOF_E2E_EVIDENCE_MISSING', 'proof-evidence'),
    ('TRAININGOS_CHALLENGE_PROOF_E2E_RESIDUE', 'proof-residue'),
    ('TRAININGOS_CHALLENGE_PROOF_CLEANUP_RESIDUE', 'proof-cleanup'),
    ('TRAININGOS_CHALLENGE_PROOF_CANONICAL_ATTEMPT_NOT_FOUND', 'proof-attempt-missing'),
    ('TRAININGOS_CHALLENGE_PROOF_CANONICAL_COMPLETION_REQUIRED', 'proof-completion-required'),
    ('TRAININGOS_CHALLENGE_PROOF_INTERNAL_SOURCE_REQUIRED', 'proof-internal-source'),
    ('TRAININGOS_CHALLENGE_PROOF_LEARNER_OWNERSHIP_REQUIRED', 'proof-ownership'),
    ('TRAININGOS_CHALLENGE_PROOF_HUMAN_REQUIRED', 'proof-human-required'),
    ('TRAININGOS_CHALLENGE_PROOF_PROFILE_REQUIRED', 'proof-profile-required'),
    ('TRAININGOS_CHALLENGE_PROOF_SOURCE_NOT_FOUND', 'proof-source-missing'),
    ('TRAININGOS_CHALLENGE_PROOF_SOURCE_STALE', 'proof-source-stale'),
    ('TRAININGOS_CHALLENGE_PROOF_IDEMPOTENCY_CONFLICT', 'proof-idempotency'),
    ('TRAININGOS_CHALLENGE_PROOF_EXPECTED_ROLLBACK', 'proof-rollback-marker'),
    ('TRAININGOS_CHALLENGE_E2E_ASSERTION_FAILED', 'canonical-assertion'),
    ('TRAININGOS_INVITE_GROWTH_E2E_ASSERTION_FAILED', 'invite-assertion'),
)
for marker, label in known:
    if marker in text:
        print(label)
        raise SystemExit(0)

state_patterns = (
    r'(?m)^(?:psql:[^\n]*:\s*)?ERROR:\s+([0-9A-Z]{5}):',
    r'(?i)SQLSTATE(?:\s*[:=]|\s+)\s*([0-9A-Z]{5})',
    r'(?i)\(SQLSTATE\s+([0-9A-Z]{5})\)',
)
for pattern in state_patterns:
    match = re.search(pattern, text)
    if match:
        print(f"sqlstate-{match.group(1).lower()}")
        raise SystemExit(0)

patterns = (
    (r'permission denied|insufficient privilege', 'permission-denied'),
    (r'role [^\n]+ does not exist', 'role-missing'),
    (r'null value in column', 'not-null'),
    (r'violates check constraint', 'check-constraint'),
    (r'violates foreign key constraint', 'foreign-key'),
    (r'duplicate key value violates unique constraint', 'unique-constraint'),
    (r'column reference [^\n]+ is ambiguous|ambiguous column', 'ambiguous-column'),
    (r'column [^\n]+ does not exist|record [^\n]+ has no field', 'undefined-column'),
    (r'relation [^\n]+ does not exist|undefined table', 'undefined-relation'),
    (r'function [^\n]+ does not exist', 'undefined-function'),
    (r'invalid input syntax for type uuid', 'invalid-uuid'),
    (r'invalid input syntax for type json', 'invalid-json'),
    (r'current transaction is aborted', 'transaction-aborted'),
)
for pattern, label in patterns:
    if re.search(pattern, text, flags=re.IGNORECASE):
        print(label)
        raise SystemExit(0)
print('unknown')
PY
}

run_e2e(){
  local url="$1"
  local e2e_log="$RUNNER_TEMP/trainingos-challenge-${CURRENT_STAGE}-e2e.log"
  : >"$e2e_log"
  chmod 600 "$e2e_log"
  if ! psql "$url" -X -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -f "$runner_sql" >"$e2e_log" 2>&1; then
    local detail
    detail="$(sanitize_database_detail "$e2e_log")"
    echo "CHALLENGE_DATABASE status=FAIL stage=$CURRENT_STAGE detail=$detail"
    return 1
  fi
  if [[ -n "$concurrency_runner" ]]; then
    if ! DATABASE_URL="$url" RUNNER_TEMP="$RUNNER_TEMP" bash "$concurrency_runner" >>"$e2e_log" 2>&1; then
      echo "CHALLENGE_DATABASE status=FAIL stage=$CURRENT_STAGE detail=concurrency"
      return 1
    fi
  fi
}

CURRENT_STAGE="fresh-init"
rm -rf "$fresh_project"
supabase --workdir "$fresh_project" init --force --yes
rm -rf "$fresh_project/supabase/migrations"

CURRENT_STAGE="fresh-bootstrap"
python "$PRIVATE_REPO_PATH/scripts/build-trainingos-fresh-bootstrap.py" \
  --repo-root "$PRIVATE_REPO_PATH" \
  --output-dir "$fresh_project/supabase/migrations" \
  --commit-sha "$PRIVATE_EXACT_SHA"

CURRENT_STAGE="fresh-manifest"
generated_migration_count="$(find "$fresh_project/supabase/migrations" -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
[[ "$generated_migration_count" =~ ^[1-9][0-9]*$ ]]
python - "$fresh_project/supabase/trainingos-bootstrap-manifest.json" "$generated_migration_count" <<'PY'
import json,pathlib,sys
manifest=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
raise SystemExit(0 if int(manifest.get('migrationCount',-1))==int(sys.argv[2]) else 1)
PY

CURRENT_STAGE="fresh-start"
supabase --workdir "$fresh_project" start
CURRENT_STAGE="fresh-reset-one"
supabase --workdir "$fresh_project" db reset --local --no-seed
CURRENT_STAGE="fresh-reset-two"
supabase --workdir "$fresh_project" db reset --local --no-seed
CURRENT_STAGE="fresh-status"
fresh_status="$RUNNER_TEMP/trainingos-challenge-fresh-status.env"
supabase --workdir "$fresh_project" status -o env >"$fresh_status"
fresh_db_url="$(grep '^DB_URL=' "$fresh_status" | sed 's/^DB_URL=//' | tr -d '"')"
[[ -n "$fresh_db_url" ]]
CURRENT_STAGE="fresh-e2e"
run_e2e "$fresh_db_url"
CURRENT_STAGE="fresh-stop"
supabase --workdir "$fresh_project" stop --no-backup

upgrade_result=NOT_APPLICABLE
if [[ "$suite" != postmerge ]]; then
  CURRENT_STAGE="upgrade-worktree"
  rm -rf "$upgrade_project" "$base_worktree"
  git -C "$PRIVATE_REPO_PATH" worktree add --detach "$base_worktree" "$expected_base_sha"
  CURRENT_STAGE="upgrade-init"
  supabase --workdir "$upgrade_project" init --force --yes
  rm -rf "$upgrade_project/supabase/migrations"
  CURRENT_STAGE="upgrade-bootstrap"
  python "$base_worktree/scripts/build-trainingos-fresh-bootstrap.py" \
    --repo-root "$base_worktree" \
    --output-dir "$upgrade_project/supabase/migrations" \
    --commit-sha "$expected_base_sha"
  CURRENT_STAGE="upgrade-start"
  supabase --workdir "$upgrade_project" start
  CURRENT_STAGE="upgrade-migrations"
  for migration in "${migrations[@]}"; do
    cp "$PRIVATE_REPO_PATH/$migration" "$upgrade_project/supabase/migrations/"
  done
  upgrade_migration_log="$RUNNER_TEMP/trainingos-challenge-upgrade-migrations-migration.log"
  : >"$upgrade_migration_log"
  chmod 600 "$upgrade_migration_log"
  if ! supabase --workdir "$upgrade_project" migration up --local >"$upgrade_migration_log" 2>&1; then
    detail="$(sanitize_database_detail "$upgrade_migration_log")"
    echo "CHALLENGE_DATABASE status=FAIL stage=$CURRENT_STAGE detail=$detail"
    false
  fi
  CURRENT_STAGE="upgrade-status"
  upgrade_status="$RUNNER_TEMP/trainingos-challenge-upgrade-status.env"
  supabase --workdir "$upgrade_project" status -o env >"$upgrade_status"
  upgrade_db_url="$(grep '^DB_URL=' "$upgrade_status" | sed 's/^DB_URL=//' | tr -d '"')"
  [[ -n "$upgrade_db_url" ]]
  CURRENT_STAGE="upgrade-e2e"
  run_e2e "$upgrade_db_url"
  CURRENT_STAGE="upgrade-stop"
  supabase --workdir "$upgrade_project" stop --no-backup
  upgrade_result=PASS
fi

CURRENT_STAGE="complete"
echo "CHALLENGE_DATABASE status=PASS suite=$suite changed_migrations=${#migrations[@]} source=$source_migration_count generated=$generated_migration_count fresh=PASS second_pass=PASS upgrade=$upgrade_result e2e=PASS cleanup=PASS"
