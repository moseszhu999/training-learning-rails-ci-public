#!/usr/bin/env bash
set -u

PRIVATE_REPO_PATH="${1:?private repository path required}"
STATUS_DIR="$RUNNER_TEMP/pr339-status"
mkdir -p "$STATUS_DIR"
FAILURES=0

record() {
  local name="$1"
  local value="$2"
  printf '%s\n' "$value" > "$STATUS_DIR/$name"
  printf 'PR339_GATE %s=%s\n' "$name" "$value"
  if [[ "$value" != PASS* ]]; then
    FAILURES=$((FAILURES + 1))
  fi
}

read_status() {
  local name="$1"
  if [[ -f "$STATUS_DIR/$name" ]]; then
    cat "$STATUS_DIR/$name"
  else
    printf 'NOT_RUN'
  fi
}

cd "$PRIVATE_REPO_PATH" || exit 1

if [[ "$(git rev-parse HEAD 2>/dev/null)" == "$PRIVATE_SHA" ]] \
  && git cat-file -e "$BASE_SHA^{commit}" 2>/dev/null \
  && [[ "$(git merge-base "$BASE_SHA" "$PRIVATE_SHA" 2>/dev/null)" == "$BASE_SHA" ]] \
  && [[ "$(git rev-list --count "$PRIVATE_SHA..$BASE_SHA" 2>/dev/null)" == "0" ]] \
  && [[ -z "$(git status --porcelain)" ]]; then
  record exact "PASS"
else
  record exact "FAIL"
fi

set +e
node --test \
  prototypes/trainingos-agent-mvp-v1/student-exercise-execution.test.mjs \
  prototypes/trainingos-agent-mvp-v1/student-assessment-resume.test.mjs \
  prototypes/trainingos-agent-mvp-v1/student-learning-canonical-reconciliation.test.mjs \
  > "$RUNNER_TEMP/pr339-node.log" 2>&1
node_code=$?
node_count="$(grep -E '^# tests [0-9]+' "$RUNNER_TEMP/pr339-node.log" | tail -1 | awk '{print $3}')"
if [[ "$node_code" == 0 && "${node_count:-0}" -gt 0 ]]; then
  record node "PASS ${node_count}/${node_count}"
else
  record node "FAIL ${node_count:-0}"
fi

: > "$RUNNER_TEMP/pr339-python.log"
python_code=0
for test_file in \
  tests/test_trainingos_student_exercise_execution_contract.py \
  tests/test_trainingos_assessment_resume_execution_contract.py \
  tests/test_trainingos_learning_workspace_assessment_contract.py
do
  python "$test_file" >> "$RUNNER_TEMP/pr339-python.log" 2>&1 || python_code=1
done
python_count="$(grep -Eo 'Ran [0-9]+ tests?' "$RUNNER_TEMP/pr339-python.log" | awk '{sum+=$2} END {print sum+0}')"
if [[ "$python_code" == 0 && "$python_count" -gt 0 ]]; then
  record python "PASS ${python_count}/${python_count}"
else
  record python "FAIL ${python_count}"
fi

npm ci > "$RUNNER_TEMP/pr339-npm-ci.log" 2>&1
if [[ $? == 0 ]]; then record install "PASS"; else record install "FAIL"; fi

npm run typecheck > "$RUNNER_TEMP/pr339-typecheck.log" 2>&1
if [[ $? == 0 ]]; then record typecheck "PASS"; else record typecheck "FAIL"; fi

node extensions/trainingos-classroom-vscode/esbuild.mjs --production > "$RUNNER_TEMP/pr339-vscode.log" 2>&1
if [[ $? == 0 ]]; then record vscode "PASS"; else record vscode "FAIL"; fi

npm run validate:learning-workspace-bridge > "$RUNNER_TEMP/pr339-workspace.log" 2>&1
if [[ $? == 0 ]]; then record workspace "PASS"; else record workspace "FAIL"; fi

npm run validate:zero-permission-bridge > "$RUNNER_TEMP/pr339-zero-permission.log" 2>&1
if [[ $? == 0 ]]; then record zero_permission "PASS"; else record zero_permission "FAIL"; fi

