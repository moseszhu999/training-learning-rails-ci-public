#!/usr/bin/env bash
set -uo pipefail

required=(PRIVATE_REPO_PATH PRIVATE_EXACT_SHA EXPECTED_MIGRATION_COUNT RUNNER_TEMP MAIN_RELEASE_DATABASE_OUTPUT RUN_FRESH_REPLAY RUN_UPGRADE_REPLAY RUN_CRITICAL_E2E)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || { echo "missing required environment" >&2; exit 2; }
done

fresh=NOT_RUN
second_pass=NOT_RUN
upgrade=NOT_RUN
canonical_db=NOT_RUN
role_permission=NOT_RUN
teacher_student_e2e=NOT_RUN
zero_residue=NOT_RUN
migration_count=0
migration_fingerprint=NOT_RUN
first_migration=NOT_RUN
last_migration=NOT_RUN
failure_class=NONE
failure_stage=NONE

sealed() {
  local label="$1"; shift
  local log="$RUNNER_TEMP/trainingos-main-release-${label}.log"
  umask 077
  "$@" >"$log" 2>&1
}

classify_log() {
  local log="$1"
  if grep -Eiq 'vercel.*(free.?tier|deployment).*(rate.?limit|too many|limit exceeded)|docker.*(daemon unavailable|cannot connect|connection refused|timed out)|supabase.*(rate.?limit|timed out)|no space left on device|ENOSPC|temporary failure in name resolution|network is unreachable' "$log" 2>/dev/null; then
    printf '%s' INFRASTRUCTURE_BLOCKED
  else
    printf '%s' BASELINE_FAILURE
  fi
}

record_failure() {
  local stage="$1" log="$2" class
  class="$(classify_log "$log")"
  if [[ "$class" == INFRASTRUCTURE_BLOCKED && "$failure_class" != INFRASTRUCTURE_BLOCKED ]]; then
    failure_class=INFRASTRUCTURE_BLOCKED
    failure_stage="$stage"
  elif [[ "$failure_class" == NONE ]]; then
    failure_class="$class"
    failure_stage="$stage"
  fi
}

fresh_workdir="$RUNNER_TEMP/trainingos-main-release-fresh"
upgrade_workdir="$RUNNER_TEMP/trainingos-main-release-upgrade"
previous_worktree="$RUNNER_TEMP/trainingos-main-release-previous-main"

cleanup() {
  supabase --workdir "$upgrade_workdir" stop --no-backup >/dev/null 2>&1 || true
  git -C "$PRIVATE_REPO_PATH" worktree remove --force "$previous_worktree" >/dev/null 2>&1 || true
  rm -rf "$previous_worktree"
}
trap cleanup EXIT

if [[ "$RUN_FRESH_REPLAY" == true ]]; then
  rm -rf "$fresh_workdir"
  log="$RUNNER_TEMP/trainingos-main-release-fresh-replay.log"
  umask 077
  if TRAININGOS_SOURCE_SHA="$PRIVATE_EXACT_SHA" \
     TRAININGOS_BOOTSTRAP_WORKDIR="$fresh_workdir" \
     TRAININGOS_KEEP_BOOTSTRAP_WORKDIR=1 \
     bash "$PRIVATE_REPO_PATH/scripts/run-trainingos-fresh-database-replay.sh" >"$log" 2>&1; then
    parse_out="$RUNNER_TEMP/trainingos-main-release-fresh-parsed.env"
    if python - "$fresh_workdir/trainingos-replay-status/result.json" "$fresh_workdir/supabase/trainingos-bootstrap-manifest.json" "$fresh_workdir/trainingos-replay-status/deterministicReplayRepeat.status" "$EXPECTED_MIGRATION_COUNT" "$parse_out" <<'PY'
