#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA EXPECTED_MIGRATION_COUNT RUNNER_TEMP)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "LEARNING_CONTENT_RESOLUTION_DB status=FAIL stage=inputs"; exit 2; }
done

scope_file="$RUNNER_TEMP/trainingos-scope-contract.env"
[[ -f "$scope_file" ]] || { echo "LEARNING_CONTENT_RESOLUTION_DB status=FAIL stage=scope-file"; exit 2; }
read_scope(){ awk -F= -v wanted="$1" '$1 == wanted { print substr($0,index($0,"=")+1); exit }' "$scope_file"; }
expected_base_sha="$(read_scope expected_base_sha)"
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ && "$expected_base_sha" =~ ^[0-9a-f]{40}$ ]]
[[ "$EXPECTED_MIGRATION_COUNT" == 353 ]]

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

run_e2e(){
  local workdir="$1" label="$2" status_file db_url residue
  status_file="$RUNNER_TEMP/trainingos-learning-content-resolution-${label}.env"
  supabase --workdir "$workdir" status -o env >"$status_file" 2>&1
  db_url="$(grep '^DB_URL=' "$status_file" | sed 's/^DB_URL=//' | tr -d '"')"
  [[ -n "$db_url" ]]
  sealed "${label}-sql-e2e" psql "$db_url" -X -v ON_ERROR_STOP=1 \
    -f "$PRIVATE_REPO_PATH/tests/sql/trainingos_learning_content_resolution_projection_v1_e2e.sql"
  grep -q 'PASS' "$RUNNER_TEMP/trainingos-learning-content-resolution-${label}-sql-e2e.log"
  residue="$(psql "$db_url" -X -At -v ON_ERROR_STOP=1 -c "select count(*) from public.profiles where id::text like '8a010000-%'" 2>/dev/null)"
  [[ "$residue" == 0 ]]
}

# Fresh full-history replay, repeated twice.
rm -rf "$fresh"
sealed fresh-init supabase --workdir "$fresh" init --force --yes
rm -rf "$fresh/supabase/migrations"
sealed fresh-bootstrap python "$PRIVATE_REPO_PATH/scripts/build-trainingos-fresh-bootstrap.py" \
  --repo-root "$PRIVATE_REPO_PATH" \
  --output-dir "$fresh/supabase/migrations" \
  --commit-sha "$PRIVATE_EXACT_SHA"
[[ "$(manifest_count "$fresh/supabase/trainingos-bootstrap-manifest.json")" == 353 ]]
sealed fresh-start supabase --workdir "$fresh" start
sealed fresh-reset-one supabase --workdir "$fresh" db reset --local --no-seed
sealed fresh-reset-two supabase --workdir "$fresh" db reset --local --no-seed
run_e2e "$fresh" fresh
sealed fresh-stop supabase --workdir "$fresh" stop --no-backup

# Exact-base existing-project upgrade replay.
rm -rf "$upgrade" "$base_worktree"
sealed upgrade-worktree git -C "$PRIVATE_REPO_PATH" worktree add --detach "$base_worktree" "$expected_base_sha"
sealed upgrade-init supabase --workdir "$upgrade" init --force --yes
rm -rf "$upgrade/supabase/migrations"
sealed upgrade-bootstrap python "$base_worktree/scripts/build-trainingos-fresh-bootstrap.py" \
  --repo-root "$base_worktree" \
  --output-dir "$upgrade/supabase/migrations" \
  --commit-sha "$expected_base_sha"
[[ "$(manifest_count "$upgrade/supabase/trainingos-bootstrap-manifest.json")" == 352 ]]
sealed upgrade-start supabase --workdir "$upgrade" start
sealed upgrade-base-reset supabase --workdir "$upgrade" db reset --local --no-seed
cp "$PRIVATE_REPO_PATH/supabase/migrations/20260731100000_trainingos_learning_content_resolution_projection_v1.sql" \
  "$upgrade/supabase/migrations/"
sealed upgrade-apply supabase --workdir "$upgrade" migration up --local
run_e2e "$upgrade" upgrade
sealed upgrade-stop supabase --workdir "$upgrade" stop --no-backup

echo "LEARNING_CONTENT_RESOLUTION_DB status=PASS canonical_migrations=353 fresh=PASS second_replay=PASS upgrade=PASS sql_e2e=PASS zero_residue=PASS"
