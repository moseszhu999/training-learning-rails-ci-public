#!/usr/bin/env bash
set -u

PRIVATE_REPO_PATH="${1:?private repository path required}"
STATUS_DIR="$RUNNER_TEMP/pr339-status"
mkdir -p "$STATUS_DIR"

set +e
bash "$(dirname "$0")/run-pr339-final-v3.sh" "$PRIVATE_REPO_PATH"
set +e
cd "$PRIVATE_REPO_PATH" || exit 1

# Correct the focused Python set: the Learning Workspace contract is the
# assessment projection contract present on the exact private head.
: > "$RUNNER_TEMP/pr339-python.log"
python_code=0
for test_file in \
  tests/test_trainingos_student_exercise_execution_contract.py \
  tests/test_trainingos_assessment_resume_execution_contract.py \
  tests/test_trainingos_learning_workspace_assessment_projection_contract.py
do
  python "$test_file" >> "$RUNNER_TEMP/pr339-python.log" 2>&1 || python_code=1
done
python_count="$(grep -Eo 'Ran [0-9]+ tests?' "$RUNNER_TEMP/pr339-python.log" | awk '{sum+=$2} END {print sum+0}')"
if [[ "$python_code" == 0 && "$python_count" -gt 0 ]]; then
  printf 'PASS %s/%s\n' "$python_count" "$python_count" > "$STATUS_DIR/python"
else
  printf 'FAIL %s\n' "$python_count" > "$STATUS_DIR/python"
fi

# Correct the independent review to inspect only main..exact-head migrations.
python - <<'PY' > "$RUNNER_TEMP/pr339-review.log" 2>&1
from pathlib import Path
import subprocess
root = Path('.')
migration = (root / 'supabase/migrations/20260728100300_trainingos_student_learning_execution_canonical_reconciliation_v1.sql').read_text(encoding='utf-8')
exercise = (root / 'lib/trainingos-agent-gateway/student-exercise-execution.mjs').read_text(encoding='utf-8')
assessment = (root / 'lib/trainingos-agent-gateway/student-assessment-resume.mjs').read_text(encoding='utf-8')
web = (root / 'apps/training-web/src/lib/trainingos-assessment-runtime.ts').read_text(encoding='utf-8')
changed = subprocess.check_output(
    ['git', 'diff', '--name-only', f"{__import__('os').environ['BASE_SHA']}..{__import__('os').environ['PRIVATE_SHA']}", '--', 'supabase/migrations'],
    text=True,
).splitlines()
used = {Path(path).name for path in changed if path.strip()}
allowed = {
    '20260728100000_trainingos_student_exercise_execution_v1.sql',
    '20260728100100_trainingos_assessment_answer_resume_projection_v1.sql',
    '20260728100200_trainingos_student_exercise_start_concurrency_v1.sql',
    '20260728100300_trainingos_student_learning_execution_canonical_reconciliation_v1.sql',
}
gates = {
    'reserved_migrations_only': used == allowed,
    'no_second_fact_table': 'create table' not in migration.lower(),
    'canonical_assessment_owners': all(token in migration for token in (
        'trainingos_assessment_attempts', 'trainingos_assessment_answers',
        'trainingos_assessment_results', 'trainingos_assessment_result_items')),
    'canonical_exercise_owner': "canonicalOwners: Object.freeze(['exercise_publications', 'exercise_submissions'])" in exercise,
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
print(f"gates={len(gates)} passed={len(gates)-len(failed)} failed={len(failed)}")
print('failed_gates=' + (','.join(failed) if failed else 'none'))
raise SystemExit(1 if failed else 0)
PY
review_code=$?
review_count="$(grep -Eo 'gates=[0-9]+' "$RUNNER_TEMP/pr339-review.log" | cut -d= -f2)"
if [[ "$review_code" == 0 ]]; then
  printf 'PASS %s/%s\n' "$review_count" "$review_count" > "$STATUS_DIR/review"
else
  printf 'FAIL %s\n' "${review_count:-0}" > "$STATUS_DIR/review"
fi

# Produce public-safe diagnostics only: test names, file basenames/error codes,
# TrainingOS markers, and failed review gate names. No source lines/messages.
python - "$RUNNER_TEMP" "$STATUS_DIR" <<'PY'
from pathlib import Path
import re
import sys

temp = Path(sys.argv[1])
status = Path(sys.argv[2])

def read(name):
    path = temp / name
    return path.read_text(encoding='utf-8', errors='replace') if path.exists() else ''

def write(name, value):
    status.joinpath(name).write_text(value or 'none', encoding='utf-8')

python_text = read('pr339-python.log')
python_failures = []
for match in re.finditer(r'^(?:FAIL|ERROR):\s+([^\s]+)', python_text, re.M):
    if match.group(1) not in python_failures:
        python_failures.append(match.group(1))
write('python_diag', ','.join(python_failures[:8]) or 'none')

def ts_diagnostics(text):
    result = []
    patterns = [
        r'([A-Za-z0-9_./-]+\.(?:ts|tsx|mts|cts))\((\d+),(\d+)\):\s+error\s+(TS\d+)',
        r'([A-Za-z0-9_./-]+\.(?:ts|tsx|mts|cts)):(\d+):(\d+):[^\n]*?\b(TS\d+)\b',
    ]
    for pattern in patterns:
        for path, line, column, code in re.findall(pattern, text):
            token = f'{Path(path).name}:{line}:{column}:{code}'
            if token not in result:
                result.append(token)
    return ','.join(result[:8]) or 'none'

write('typecheck_diag', ts_diagnostics(read('pr339-typecheck.log')))
write('build_diag', ts_diagnostics(read('pr339-build.log')))

def markers(text):
    values = []
    for token in re.findall(r'TRAININGOS_[A-Z0-9_]+', text):
        if token not in values:
            values.append(token)
    return ','.join(values[:8]) or 'none'

write('workspace_diag', markers(read('pr339-workspace.log')))
write('zero_permission_diag', markers(read('pr339-zero-permission.log')))
review_text = read('pr339-review.log')
match = re.search(r'^failed_gates=(.*)$', review_text, re.M)
write('review_diag', match.group(1).strip() if match else 'none')
PY

required=(
  exact node python install typecheck vscode workspace zero_permission build review
  db_first db_second db_acl exercise_e2e assessment_e2e result_e2e
)
failures=0
for name in "${required[@]}"; do
  value="NOT_RUN"
  [[ -f "$STATUS_DIR/$name" ]] && value="$(cat "$STATUS_DIR/$name")"
  [[ "$value" == PASS* ]] || failures=$((failures + 1))
done

printf 'PR339_V4 failures=%s python=%s review=%s python_diag=%s typecheck_diag=%s workspace_diag=%s zero_permission_diag=%s build_diag=%s review_diag=%s\n' \
  "$failures" \
  "$(cat "$STATUS_DIR/python")" \
  "$(cat "$STATUS_DIR/review")" \
  "$(cat "$STATUS_DIR/python_diag")" \
  "$(cat "$STATUS_DIR/typecheck_diag")" \
  "$(cat "$STATUS_DIR/workspace_diag")" \
  "$(cat "$STATUS_DIR/zero_permission_diag")" \
  "$(cat "$STATUS_DIR/build_diag")" \
  "$(cat "$STATUS_DIR/review_diag")"

exit "$failures"
