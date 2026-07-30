#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CURRENT_STAGE="scope-file"
on_error(){ echo "AGENT_NATIVE_LEARNING_DATABASE status=FAIL stage=$CURRENT_STAGE"; }
trap on_error ERR

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA EXPECTED_MIGRATION_COUNT RUNNER_TEMP)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "AGENT_NATIVE_LEARNING_DATABASE status=FAIL stage=scope-file"; exit 2; }
done

supabase_cli(){ supabase "$@"; }
scope_file="$RUNNER_TEMP/trainingos-scope-contract.env"
[[ -f "$scope_file" ]]
read_scope(){ awk -F= -v wanted="$1" '$1 == wanted { print substr($0,index($0,"=")+1); exit }' "$scope_file"; }

CURRENT_STAGE="scope-contract"
expected_base_sha="$(read_scope expected_base_sha)"
expected_changed_file_count="$(read_scope expected_changed_file_count)"
[[ "$(read_scope validation_profile)" == agent-native-learning-product ]]
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ && "$expected_base_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$EXPECTED_MIGRATION_COUNT" == 0 ]]
[[ "$(read_scope migration_start)" == none && "$(read_scope migration_end)" == none ]]

CURRENT_STAGE="runner-contract"
[[ "$(git -C "$PRIVATE_REPO_PATH" rev-parse HEAD)" == "$PRIVATE_EXACT_SHA" ]]
[[ "$(git -C "$PRIVATE_REPO_PATH" merge-base "$expected_base_sha" "$PRIVATE_EXACT_SHA")" == "$expected_base_sha" ]]
changed_files="$(git -C "$PRIVATE_REPO_PATH" diff --name-only "$expected_base_sha" "$PRIVATE_EXACT_SHA" | sort)"
actual_count="$(sed '/^$/d' <<<"$changed_files" | wc -l | tr -d ' ')"
[[ "$actual_count" == "$expected_changed_file_count" ]]
changed_migrations="$(grep -E '^supabase/migrations/[0-9]{14}_.+\.sql$' <<<"$changed_files" || true)"
[[ -z "$changed_migrations" ]]

e2e_sql="$PRIVATE_REPO_PATH/tests/sql/trainingos_agent_native_learning_golden_path_e2e.sql"
cleanup_sql="$PRIVATE_REPO_PATH/tests/sql/trainingos_agent_native_learning_golden_path_cleanup_e2e.sql"
[[ -f "$e2e_sql" && -f "$cleanup_sql" ]]
grep -Eiq '^[[:space:]]*begin;' "$e2e_sql"
grep -Eiq '^[[:space:]]*rollback;' "$e2e_sql"
grep -Fq 'human-submission-confirmation' "$e2e_sql"
grep -Fq 'teacher-review' "$e2e_sql"
grep -Fq 'zero-residue' "$cleanup_sql"

fresh_project="$RUNNER_TEMP/trainingos-agent-native-learning-fresh"
upgrade_project="$RUNNER_TEMP/trainingos-agent-native-learning-upgrade"
base_worktree="$RUNNER_TEMP/trainingos-agent-native-learning-base"
cleanup(){
  supabase_cli --workdir "$fresh_project" stop --no-backup >/dev/null 2>&1 || true
  supabase_cli --workdir "$upgrade_project" stop --no-backup >/dev/null 2>&1 || true
  git -C "$PRIVATE_REPO_PATH" worktree remove --force "$base_worktree" >/dev/null 2>&1 || true
  rm -rf "$fresh_project" "$upgrade_project" "$base_worktree"
  rm -f "$RUNNER_TEMP"/trainingos-agent-native-learning-*-status.env
}
trap cleanup EXIT

run_sql_contracts(){
  local db_url="$1"
  psql "$db_url" -X -v ON_ERROR_STOP=1 -f "$e2e_sql"
  psql "$db_url" -X -v ON_ERROR_STOP=1 -f "$cleanup_sql"
}

CURRENT_STAGE="fresh-init"
rm -rf "$fresh_project"
supabase_cli --workdir "$fresh_project" init --force --yes
rm -rf "$fresh_project/supabase/migrations"

CURRENT_STAGE="fresh-bootstrap"
python "$PRIVATE_REPO_PATH/scripts/build-trainingos-fresh-bootstrap.py" \
  --repo-root "$PRIVATE_REPO_PATH" \
  --output-dir "$fresh_project/supabase/migrations" \
  --commit-sha "$PRIVATE_EXACT_SHA"

CURRENT_STAGE="fresh-start"
supabase_cli --workdir "$fresh_project" start
CURRENT_STAGE="fresh-reset-one"
supabase_cli --workdir "$fresh_project" db reset --local --no-seed
CURRENT_STAGE="fresh-reset-two"
supabase_cli --workdir "$fresh_project" db reset --local --no-seed
CURRENT_STAGE="fresh-status"
fresh_status="$RUNNER_TEMP/trainingos-agent-native-learning-fresh-status.env"
supabase_cli --workdir "$fresh_project" status -o env >"$fresh_status"
fresh_db_url="$(grep '^DB_URL=' "$fresh_status" | sed 's/^DB_URL=//' | tr -d '"')"
[[ -n "$fresh_db_url" ]]
CURRENT_STAGE="fresh-sql-e2e"
run_sql_contracts "$fresh_db_url"
CURRENT_STAGE="fresh-stop"
supabase_cli --workdir "$fresh_project" stop --no-backup

CURRENT_STAGE="upgrade-worktree"
rm -rf "$upgrade_project" "$base_worktree"
git -C "$PRIVATE_REPO_PATH" worktree add --detach "$base_worktree" "$expected_base_sha"
CURRENT_STAGE="upgrade-init"
supabase_cli --workdir "$upgrade_project" init --force --yes
rm -rf "$upgrade_project/supabase/migrations"
CURRENT_STAGE="upgrade-bootstrap"
python "$base_worktree/scripts/build-trainingos-fresh-bootstrap.py" \
  --repo-root "$base_worktree" \
  --output-dir "$upgrade_project/supabase/migrations" \
  --commit-sha "$expected_base_sha"
CURRENT_STAGE="upgrade-start"
supabase_cli --workdir "$upgrade_project" start
CURRENT_STAGE="upgrade-noop-migration"
supabase_cli --workdir "$upgrade_project" migration up --local
CURRENT_STAGE="upgrade-status"
upgrade_status="$RUNNER_TEMP/trainingos-agent-native-learning-upgrade-status.env"
supabase_cli --workdir "$upgrade_project" status -o env >"$upgrade_status"
upgrade_db_url="$(grep '^DB_URL=' "$upgrade_status" | sed 's/^DB_URL=//' | tr -d '"')"
[[ -n "$upgrade_db_url" ]]
CURRENT_STAGE="upgrade-sql-e2e"
run_sql_contracts "$upgrade_db_url"
CURRENT_STAGE="upgrade-stop"
supabase_cli --workdir "$upgrade_project" stop --no-backup

CURRENT_STAGE="complete"
echo "AGENT_NATIVE_LEARNING_DATABASE status=PASS changed_migrations=0 fresh=PASS second_replay=PASS upgrade=PASS sql_e2e=PASS zero_residue=PASS cleanup=PASS"
