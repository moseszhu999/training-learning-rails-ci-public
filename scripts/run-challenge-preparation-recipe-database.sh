#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CURRENT_STAGE="scope-file"
FAILURE_REASON="unclassified"
on_error(){ echo "CHALLENGE_DATABASE status=FAIL stage=$CURRENT_STAGE reason=$FAILURE_REASON"; }
trap on_error ERR

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA EXPECTED_MIGRATION_COUNT RUNNER_TEMP)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo 'CHALLENGE_DATABASE status=FAIL stage=scope-file reason=unclassified'; exit 2; }
done

supabase_cli(){ npx --yes supabase@latest "$@"; }
scope_file="$RUNNER_TEMP/trainingos-scope-contract.env"
[[ -f "$scope_file" ]]
read_scope(){ awk -F= -v wanted="$1" '$1 == wanted { print substr($0,index($0,"=")+1); exit }' "$scope_file"; }

CURRENT_STAGE="scope-inputs"
expected_base_sha="$(read_scope expected_base_sha)"
expected_changed_file_count="$(read_scope expected_changed_file_count)"
migration_start="$(read_scope migration_start)"
migration_end="$(read_scope migration_end)"
[[ "$(read_scope validation_profile)" == generic-owned ]]
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ && "$expected_base_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$expected_changed_file_count" == 10 ]]
[[ "$EXPECTED_MIGRATION_COUNT" == 355 ]]
[[ "$migration_start" == 20260731120000 && "$migration_end" == 20260731120000 ]]

CURRENT_STAGE="scope-files"
expected_files="$(printf '%s\n' \
  docs/architecture/trainingos-challenge-preparation-recipe-v1.md \
  docs/testing/trainingos-challenge-preparation-recipe-validation-v1.md \
  lib/trainingos-agent-gateway/challenge-preparation-recipe.mjs \
  packages/training-challenge-preparation-recipe/package.json \
  packages/training-challenge-preparation-recipe/src/index.mjs \
  packages/training-recipe/src/adapters.mjs \
  prototypes/trainingos-agent-mvp-v1/test/challenge-preparation-recipe-v1.test.mjs \
  supabase/migrations/20260731120000_trainingos_challenge_preparation_recipe_v1.sql \
  tests/sql/trainingos_challenge_preparation_recipe_v1_e2e.sql \
  tests/test_trainingos_challenge_preparation_recipe_v1_contract.py | sort)"
changed_files="$(git -C "$PRIVATE_REPO_PATH" diff --name-only "$expected_base_sha" "$PRIVATE_EXACT_SHA" | sort)"
[[ "$changed_files" == "$expected_files" ]]

CURRENT_STAGE="scope-migration-count"
migration="supabase/migrations/20260731120000_trainingos_challenge_preparation_recipe_v1.sql"
e2e="$PRIVATE_REPO_PATH/tests/sql/trainingos_challenge_preparation_recipe_v1_e2e.sql"
source_migration_count="$(find "$PRIVATE_REPO_PATH/supabase/migrations" -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
[[ "$source_migration_count" == "$EXPECTED_MIGRATION_COUNT" ]]
[[ -f "$PRIVATE_REPO_PATH/$migration" && -f "$e2e" ]]

CURRENT_STAGE="scope-head"
[[ "$(git -C "$PRIVATE_REPO_PATH" rev-parse HEAD)" == "$PRIVATE_EXACT_SHA" ]]
[[ "$(git -C "$PRIVATE_REPO_PATH" merge-base "$expected_base_sha" "$PRIVATE_EXACT_SHA")" == "$expected_base_sha" ]]

CURRENT_STAGE="scope-e2e-contract"
grep -Eiq '^[[:space:]]*begin;' "$e2e"
grep -Eiq '^[[:space:]]*rollback;' "$e2e"
! grep -Eiq '^[[:space:]]*insert[[:space:]]+into[[:space:]]+public\.' "$e2e"

fresh_project="$RUNNER_TEMP/trainingos-challenge-preparation-fresh"
upgrade_project="$RUNNER_TEMP/trainingos-challenge-preparation-upgrade"
base_worktree="$RUNNER_TEMP/trainingos-challenge-preparation-base"
cleanup(){
  supabase_cli --workdir "$fresh_project" stop --no-backup >/dev/null 2>&1 || true
  supabase_cli --workdir "$upgrade_project" stop --no-backup >/dev/null 2>&1 || true
  git -C "$PRIVATE_REPO_PATH" worktree remove --force "$base_worktree" >/dev/null 2>&1 || true
  rm -rf "$fresh_project" "$upgrade_project" "$base_worktree"
  rm -f "$RUNNER_TEMP"/trainingos-challenge-preparation-*.env
  rm -f "$RUNNER_TEMP"/trainingos-challenge-preparation-*.log
}
trap cleanup EXIT

run_e2e(){
  local url="$1"
  local phase="$2"
  local log="$RUNNER_TEMP/trainingos-challenge-preparation-${phase}.log"
  psql "$url" -X -v ON_ERROR_STOP=1 -f "$e2e" >"$log" 2>&1
  rm -f "$log"
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
CURRENT_STAGE="fresh-manifest"
generated_migration_count="$(find "$fresh_project/supabase/migrations" -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
[[ "$generated_migration_count" == "$EXPECTED_MIGRATION_COUNT" ]]
CURRENT_STAGE="fresh-start"
supabase_cli --workdir "$fresh_project" start
CURRENT_STAGE="fresh-reset-one"
supabase_cli --workdir "$fresh_project" db reset --local --no-seed
CURRENT_STAGE="fresh-reset-two"
supabase_cli --workdir "$fresh_project" db reset --local --no-seed
CURRENT_STAGE="fresh-status"
fresh_status="$RUNNER_TEMP/trainingos-challenge-preparation-fresh.env"
supabase_cli --workdir "$fresh_project" status -o env >"$fresh_status"
fresh_db_url="$(grep '^DB_URL=' "$fresh_status" | sed 's/^DB_URL=//' | tr -d '"')"
[[ -n "$fresh_db_url" ]]
CURRENT_STAGE="fresh-e2e"
run_e2e "$fresh_db_url" fresh
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
CURRENT_STAGE="upgrade-migration"
cp "$PRIVATE_REPO_PATH/$migration" "$upgrade_project/supabase/migrations/"
supabase_cli --workdir "$upgrade_project" migration up --local --include-all
CURRENT_STAGE="upgrade-status"
upgrade_status="$RUNNER_TEMP/trainingos-challenge-preparation-upgrade.env"
supabase_cli --workdir "$upgrade_project" status -o env >"$upgrade_status"
upgrade_db_url="$(grep '^DB_URL=' "$upgrade_status" | sed 's/^DB_URL=//' | tr -d '"')"
[[ -n "$upgrade_db_url" ]]
CURRENT_STAGE="upgrade-e2e"
run_e2e "$upgrade_db_url" upgrade
CURRENT_STAGE="upgrade-stop"
supabase_cli --workdir "$upgrade_project" stop --no-backup

CURRENT_STAGE="complete"
echo "CHALLENGE_DATABASE status=PASS suite=challenge-preparation-recipe changed_migrations=1 source=$source_migration_count generated=$generated_migration_count fresh=PASS second_pass=PASS upgrade=PASS e2e=PASS rollback=PASS cleanup=PASS"