npm run build > "$RUNNER_TEMP/pr339-build.log" 2>&1
if [[ $? == 0 ]]; then record build "PASS"; else record build "FAIL"; fi

python - <<'PY' > "$RUNNER_TEMP/pr339-review.log" 2>&1
from pathlib import Path
root = Path('.')
migration = (root / 'supabase/migrations/20260728100300_trainingos_student_learning_execution_canonical_reconciliation_v1.sql').read_text(encoding='utf-8')
exercise = (root / 'lib/trainingos-agent-gateway/student-exercise-execution.mjs').read_text(encoding='utf-8')
assessment = (root / 'lib/trainingos-agent-gateway/student-assessment-resume.mjs').read_text(encoding='utf-8')
web = (root / 'apps/training-web/src/lib/trainingos-assessment-runtime.ts').read_text(encoding='utf-8')
used = {path.name for path in (root / 'supabase/migrations').glob('2026072810*.sql')}
allowed = {
    '20260728100000_trainingos_student_exercise_execution_v1.sql',
    '20260728100100_trainingos_assessment_answer_resume_projection_v1.sql',
    '20260728100200_trainingos_student_exercise_start_concurrency_v1.sql',
    '20260728100300_trainingos_student_learning_execution_canonical_reconciliation_v1.sql',
}
gates = {
    'reserved_migrations_only': used == allowed,
    'no_second_fact_table': 'create table' not in migration.lower(),
    'canonical_owners': all(token in migration for token in (
        'trainingos_assessment_attempts', 'trainingos_assessment_answers',
        'trainingos_assessment_results', 'trainingos_assessment_result_items',
        'exercise_submissions')),
    'exact_attempt_version': 'p_expected_attempt_version integer' in migration,
    'exact_previous_answer_version': 'p_expected_previous_answer_version integer' in migration,
    'answer_set_digest': 'answer_set_digest' in migration,
    'answer_idempotency_conflict': 'TRAININGOS_ASSESSMENT_ANSWER_IDEMPOTENCY_CONFLICT' in migration,
    'submission_idempotency_conflict': 'TRAININGOS_ASSESSMENT_SUBMISSION_IDEMPOTENCY_CONFLICT' in migration,
    'formal_freeze': 'is_submitted_version = true' in migration,
    'current_result': "r.status in ('finalized','corrected')" in migration,
    'weak_save_revoked': 'save_trainingos_assessment_answer(uuid,uuid,integer,jsonb)' in migration,
    'weak_submit_revoked': 'submit_trainingos_assessment_attempt(uuid,integer,jsonb)' in migration,
    'old_exercise_confirm_revoked': 'confirm_my_trainingos_exercise_submission(uuid,bigint,text,boolean,text)' in migration,
    'exercise_human_gateway': "p_actor_kind: actor.actorKind" in exercise,
    'assessment_agent_denial': 'TRAININGOS_ASSESSMENT_AGENT_CONFIRMATION_FORBIDDEN' in assessment,
    'web_prepare_confirm': all(token in web for token in (
        'prepare_trainingos_assessment_submission',
        'confirm_trainingos_assessment_submission')),
    'no_service_role_client': 'service_role' not in (exercise + assessment).lower(),
    'transaction_e2e': all((root / name).is_file() for name in (
        'tests/sql/trainingos_student_exercise_canonical_reconciliation_e2e.sql',
        'tests/sql/trainingos_student_learning_canonical_reconciliation_e2e.sql')),
}
failed = [name for name, passed in gates.items() if not passed]
print(f'gates={len(gates)} passed={len(gates)-len(failed)} failed={len(failed)}')
raise SystemExit(1 if failed else 0)
PY
review_code=$?
review_count="$(grep -Eo 'gates=[0-9]+' "$RUNNER_TEMP/pr339-review.log" | cut -d= -f2)"
if [[ "$review_code" == 0 ]]; then
  record review "PASS ${review_count}/${review_count}"
else
  record review "FAIL ${review_count:-0}"
fi

