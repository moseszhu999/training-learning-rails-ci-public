#!/usr/bin/env bash
set -euo pipefail
umask 077

MODE="${1:?mode required}"
PRIVATE_REPO="${2:?private repo path required}"
SEALED_DIR="${3:?sealed directory required}"

PRIVATE_SHA="0b94438ee73be768194c4f56ac31250cd6c9476e"
BASE_SHA="26fc34af65b9489985aa9a5cbe45c9d1590826bf"
SCOPE_SHA256="e4cfb1a78342c1bf610340fc9ffcfd339dab1df35cdd0572e646643b142c18ce"
DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"

mkdir -p "$SEALED_DIR"
cd "$PRIVATE_REPO"

verify_exact_scope() {
  local files="$SEALED_DIR/pr339-files.txt"
  [[ "$(git rev-parse HEAD)" == "$PRIVATE_SHA" ]]
  [[ "$(git merge-base "$BASE_SHA" "$PRIVATE_SHA")" == "$BASE_SHA" ]]
  [[ "$(git rev-list --count "$PRIVATE_SHA..$BASE_SHA")" == 0 ]]
  git diff --name-only "$BASE_SHA" "$PRIVATE_SHA" | sort > "$files"
  [[ "$(wc -l < "$files" | tr -d ' ')" == 36 ]]
  [[ "$(sha256sum "$files" | cut -d' ' -f1)" == "$SCOPE_SHA256" ]]
  [[ "$(grep -Ec '^supabase/migrations/20260728100(000|100|200|250|300|350|400)_.*\.sql$' "$files")" == 7 ]]
}

parse_node_log() {
  python - "$1" <<'PY'
import pathlib
import re
import sys

text = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8', errors='replace')
def number(pattern, default):
    match = re.search(pattern, text)
    return int(match.group(1)) if match else default
tests = number(r'# tests\s+(\d+)', 0)
passed = number(r'# pass\s+(\d+)', 0)
failed = number(r'# fail\s+(\d+)', -1)
assert tests > 0 and passed == tests and failed == 0, (tests, passed, failed)
print(f'focused_node={passed}/{tests}')
PY
}