import json, pathlib, sys
result=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
manifest=json.loads(pathlib.Path(sys.argv[2]).read_text(encoding='utf-8'))
repeat=pathlib.Path(sys.argv[3]).read_text(encoding='utf-8').strip()
expected=int(sys.argv[4])
stages=result.get('stages') or {}
count=int(manifest.get('migrationCount', -1))
fresh = result.get('status') == 'PASS' and stages.get('bootstrapBuild') == 'PASS' and stages.get('fullHistoryPass1') == 'PASS'
second = stages.get('cleanup') == 'PASS' and stages.get('fullHistoryPass2') == 'PASS' and repeat == 'PASS'
count_ok = count == expected
lines = {
  'fresh': 'PASS' if fresh else 'FAIL',
  'second_pass': 'PASS' if second else 'FAIL',
  'canonical_db': 'PASS' if fresh and second and count_ok else 'FAIL',
  'count_match': 'PASS' if count_ok else 'FAIL',
  'migration_count': str(count),
  'first_migration': str(manifest.get('firstMigration', 'NOT_RUN')),
  'last_migration': str(manifest.get('lastMigration', 'NOT_RUN')),
}
pathlib.Path(sys.argv[5]).write_text('\n'.join(f'{k}={v}' for k,v in lines.items())+'\n', encoding='utf-8')
raise SystemExit(0 if fresh and second and count_ok else 1)
PY
    then
      # shellcheck disable=SC1090
      source "$parse_out"
      fingerprint_source="$RUNNER_TEMP/trainingos-main-release-migration-fingerprint.txt"
      find "$fresh_workdir/supabase/migrations" -type f -name '*.sql' -print0 | sort -z | xargs -0 sha256sum >"$fingerprint_source"
      migration_fingerprint="$(sha256sum "$fingerprint_source" | awk '{print $1}')"
    else
      # shellcheck disable=SC1090
      [[ -f "$parse_out" ]] && source "$parse_out"
      if [[ "${count_match:-NOT_RUN}" == FAIL && "${fresh:-NOT_RUN}" == PASS && "${second_pass:-NOT_RUN}" == PASS ]]; then
        failure_class=FAIL
        failure_stage='migration-count-contract'
      else
        record_failure fresh-database-replay "$log"
      fi
    fi
  else
    fresh=FAIL
    second_pass=NOT_RUN
    canonical_db=FAIL
    record_failure fresh-database-replay "$log"
  fi
fi

if [[ "$RUN_UPGRADE_REPLAY" == true ]]; then
  rm -rf "$upgrade_workdir" "$previous_worktree"
  previous_main="$(git -C "$PRIVATE_REPO_PATH" rev-parse "${PRIVATE_EXACT_SHA}^1" 2>/dev/null || true)"
  log="$RUNNER_TEMP/trainingos-main-release-upgrade-replay.log"
  if [[ "$previous_main" =~ ^[0-9a-f]{40}$ ]] && \
     sealed previous-worktree git -C "$PRIVATE_REPO_PATH" worktree add --detach "$previous_worktree" "$previous_main" && \
     mkdir -p "$upgrade_workdir" && \
     sealed upgrade-init supabase --workdir "$upgrade_workdir" init --force --yes && \
     rm -rf "$upgrade_workdir/supabase/migrations" && \
     sealed upgrade-bootstrap python "$previous_worktree/scripts/build-trainingos-fresh-bootstrap.py" --repo-root "$previous_worktree" --output-dir "$upgrade_workdir/supabase/migrations" --commit-sha "$previous_main" && \
     sealed upgrade-start supabase --workdir "$upgrade_workdir" start; then
    while IFS= read -r migration; do
      [[ -z "$migration" ]] && continue
      cp "$PRIVATE_REPO_PATH/$migration" "$upgrade_workdir/supabase/migrations/"
    done < <(git -C "$PRIVATE_REPO_PATH" diff --name-only "$previous_main" "$PRIVATE_EXACT_SHA" -- supabase/migrations | grep -E '^supabase/migrations/[0-9]{14}_[^/]+\.sql$' || true)
    if sealed upgrade-apply supabase --workdir "$upgrade_workdir" migration up --local; then
      upgrade=PASS
    else
      upgrade=FAIL
      record_failure existing-project-upgrade "$RUNNER_TEMP/trainingos-main-release-upgrade-apply.log"
    fi
  else
    upgrade=FAIL
    record_failure existing-project-upgrade "$log"
  fi