supabase start > "$RUNNER_TEMP/pr339-db-first.log" 2>&1
db_first_code=$?
db_first_count="$(grep -c 'Applying migration ' "$RUNNER_TEMP/pr339-db-first.log" || true)"
db_first_last="$(grep 'Applying migration ' "$RUNNER_TEMP/pr339-db-first.log" | tail -1 | sed 's/.*Applying migration //' || true)"
if [[ "$db_first_code" == 0 ]]; then
  record db_first "PASS ${db_first_count} last=${db_first_last:-none}"
else
  record db_first "FAIL ${db_first_count} last=${db_first_last:-none}"
fi

supabase db reset --local > "$RUNNER_TEMP/pr339-db-second.log" 2>&1
db_second_code=$?
db_second_count="$(grep -c 'Applying migration ' "$RUNNER_TEMP/pr339-db-second.log" || true)"
db_second_last="$(grep 'Applying migration ' "$RUNNER_TEMP/pr339-db-second.log" | tail -1 | sed 's/.*Applying migration //' || true)"
if [[ "$db_second_code" == 0 ]]; then
  record db_second "PASS ${db_second_count} last=${db_second_last:-none}"
else
  record db_second "FAIL ${db_second_count} last=${db_second_last:-none}"
fi

eval "$(supabase status -o env 2>/dev/null | grep '^DB_URL=')"
if [[ -n "${DB_URL:-}" ]]; then
  acl_result="$(psql "$DB_URL" -X -Atv ON_ERROR_STOP=1 <<'SQL' 2> "$RUNNER_TEMP/pr339-db-acl.log"
select jsonb_build_object(
  'duplicateTables',(
    select count(*) from information_schema.tables
    where table_schema='public' and table_name in (
      'student_exercise_submissions','student_exercise_answers',
      'student_assessment_attempts','student_assessment_answers',
      'assessment_resume_answers','assessment_execution_state'
    )
  ),
  'assessmentDirectPrivileges',(
    select count(*) from information_schema.role_table_grants
    where grantee='authenticated' and table_schema='public'
      and table_name in ('trainingos_assessment_attempts','trainingos_assessment_answers')
      and privilege_type in ('INSERT','UPDATE','DELETE')
  ),
  'oldAssessmentSave',case
    when to_regprocedure('public.save_trainingos_assessment_answer(uuid,uuid,integer,jsonb)') is null then false
    else has_function_privilege('authenticated','public.save_trainingos_assessment_answer(uuid,uuid,integer,jsonb)','execute')
  end,
  'oldAssessmentSubmit',case
    when to_regprocedure('public.submit_trainingos_assessment_attempt(uuid,integer,jsonb)') is null then false
    else has_function_privilege('authenticated','public.submit_trainingos_assessment_attempt(uuid,integer,jsonb)','execute')
  end,
  'newAssessmentSave',has_function_privilege(
    'authenticated','public.save_trainingos_assessment_answer(uuid,uuid,integer,integer,jsonb,text)','execute'
  ),
  'newAssessmentConfirm',has_function_privilege(
    'authenticated','public.confirm_trainingos_assessment_submission(uuid,integer,text,text)','execute'
  ),
  'oldExerciseConfirm',case
    when to_regprocedure('public.confirm_my_trainingos_exercise_submission(uuid,bigint,text,boolean,text)') is null then false
    else has_function_privilege('authenticated','public.confirm_my_trainingos_exercise_submission(uuid,bigint,text,boolean,text)','execute')
  end,
  'newExerciseConfirm',has_function_privilege(
    'authenticated','public.confirm_my_trainingos_exercise_submission(uuid,bigint,text,text,text)','execute'
  )
);
SQL
)"
  acl_psql_code=$?
else
  acl_result=''
  acl_psql_code=1
fi
if [[ "$acl_psql_code" == 0 ]]; then
  python - "$acl_result" > "$RUNNER_TEMP/pr339-db-acl-parse.log" 2>&1 <<'PY'
