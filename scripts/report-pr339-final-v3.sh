#!/usr/bin/env bash
set -euo pipefail

STATUS_DIR="$RUNNER_TEMP/pr339-status"
read_status() {
  local name="$1"
  if [[ -f "$STATUS_DIR/$name" ]]; then
    tr '\n' ' ' < "$STATUS_DIR/$name" | sed 's/[[:space:]]*$//'
  else
    printf 'NOT_RUN'
  fi
}

for name in \
  exact node python install typecheck vscode workspace zero_permission build review \
  db_first db_second db_acl exercise_e2e assessment_e2e result_e2e
do
  value="$(read_status "$name")"
  printf '%s=%s\n' "$name" "$value" >> "$GITHUB_OUTPUT"
done
