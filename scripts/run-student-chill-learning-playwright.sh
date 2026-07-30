#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

CURRENT_STAGE="playwright-scope"
on_error(){ echo "STUDENT_CHILL_PLAYWRIGHT status=FAIL stage=$CURRENT_STAGE"; }
trap on_error ERR

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA RUNNER_TEMP)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "STUDENT_CHILL_PLAYWRIGHT status=FAIL stage=playwright-scope"; exit 2; }
done
[[ "$PRIVATE_EXACT_SHA" =~ ^[0-9a-f]{40}$ ]]
[[ "$(git -C "$PRIVATE_REPO_PATH" rev-parse HEAD)" == "$PRIVATE_EXACT_SHA" ]]

workdir="$RUNNER_TEMP/trainingos-student-chill-playwright"
cleanup(){
  rm -rf "$workdir" \
    "$PRIVATE_REPO_PATH/artifacts/trainingos-ui-e2e-results" \
    "$PRIVATE_REPO_PATH/artifacts/trainingos-ui-e2e-report.json" \
    "$PRIVATE_REPO_PATH/artifacts/trainingos-ui-e2e-html" \
    "$PRIVATE_REPO_PATH/test-results" \
    "$PRIVATE_REPO_PATH/playwright-report"
}
trap cleanup EXIT
rm -rf "$workdir"
mkdir -p "$workdir"

CURRENT_STAGE="playwright-browser"
(
  cd "$PRIVATE_REPO_PATH"
  npx playwright install --with-deps chromium
)

CURRENT_STAGE="playwright-run"
(
  cd "$PRIVATE_REPO_PATH"
  env \
    VITE_SUPABASE_URL="http://127.0.0.1:54321" \
    VITE_SUPABASE_ANON_KEY="public-ci-mock-only-anon-key" \
    VITE_JHC_ALLOW_LOCAL_FALLBACK="false" \
    npx playwright test \
      tests/trainingos-ui-e2e/student-chill-learning-shell-v1.spec.ts \
      --config=playwright.config.ts \
      --reporter=line \
      --output="$workdir/results"
)

CURRENT_STAGE="playwright-complete"
echo "STUDENT_CHILL_PLAYWRIGHT status=PASS browser=chromium mock_only=PASS artifacts=ZERO"