run_application() {
  verify_exact_scope

  local node_log="$SEALED_DIR/pr339-node.log"
  node --test \
    prototypes/trainingos-agent-mvp-v1/student-exercise-execution.test.mjs \
    prototypes/trainingos-agent-mvp-v1/student-assessment-resume.test.mjs \
    prototypes/trainingos-agent-mvp-v1/student-learning-canonical-reconciliation.test.mjs \
    > "$node_log" 2>&1
  parse_node_log "$node_log" > "$SEALED_DIR/pr339-node-summary.txt"

  local python_log="$SEALED_DIR/pr339-python.log"
  : > "$python_log"
  for file in \
    tests/test_trainingos_student_exercise_execution_contract.py \
    tests/test_trainingos_assessment_resume_execution_contract.py \
    tests/test_trainingos_learning_workspace_assessment_projection_contract.py \
    tests/test_trainingos_vscode_exercise_execution_contract.py
  do
    python "$file" >> "$python_log" 2>&1
  done
  python - "$python_log" <<'PY' > "$SEALED_DIR/pr339-python-summary.txt"
import pathlib
import re
import sys

text = pathlib.Path(sys.argv[1]).read_text(encoding='utf-8', errors='replace')
counts = [int(value) for value in re.findall(r'Ran\s+(\d+)\s+tests?', text)]
oks = len(re.findall(r'(?:^|\n)OK(?:\s|\n|$)', text))
assert len(counts) == 4 and sum(counts) > 0 and oks == 4, (counts, oks)
print(f'focused_python={sum(counts)}/{sum(counts)}')
PY

  npm ci > "$SEALED_DIR/pr339-install.log" 2>&1
  npm run typecheck > "$SEALED_DIR/pr339-typecheck.log" 2>&1
  node extensions/trainingos-classroom-vscode/esbuild.mjs --production > "$SEALED_DIR/pr339-vscode.log" 2>&1
  npm run validate:learning-workspace-bridge > "$SEALED_DIR/pr339-workspace.log" 2>&1
  npm run validate:zero-permission-bridge > "$SEALED_DIR/pr339-zero-permission.log" 2>&1
  npm run build > "$SEALED_DIR/pr339-build.log" 2>&1

  python - <<'PY' > "$SEALED_DIR/pr339-review-summary.txt"
from pathlib import Path

root = Path('.')
bridge = (root / 'supabase/migrations/20260728100250_trainingos_student_exercise_rpc_transition_bridge_v1.sql').read_text()
reconciliation = (root / 'supabase/migrations/20260728100300_trainingos_student_learning_execution_canonical_reconciliation_v1.sql').read_text()
privacy = (root / 'supabase/migrations/20260728100350_trainingos_assessment_start_privacy_hardening_v1.sql').read_text()
options = (root / 'supabase/migrations/20260728100400_trainingos_assessment_answer_schema_option_compat_v1.sql').read_text()
grade_bridge = (root / 'tests/sql/trainingos_wave3_assessment_grading_result_canonical_bridge_e2e.sql').read_text()
grade_e2e = (root / 'tests/sql/trainingos_wave3_assessment_grading_result_e2e.sql').read_text()
exercise = (root / 'lib/trainingos-agent-gateway/student-exercise-execution.mjs').read_text()
assessment = (root / 'lib/trainingos-agent-gateway/student-assessment-resume.mjs').read_text()
web = (root / 'apps/training-web/src/lib/trainingos-assessment-runtime.ts').read_text()

gates = {
    'no_second_fact_table': 'create table' not in (bridge + reconciliation + privacy + options).lower(),
    'record_assignment_fixed': 'select p, d into v_publication, v_definition' not in reconciliation.lower(),
    'rpc_trigger_seam': all(token in bridge for token in (
        'trainingos.student_exercise_rpc',
        'validate_exercise_submission_rpc_scope',
        'validate_exercise_submission_scope',
    )),
    'direct_table_privilege_not_restored': 'grant insert' not in bridge.lower() and 'grant update' not in bridge.lower(),
    'teacher_fields_immutable': 'TRAININGOS_STUDENT_EXERCISE_RPC_TEACHER_FIELDS_IMMUTABLE' in bridge,
    'privacy_reuses_canonical_owners': all(token in privacy for token in (
        'trainingos_assessment_publications',
        'trainingos_assessment_review_snapshots',
        'trainingos_assessment_definitions',
        'trainingos_assessment_attempts',
    )),
    'privacy_strips_prompt_and_material': all(token in privacy for token in (
        'strip_private_json(si.prompt_payload)',
        'strip_private_json(si.material_references)',
        'input_contract(si.item_type, si.answer_schema)',
        "'answerKeysExposed', false",
        "'rubricsExposed', false",
    )),
    'option_compat_reuses_answer_owner': 'create or replace function trainingos_assessment_private.validate_answer()' in options,
    'option_compat_accepts_bounded_keys': all(token in options for token in (
        "schema_option.value->>'id'",
        "schema_option.value->>'value'",
        "schema_option.value->>'key'",
        'TRAININGOS_ASSESSMENT_ANSWER_DIGEST_INVALID',
        'TRAININGOS_ASSESSMENT_SUBMITTED_ANSWER_IMMUTABLE',
    )),
    'grading_bridge_test_only_transactional': grade_bridge.lstrip().startswith('-- TrainingOS W3A grading/result regression') and '\\ir trainingos_wave3_assessment_grading_result_e2e.sql' in grade_bridge and 'commit;' not in grade_bridge.lower(),
    'grading_bridge_calls_current_contract': all(token in grade_bridge for token in (
        'public.save_trainingos_assessment_answer(',
        'public.prepare_trainingos_assessment_submission(',
        'public.confirm_trainingos_assessment_submission(',
    )),
    'grading_e2e_rolls_back': grade_e2e.rstrip().endswith('rollback;'),
    'exercise_owner': "canonicalOwners: Object.freeze(['exercise_publications', 'exercise_submissions'])" in exercise,
    'assessment_agent_denial': 'TRAININGOS_ASSESSMENT_AGENT_CONFIRMATION_FORBIDDEN' in assessment,
    'web_prepare_confirm': all(token in web for token in (
        'prepare_trainingos_assessment_submission',
        'confirm_trainingos_assessment_submission',
    )),
    'no_privileged_client_path': 'service_role' not in (exercise + assessment).lower(),
}
failed = [name for name, passed in gates.items() if not passed]
print(f'canonical_review={len(gates)-len(failed)}/{len(gates)}')
print(f'blocking_findings={len(failed)}')
raise SystemExit(1 if failed else 0)
PY

  {
    echo 'exact_private_sha=0b94438ee73be768194c4f56ac31250cd6c9476e'
    echo 'exact_base_sha=26fc34af65b9489985aa9a5cbe45c9d1590826bf'
    echo 'scope=PASS_36_FILES_7_MIGRATIONS'
    cat "$SEALED_DIR/pr339-node-summary.txt"
    cat "$SEALED_DIR/pr339-python-summary.txt"
    echo 'install=PASS'
    echo 'typecheck=PASS'
    echo 'vscode_bundle=PASS'
    echo 'learning_workspace_bridge=PASS'
    echo 'zero_permission_bridge=PASS'
    echo 'production_build=PASS'
    cat "$SEALED_DIR/pr339-review-summary.txt"
    echo 'raw_private_output=SEALED_AND_DELETED'
  } >> "$GITHUB_STEP_SUMMARY"
}