fi

if [[ "$RUN_CRITICAL_E2E" == true ]]; then
  if [[ "$upgrade" == PASS ]]; then
    status_log="$RUNNER_TEMP/trainingos-main-release-db-status.log"
    if supabase --workdir "$upgrade_workdir" status -o env >"$status_log" 2>&1; then
      DB_URL="$(grep '^DB_URL=' "$status_log" | sed 's/^DB_URL=//' | tr -d '"')"
    else
      DB_URL=''
    fi
    if [[ -n "$DB_URL" ]]; then
      compat_log="$RUNNER_TEMP/trainingos-main-release-compatibility.log"
      agent_log="$RUNNER_TEMP/trainingos-main-release-teacher-agent.log"
      queue_log="$RUNNER_TEMP/trainingos-main-release-teacher-queue.log"
      student_log="$RUNNER_TEMP/trainingos-main-release-student-learning.log"
      if psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$PRIVATE_REPO_PATH/tests/sql/trainingos_full_history_replay_compatibility_e2e.sql" >"$compat_log" 2>&1 && \
         grep -q '"status": "PASS"' "$compat_log" && \
         grep -q '"aclUnchanged": true' "$compat_log" && \
         grep -q '"fixtureCleanup": "PASS"' "$compat_log" && \
         grep -q '"remainingRepresentativeProfiles": 0' "$compat_log" && \
         psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$PRIVATE_REPO_PATH/tests/sql/trainingos_persistent_teacher_agent_e2e.sql" >"$agent_log" 2>&1 && \
         psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$PRIVATE_REPO_PATH/tests/sql/trainingos_classroom_agent_queue_integration_e2e.sql" >"$queue_log" 2>&1 && \
         psql "$DB_URL" -X -v ON_ERROR_STOP=1 -f "$PRIVATE_REPO_PATH/tests/sql/trainingos_student_learning_canonical_reconciliation_e2e.sql" >"$student_log" 2>&1; then
        role_permission=PASS
        teacher_student_e2e=PASS
        residue="$(psql "$DB_URL" -X -At -v ON_ERROR_STOP=1 -c "select count(*) from public.profiles where id::text like '35500000-%'" 2>/dev/null || echo 1)"
        if [[ "$residue" == 0 ]] && \
           grep -Eiq '^[[:space:]]*rollback;' "$PRIVATE_REPO_PATH/tests/sql/trainingos_persistent_teacher_agent_e2e.sql" && \
           grep -Eiq '^[[:space:]]*rollback;' "$PRIVATE_REPO_PATH/tests/sql/trainingos_classroom_agent_queue_integration_e2e.sql" && \
           grep -Eiq '^[[:space:]]*rollback;' "$PRIVATE_REPO_PATH/tests/sql/trainingos_student_learning_canonical_reconciliation_e2e.sql"; then
          zero_residue=PASS
        else
          zero_residue=FAIL
          failure_stage=zero-residue
          failure_class=BASELINE_FAILURE
        fi
      else
        role_permission=FAIL
        teacher_student_e2e=FAIL
        zero_residue=NOT_RUN
        record_failure critical-e2e "$compat_log"
      fi
    else
      role_permission=FAIL
      teacher_student_e2e=FAIL
      record_failure critical-e2e "$status_log"
    fi
  else
    role_permission=NOT_RUN
    teacher_student_e2e=NOT_RUN
    zero_residue=NOT_RUN
  fi
fi

umask 077
cat >"$MAIN_RELEASE_DATABASE_OUTPUT" <<OUT
fresh_replay=$fresh
second_pass=$second_pass
upgrade_replay=$upgrade
canonical_database_contracts=$canonical_db
role_permission_contracts=$role_permission
teacher_student_e2e=$teacher_student_e2e
zero_residue=$zero_residue
migration_count=$migration_count
migration_fingerprint=$migration_fingerprint
first_migration=$first_migration
last_migration=$last_migration
failure_class=$failure_class
failure_stage=$failure_stage
OUT

if [[ "$failure_class" != NONE ]]; then
  exit 1
fi
