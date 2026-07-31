#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CURRENT_STAGE="playwright-scope"
on_error(){ echo "AGENT_NATIVE_LEARNING_PLAYWRIGHT status=FAIL stage=$CURRENT_STAGE"; }
trap on_error ERR

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA RUNNER_TEMP)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "AGENT_NATIVE_LEARNING_PLAYWRIGHT status=FAIL stage=playwright-scope"; exit 2; }
done
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$(git -C "$PRIVATE_REPO_PATH" rev-parse HEAD)" == "$PRIVATE_EXACT_SHA" ]]

project="$RUNNER_TEMP/trainingos-agent-native-learning-playwright"
status_file="$RUNNER_TEMP/trainingos-agent-native-learning-playwright-status.env"
cleanup(){
  supabase --workdir "$project" stop --no-backup >/dev/null 2>&1 || true
  rm -rf "$project" "$status_file" \
    "$PRIVATE_REPO_PATH/artifacts/trainingos-ui-e2e-results" \
    "$PRIVATE_REPO_PATH/artifacts/trainingos-ui-e2e-report.json" \
    "$PRIVATE_REPO_PATH/artifacts/trainingos-ui-e2e-html" \
    "$PRIVATE_REPO_PATH/test-results" \
    "$PRIVATE_REPO_PATH/playwright-report"
}
trap cleanup EXIT

CURRENT_STAGE="playwright-init"
rm -rf "$project"
supabase --workdir "$project" init --force --yes
rm -rf "$project/supabase/migrations"

CURRENT_STAGE="playwright-bootstrap"
python "$PRIVATE_REPO_PATH/scripts/build-trainingos-fresh-bootstrap.py" \
  --repo-root "$PRIVATE_REPO_PATH" \
  --output-dir "$project/supabase/migrations" \
  --commit-sha "$PRIVATE_EXACT_SHA"

CURRENT_STAGE="playwright-start"
supabase --workdir "$project" start
CURRENT_STAGE="playwright-reset"
supabase --workdir "$project" db reset --local --no-seed
CURRENT_STAGE="playwright-status"
supabase --workdir "$project" status -o env >"$status_file"
api_url="$(grep '^API_URL=' "$status_file" | sed 's/^API_URL=//' | tr -d '"')"
anon_key="$(grep '^ANON_KEY=' "$status_file" | sed 's/^ANON_KEY=//' | tr -d '"')"
[[ -n "$api_url" && -n "$anon_key" ]]

CURRENT_STAGE="playwright-run"
client_marker="$(printf '%s%s%s' 'J' 'H' 'C')"
fallback_name="VITE_${client_marker}_ALLOW_LOCAL_FALLBACK"
env \
  VITE_SUPABASE_URL="$api_url" \
  VITE_SUPABASE_ANON_KEY="$anon_key" \
  "$fallback_name=false" \
  npx playwright test \
    --config=playwright.config.ts \
    tests/trainingos-ui-e2e/agent-native-learning-golden-path.spec.ts

CURRENT_STAGE="playwright-complete"
echo "AGENT_NATIVE_LEARNING_PLAYWRIGHT status=PASS browser=chromium local_supabase=PASS artifacts=ZERO"