verify_acl() {
  local evidence
  evidence="$(psql "$DB_URL" -X -Atv ON_ERROR_STOP=1 <<'SQL'
select jsonb_build_object(
  'duplicateTables',(select count(*) from information_schema.tables where table_schema='public' and table_name in ('student_exercise_submissions','student_exercise_answers','student_assessment_attempts','student_assessment_answers','assessment_resume_answers','assessment_execution_state')),
  'assessmentDirectPrivileges',(select count(*) from information_schema.role_table_grants where grantee='authenticated' and table_schema='public' and table_name in ('trainingos_assessment_attempts','trainingos_assessment_answers') and privilege_type in ('INSERT','UPDATE','DELETE')),
  'oldAssessmentSave',case when to_regprocedure('public.save_trainingos_assessment_answer(uuid,uuid,integer,jsonb)') is null then false else has_function_privilege('authenticated','public.save_trainingos_assessment_answer(uuid,uuid,integer,jsonb)','execute') end,
  'oldAssessmentSubmit',case when to_regprocedure('public.submit_trainingos_assessment_attempt(uuid,integer,jsonb)') is null then false else has_function_privilege('authenticated','public.submit_trainingos_assessment_attempt(uuid,integer,jsonb)','execute') end,
  'newAssessmentSave',has_function_privilege('authenticated','public.save_trainingos_assessment_answer(uuid,uuid,integer,integer,jsonb,text)','execute'),
  'newAssessmentConfirm',has_function_privilege('authenticated','public.confirm_trainingos_assessment_submission(uuid,integer,text,text)','execute'),
  'oldExerciseConfirm',case when to_regprocedure('public.confirm_my_trainingos_exercise_submission(uuid,bigint,text,boolean,text)') is null then false else has_function_privilege('authenticated','public.confirm_my_trainingos_exercise_submission(uuid,bigint,text,boolean,text)','execute') end,
  'newExerciseConfirm',has_function_privilege('authenticated','public.confirm_my_trainingos_exercise_submission(uuid,bigint,text,text,text)','execute')
);
SQL
)"
  python - "$evidence" <<'PY'
import json
import sys
actual = json.loads(sys.argv[1])
expected = {
    'duplicateTables': 0,
    'assessmentDirectPrivileges': 0,
    'oldAssessmentSave': False,
    'oldAssessmentSubmit': False,
    'newAssessmentSave': True,
    'newAssessmentConfirm': True,
    'oldExerciseConfirm': False,
    'newExerciseConfirm': True,
}
assert actual == expected, (actual, expected)
PY
}

run_sql_e2es() {
  local pass="$1"
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 \
    -f tests/sql/trainingos_student_exercise_canonical_reconciliation_e2e.sql \
    > "$SEALED_DIR/pr339-exercise-${pass}.log" 2>&1
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 \
    -f tests/sql/trainingos_student_learning_canonical_reconciliation_e2e.sql \
    > "$SEALED_DIR/pr339-assessment-${pass}.log" 2>&1
  psql "$DB_URL" -X -qAt -v ON_ERROR_STOP=1 \
    -f tests/sql/trainingos_wave3_assessment_grading_result_canonical_bridge_e2e.sql \
    > "$SEALED_DIR/pr339-grading-${pass}.log" 2>&1
}

run_database() {
  verify_exact_scope

  local workdir="$SEALED_DIR/pr339-db"
  rm -rf "$workdir"
  mkdir -p "$workdir"
  supabase --workdir "$workdir" init --force --yes > "$SEALED_DIR/pr339-db-init.log" 2>&1
  python scripts/build-trainingos-fresh-bootstrap.py \
    --repo-root "$PRIVATE_REPO" \
    --output-dir "$workdir/supabase/migrations" \
    --commit-sha "$PRIVATE_SHA" \
    > "$SEALED_DIR/pr339-db-bootstrap.log" 2>&1
  supabase --workdir "$workdir" start > "$SEALED_DIR/pr339-db-start.log" 2>&1

  verify_acl
  run_sql_e2es first

  supabase --workdir "$workdir" db reset --local --no-seed > "$SEALED_DIR/pr339-db-reset.log" 2>&1
  verify_acl
  run_sql_e2es second

  {
    echo 'exact_private_sha=0b94438ee73be768194c4f56ac31250cd6c9476e'
    echo 'exact_base_sha=26fc34af65b9489985aa9a5cbe45c9d1590826bf'
    echo 'canonical_bootstrap=PASS'
    echo 'canonical_owner_acl_first=PASS_8_8'
    echo 'exercise_e2e_first=PASS_ZERO_RESIDUE'
    echo 'assessment_e2e_first=PASS_ZERO_RESIDUE'
    echo 'grading_result_canonical_bridge_first=PASS_ROLLBACK'
    echo 'second_deterministic_replay=PASS'
    echo 'canonical_owner_acl_second=PASS_8_8'
    echo 'exercise_e2e_second=PASS_ZERO_RESIDUE'
    echo 'assessment_e2e_second=PASS_ZERO_RESIDUE'
    echo 'grading_result_canonical_bridge_second=PASS_ROLLBACK'
    echo 'raw_private_database_output=SEALED_AND_DELETED'
  } >> "$GITHUB_STEP_SUMMARY"
}

case "$MODE" in
  application) run_application ;;
  database) run_database ;;
  *) echo 'unsupported mode' >&2; exit 2 ;;
esac
