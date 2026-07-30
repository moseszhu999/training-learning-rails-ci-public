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

supabase_cli(){ npx --yes supabase@latest "$@"; }
scope_file="$RUNNER_TEMP/trainingos-scope-contract.env"
[[ -f "$scope_file" ]]
read_scope(){ awk -F= -v wanted="$1" '$1 == wanted { print substr($0,index($0,"=")+1); exit }' "$scope_file"; }

CURRENT_STAGE="scope-contract"
expected_base_sha="$(read_scope expected_base_sha)"
expected_changed_file_count="$(read_scope expected_changed_file_count)"
migration_start="$(read_scope migration_start)"
migration_end="$(read_scope migration_end)"
[[ "$(read_scope validation_profile)" == generic-owned ]]
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ && "$expected_base_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$expected_changed_file_count" == 12 ]]
[[ "$EXPECTED_MIGRATION_COUNT" == 3 ]]
[[ "$migration_start" == 20260730150000 && "$migration_end" == 20260730155959 ]]

changed_files="$(git -C "$PRIVATE_REPO_PATH" diff --name-only "$expected_base_sha" "$PRIVATE_EXACT_SHA" | sort)"
expected_non_migrations="$(printf '%s\n' \
  api/integrations/agents/mcp.mjs \
  docs/architecture/trainingos-learning-assistance-governance-runtime-v1.md \
  docs/testing/trainingos-learning-assistance-governance-validation-v1.md \
  lib/trainingos-agent-gateway/learning-assistance-governance.mjs \
  lib/trainingos-agent-gateway/mcp-learning-assistance-governance-layer.mjs \
  netlify/functions/trainingos-mcp.mjs \
  prototypes/trainingos-agent-mvp-v1/learning-assistance-governance.test.mjs \
  tests/sql/trainingos_learning_assistance_governance_schema_e2e.sql \
  tests/test_trainingos_learning_assistance_governance_contract.py | sort)"
expected_migrations=(
  supabase/migrations/20260730150000_trainingos_learning_assistance_schema_v1.sql
  supabase/migrations/20260730150100_trainingos_learning_assistance_policy_rpc_v1.sql
  supabase/migrations/20260730150200_trainingos_learning_assistance_request_rpc_v1.sql
)

CURRENT_STAGE="suite-selection"
actual_non_migrations="$(grep -Ev '^supabase/migrations/' <<<"$changed_files" || true)"
[[ "$actual_non_migrations" == "$expected_non_migrations" ]]
e2e_sql="$PRIVATE_REPO_PATH/tests/sql/trainingos_learning_assistance_governance_schema_e2e.sql"

fresh_project="$RUNNER_TEMP/trainingos-learning-assistance-fresh"
upgrade_project="$RUNNER_TEMP/trainingos-learning-assistance-upgrade"
base_worktree="$RUNNER_TEMP/trainingos-learning-assistance-base"
cleanup(){
  supabase_cli --workdir "$fresh_project" stop --no-backup >/dev/null 2>&1 || true
  supabase_cli --workdir "$upgrade_project" stop --no-backup >/dev/null 2>&1 || true
  git -C "$PRIVATE_REPO_PATH" worktree remove --force "$base_worktree" >/dev/null 2>&1 || true
  rm -rf "$fresh_project" "$upgrade_project" "$base_worktree"
  rm -f "$RUNNER_TEMP"/trainingos-learning-assistance-*-status.env
}
trap cleanup EXIT

CURRENT_STAGE="runner-contract"
[[ "$(git -C "$PRIVATE_REPO_PATH" rev-parse HEAD)" == "$PRIVATE_EXACT_SHA" ]]
[[ "$(git -C "$PRIVATE_REPO_PATH" merge-base "$expected_base_sha" "$PRIVATE_EXACT_SHA")" == "$expected_base_sha" ]]
actual_count="$(sed '/^$/d' <<<"$changed_files" | wc -l | tr -d ' ')"
[[ "$actual_count" == "$expected_changed_file_count" ]]
[[ -f "$e2e_sql" ]]
grep -Eiq '^[[:space:]]*begin;' "$e2e_sql"
grep -Eiq '^[[:space:]]*rollback;' "$e2e_sql"
grep -Fq 'trainingos_learning_assistance_events_immutable' "$e2e_sql"

CURRENT_STAGE="migration-contract"
mapfile -t migrations < <(
  grep -E '^supabase/migrations/20260730150[0-2]00_trainingos_learning_assistance_[a-z0-9_]+_v1\.sql$' <<<"$changed_files" | sort || true
)
[[ "${#migrations[@]}" == 3 ]]
[[ "${#migrations[@]}" == "$EXPECTED_MIGRATION_COUNT" ]]
[[ "$(printf '%s\n' "${migrations[@]}")" == "$(printf '%s\n' "${expected_migrations[@]}")" ]]
for migration in "${migrations[@]}"; do
  stamp="$(basename "$migration" | cut -c1-14)"
  [[ "$stamp" -ge "$migration_start" && "$stamp" -le "$migration_end" ]]
done

run_e2e(){
  local url="$1"
  psql "$url" -X -v ON_ERROR_STOP=1 -f "$e2e_sql"
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
[[ "$generated_migration_count" =~ ^[1-9][0-9]*$ ]]
python - "$fresh_project/supabase/trainingos-bootstrap-manifest.json" "$generated_migration_count" <<'PY'
import json,pathlib,sys
manifest=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
raise SystemExit(0 if int(manifest.get('migrationCount',-1))==int(sys.argv[2]) else 1)
PY

CURRENT_STAGE="fresh-start"
supabase_cli --workdir "$fresh_project" start
CURRENT_STAGE="fresh-reset-one"
supabase_cli --workdir "$fresh_project" db reset --local --no-seed
CURRENT_STAGE="fresh-reset-two"
supabase_cli --workdir "$fresh_project" db reset --local --no-seed
CURRENT_STAGE="fresh-status"
fresh_status="$RUNNER_TEMP/trainingos-learning-assistance-fresh-status.env"
supabase_cli --workdir "$fresh_project" status -o env >"$fresh_status"
fresh_db_url="$(grep '^DB_URL=' "$fresh_status" | sed 's/^DB_URL=//' | tr -d '"')"
[[ -n "$fresh_db_url" ]]
CURRENT_STAGE="fresh-e2e"
run_e2e "$fresh_db_url"
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
CURRENT_STAGE="upgrade-migrations"
for migration in "${migrations[@]}"; do
  cp "$PRIVATE_REPO_PATH/$migration" "$upgrade_project/supabase/migrations/"
done
supabase_cli --workdir "$upgrade_project" migration up --local
CURRENT_STAGE="upgrade-status"
upgrade_status="$RUNNER_TEMP/trainingos-learning-assistance-upgrade-status.env"
supabase_cli --workdir "$upgrade_project" status -o env >"$upgrade_status"
upgrade_db_url="$(grep '^DB_URL=' "$upgrade_status" | sed 's/^DB_URL=//' | tr -d '"')"
[[ -n "$upgrade_db_url" ]]
CURRENT_STAGE="upgrade-e2e"
run_e2e "$upgrade_db_url"
CURRENT_STAGE="upgrade-stop"
supabase_cli --workdir "$upgrade_project" stop --no-backup

CURRENT_STAGE="complete"
echo "CHALLENGE_DATABASE status=PASS suite=learning-assistance-governance changed_migrations=${#migrations[@]} generated=$generated_migration_count fresh=PASS second_pass=PASS upgrade=PASS e2e=PASS cleanup=PASS"