import json, sys
data = json.loads(sys.argv[1])
passed = (
    data.get('duplicateTables') == 0
    and data.get('assessmentDirectPrivileges') == 0
    and data.get('oldAssessmentSave') is False
    and data.get('oldAssessmentSubmit') is False
    and data.get('newAssessmentSave') is True
    and data.get('newAssessmentConfirm') is True
    and data.get('oldExerciseConfirm') is False
    and data.get('newExerciseConfirm') is True
)
raise SystemExit(0 if passed else 1)
PY
  if [[ $? == 0 ]]; then record db_acl "PASS 8/8"; else record db_acl "FAIL"; fi
else
  record db_acl "FAIL"
fi

run_sql_e2e() {
  local status_name="$1"
  local sql_file="$2"
  local pass_label="$3"
  if [[ -z "${DB_URL:-}" ]]; then
    record "$status_name" "FAIL"
    return
  fi
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 -f "$sql_file" \
    > "$RUNNER_TEMP/pr339-${status_name}.log" 2>&1
  if [[ $? == 0 ]]; then
    record "$status_name" "PASS $pass_label"
  else
    record "$status_name" "FAIL"
  fi
}

run_sql_e2e exercise_e2e tests/sql/trainingos_student_exercise_canonical_reconciliation_e2e.sql zero-residue
run_sql_e2e assessment_e2e tests/sql/trainingos_student_learning_canonical_reconciliation_e2e.sql zero-residue
run_sql_e2e result_e2e tests/sql/trainingos_wave3_assessment_grading_result_e2e.sql finalized-corrected

{
  printf '## PR #339 canonical exact-head final gates\n\n'
  printf -- '- Exact private SHA: `%s`\n' "$PRIVATE_SHA"
  printf -- '- Latest-main ancestry: **%s**\n' "$(read_status exact)"
  printf -- '- Focused Node contracts: **%s**\n' "$(read_status node)"
  printf -- '- Focused Python contracts: **%s**\n' "$(read_status python)"
  printf -- '- Dependency install: **%s**\n' "$(read_status install)"
  printf -- '- Repository typecheck: **%s**\n' "$(read_status typecheck)"
  printf -- '- VS Code production bundle: **%s**\n' "$(read_status vscode)"
  printf -- '- Learning Workspace bridge: **%s**\n' "$(read_status workspace)"
  printf -- '- Zero-permission bridge: **%s**\n' "$(read_status zero_permission)"
  printf -- '- Production build: **%s**\n' "$(read_status build)"
  printf -- '- Independent canonical review: **%s**\n' "$(read_status review)"
  printf -- '- First isolated migration replay: **%s**\n' "$(read_status db_first)"
  printf -- '- Second deterministic migration replay: **%s**\n' "$(read_status db_second)"
  printf -- '- Canonical ACL / single owner: **%s**\n' "$(read_status db_acl)"
  printf -- '- Ordinary exercise transaction E2E: **%s**\n' "$(read_status exercise_e2e)"
  printf -- '- Stage assessment transaction E2E: **%s**\n' "$(read_status assessment_e2e)"
  printf -- '- Current finalized/corrected Result regression: **%s**\n' "$(read_status result_e2e)"
  printf '\nPrivate source, migrations, build output, fixtures, and raw logs are not uploaded. Raw logs remain sealed and are deleted.\n'
} >> "$GITHUB_STEP_SUMMARY"

printf 'PR339_FINAL failures=%s exact=%s node=%s python=%s app=%s/%s/%s/%s/%s/%s review=%s db=%s/%s/%s e2e=%s/%s/%s\n' \
  "$FAILURES" \
  "$(read_status exact)" \
  "$(read_status node)" \
  "$(read_status python)" \
  "$(read_status install)" \
  "$(read_status typecheck)" \
  "$(read_status vscode)" \
  "$(read_status workspace)" \
  "$(read_status zero_permission)" \
  "$(read_status build)" \
  "$(read_status review)" \
  "$(read_status db_first)" \
  "$(read_status db_second)" \
  "$(read_status db_acl)" \
  "$(read_status exercise_e2e)" \
  "$(read_status assessment_e2e)" \
  "$(read_status result_e2e)"

exit "$FAILURES"
