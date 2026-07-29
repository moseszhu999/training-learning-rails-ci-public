#!/usr/bin/env bash
set -euo pipefail
umask 077

mode="${1:-all}"
case "$mode" in
  preflight|fresh|upgrade|all) ;;
  *) echo 'CHALLENGE_DATABASE status=FAIL reason=invalid-mode'; exit 2 ;;
esac

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA EXPECTED_MIGRATION_COUNT RUNNER_TEMP)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo 'CHALLENGE_DATABASE status=FAIL reason=missing-input'; exit 2; }
done

scope_file="$RUNNER_TEMP/trainingos-scope-contract.env"
[[ -f "$scope_file" ]] || { echo 'CHALLENGE_DATABASE status=FAIL reason=missing-scope'; exit 2; }

read_scope() {
  local key="$1"
  awk -F= -v wanted="$key" '$1 == wanted { print substr($0, index($0, "=") + 1); exit }' "$scope_file"
}

expected_base_sha="$(read_scope expected_base_sha)"
expected_changed_file_count="$(read_scope expected_changed_file_count)"
migration_start="$(read_scope migration_start)"
migration_end="$(read_scope migration_end)"
profile="$(read_scope validation_profile)"

[[ "$profile" == challenge-runtime ]]
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$expected_base_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$expected_changed_file_count" =~ ^(0|[1-9][0-9]{0,5})$ ]]
[[ "$migration_start" =~ ^[0-9]{14}$ ]]
[[ "$migration_end" =~ ^[0-9]{14}$ ]]
[[ "$EXPECTED_MIGRATION_COUNT" =~ ^[1-9][0-9]{0,5}$ ]]

fresh_project="$RUNNER_TEMP/trainingos-challenge-fresh"
upgrade_project="$RUNNER_TEMP/trainingos-challenge-upgrade"
base_worktree="$RUNNER_TEMP/trainingos-challenge-base"
runner_sql="$PRIVATE_REPO_PATH/tests/sql/trainingos_challenge_runtime_v1_e2e_runner.sql"

cleanup() {
  supabase --workdir "$fresh_project" stop --no-backup >/dev/null 2>&1 || true
  supabase --workdir "$upgrade_project" stop --no-backup >/dev/null 2>&1 || true
  git -C "$PRIVATE_REPO_PATH" worktree remove --force "$base_worktree" >/dev/null 2>&1 || true
  rm -rf "$fresh_project" "$upgrade_project" "$base_worktree"
  rm -f "$RUNNER_TEMP"/trainingos-challenge-*-status.env
}
trap cleanup EXIT

expected_migrations=(
  supabase/migrations/20260729200000_trainingos_challenge_runtime_v1_schema.sql
  supabase/migrations/20260729200100_trainingos_challenge_runtime_v1_evidence_review_schema.sql
  supabase/migrations/20260729201000_trainingos_challenge_runtime_v1_private_helpers.sql
  supabase/migrations/20260729202000_trainingos_challenge_runtime_v1_teacher_rpc.sql
  supabase/migrations/20260729203000_trainingos_challenge_runtime_v1_learner_rpc.sql
  supabase/migrations/20260729204000_trainingos_challenge_runtime_v1_review_rpc.sql
  supabase/migrations/20260729205000_trainingos_challenge_runtime_v1_check_result_acl.sql
  supabase/migrations/20260729205100_trainingos_challenge_runtime_v1_private_acl.sql
)

preflight() {
  [[ "$(git -C "$PRIVATE_REPO_PATH" rev-parse HEAD)" == "$PRIVATE_EXACT_SHA" ]]
  [[ "$(git -C "$PRIVATE_REPO_PATH" merge-base "$expected_base_sha" "$PRIVATE_EXACT_SHA")" == "$expected_base_sha" ]]
  local actual_count
  actual_count="$(git -C "$PRIVATE_REPO_PATH" diff --name-only "$expected_base_sha" "$PRIVATE_EXACT_SHA" | sed '/^$/d' | wc -l | tr -d ' ')"
  [[ "$actual_count" == "$expected_changed_file_count" ]]
  [[ -f "$runner_sql" ]]
  grep -Eiq '^[[:space:]]*rollback;' "$runner_sql"

  mapfile -t migrations < <(
    git -C "$PRIVATE_REPO_PATH" diff --name-only "$expected_base_sha" "$PRIVATE_EXACT_SHA" -- supabase/migrations |
      grep -E '^supabase/migrations/[0-9]{14}_trainingos_challenge_runtime_v1_[^/]+\.sql$' |
      sort
  )
  [[ "${#migrations[@]}" == "${#expected_migrations[@]}" ]]
  [[ "$(printf '%s\n' "${migrations[@]}")" == "$(printf '%s\n' "${expected_migrations[@]}")" ]]
  for migration in "${migrations[@]}"; do
    local stamp
    stamp="$(basename "$migration" | cut -c1-14)"
    [[ "$stamp" -ge "$migration_start" && "$stamp" -le "$migration_end" ]]
  done
  echo "CHALLENGE_DATABASE stage=preflight status=PASS migrations=${#migrations[@]}"
}

fresh_replay() {
  rm -rf "$fresh_project"
  supabase --workdir "$fresh_project" init --force --yes
  rm -rf "$fresh_project/supabase/migrations"
  python "$PRIVATE_REPO_PATH/scripts/build-trainingos-fresh-bootstrap.py" \
    --repo-root "$PRIVATE_REPO_PATH" \
    --output-dir "$fresh_project/supabase/migrations" \
    --commit-sha "$PRIVATE_EXACT_SHA"
  python - "$fresh_project/supabase/trainingos-bootstrap-manifest.json" "$EXPECTED_MIGRATION_COUNT" <<'PY'
import json, pathlib, sys
manifest=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
raise SystemExit(0 if int(manifest.get('migrationCount', -1)) == int(sys.argv[2]) else 1)
PY
  supabase --workdir "$fresh_project" start
  supabase --workdir "$fresh_project" db reset --local --no-seed
  local fresh_status fresh_db_url
  fresh_status="$RUNNER_TEMP/trainingos-challenge-fresh-status.env"
  supabase --workdir "$fresh_project" status -o env >"$fresh_status"
  fresh_db_url="$(grep '^DB_URL=' "$fresh_status" | sed 's/^DB_URL=//' | tr -d '"')"
  [[ -n "$fresh_db_url" ]]
  psql "$fresh_db_url" -X -v ON_ERROR_STOP=1 -f "$runner_sql"
  supabase --workdir "$fresh_project" stop --no-backup
  rm -rf "$fresh_project"
  echo 'CHALLENGE_DATABASE stage=fresh status=PASS first=PASS second=PASS e2e=PASS cleanup=PASS'
}

upgrade_replay() {
  rm -rf "$upgrade_project" "$base_worktree"
  git -C "$PRIVATE_REPO_PATH" worktree add --detach "$base_worktree" "$expected_base_sha"
  supabase --workdir "$upgrade_project" init --force --yes
  rm -rf "$upgrade_project/supabase/migrations"
  python "$base_worktree/scripts/build-trainingos-fresh-bootstrap.py" \
    --repo-root "$base_worktree" \
    --output-dir "$upgrade_project/supabase/migrations" \
    --commit-sha "$expected_base_sha"
  supabase --workdir "$upgrade_project" start
  for migration in "${expected_migrations[@]}"; do
    cp "$PRIVATE_REPO_PATH/$migration" "$upgrade_project/supabase/migrations/"
  done
  supabase --workdir "$upgrade_project" migration up --local
  local upgrade_status upgrade_db_url
  upgrade_status="$RUNNER_TEMP/trainingos-challenge-upgrade-status.env"
  supabase --workdir "$upgrade_project" status -o env >"$upgrade_status"
  upgrade_db_url="$(grep '^DB_URL=' "$upgrade_status" | sed 's/^DB_URL=//' | tr -d '"')"
  [[ -n "$upgrade_db_url" ]]
  psql "$upgrade_db_url" -X -v ON_ERROR_STOP=1 -f "$runner_sql"
  supabase --workdir "$upgrade_project" stop --no-backup
  git -C "$PRIVATE_REPO_PATH" worktree remove --force "$base_worktree"
  rm -rf "$upgrade_project" "$base_worktree"
  echo 'CHALLENGE_DATABASE stage=upgrade status=PASS migration_up=PASS e2e=PASS cleanup=PASS'
}

case "$mode" in
  preflight)
    preflight
    ;;
  fresh)
    preflight
    fresh_replay
    ;;
  upgrade)
    preflight
    upgrade_replay
    ;;
  all)
    preflight
    fresh_replay
    upgrade_replay
    ;;
esac
