import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PROJECTION_FILES = new Set([
  'docs/architecture/trainingos-learning-content-resolution-db-projection-v1.md',
  'supabase/migrations/20260731100000_trainingos_learning_content_resolution_projection_v1.sql',
  'tests/sql/trainingos_learning_content_resolution_projection_v1_e2e.sql',
  'tests/test_trainingos_learning_content_resolution_projection_v1.py',
]);

const HISTORY_FIX_FILES = new Set([
  'docs/architecture/trainingos-learning-content-resolution-db-projection-v1.md',
  'supabase/migrations/20260731110000_trainingos_lcr_historical_rights_fix_v1.sql',
  'tests/sql/trainingos_learning_content_resolution_projection_v1_e2e.sql',
  'tests/test_trainingos_learning_content_resolution_projection_v1.py',
]);

const VARIANTS = Object.freeze({
  projection: Object.freeze({
    key: 'projection-v1',
    files: PROJECTION_FILES,
    migrationStart: '20260731100000',
    migrationEnd: '20260731100000',
    canonicalMigrationCount: 353,
    pythonCount: 7,
    selectedSuite: 'learning-content-resolution-db',
  }),
  historyFix: Object.freeze({
    key: 'history-fix',
    files: HISTORY_FIX_FILES,
    migrationStart: '20260731110000',
    migrationEnd: '20260731110000',
    canonicalMigrationCount: 354,
    pythonCount: 9,
    selectedSuite: 'learning-content-resolution-db-history-fix',
  }),
});

const SAFE_DATABASE_STAGES = new Set([
  'inputs', 'scope-contract', 'supabase-wrapper',
  'fresh-init', 'fresh-bootstrap', 'fresh-migration-count', 'fresh-start', 'fresh-reset-one', 'fresh-reset-two',
  'fresh-status', 'fresh-sql-e2e', 'fresh-zero-residue', 'fresh-stop',
  'upgrade-worktree', 'upgrade-init', 'upgrade-bootstrap', 'upgrade-migration-count', 'upgrade-start',
  'upgrade-base-reset', 'upgrade-copy-migration', 'upgrade-apply', 'upgrade-status', 'upgrade-sql-e2e',
  'upgrade-zero-residue', 'upgrade-stop', 'complete',
]);

const SAFE_E2E_REASONS = new Set([
  'TRAININGOS_LCR_CLASS_PLAN_REQUIRED',
  'TRAININGOS_LCR_ZERO_WRITE_ASSERTION_FAILED',
  'TRAININGOS_LCR_LOCAL_UNIT_ASSERTION_FAILED',
  'TRAININGOS_LCR_LOCAL_EXERCISE_ASSERTION_FAILED',
  'TRAININGOS_LCR_PARTNER_UNIT_RIGHTS_ASSERTION_FAILED',
  'TRAININGOS_LCR_PARTNER_EXERCISE_RIGHTS_ASSERTION_FAILED',
  'TRAININGOS_LCR_MISSING_PROVENANCE_ASSERTION_FAILED',
  'TRAININGOS_LCR_PURPOSE_MISMATCH_ASSERTION_FAILED',
  'TRAININGOS_LCR_REGION_MISMATCH_ASSERTION_FAILED',
  'TRAININGOS_LCR_MATERIAL_FAIL_CLOSED_ASSERTION_FAILED',
  'TRAININGOS_LCR_SECRET_DISCLOSURE_ASSERTION_FAILED',
  'TRAININGOS_LCR_REVOKED_RIGHTS_ASSERTION_FAILED',
  'TRAININGOS_LCR_STUDENT_DENIAL_ASSERTION_FAILED',
  'TRAININGOS_LCR_CROSS_CLASS_DENIAL_ASSERTION_FAILED',
  'TRAININGOS_LCR_UNRELATED_COURSE_ASSERTION_FAILED',
  'TRAININGOS_LCR_E2E_FIXTURE_USERS_FAILED',
  'TRAININGOS_LCR_E2E_FIXTURE_COURSE_FAILED',
  'TRAININGOS_LCR_E2E_FIXTURE_CONTENT_FAILED',
  'TRAININGOS_LCR_E2E_FIXTURE_MATERIAL_FAILED',
  'TRAININGOS_LCR_E2E_FIXTURE_COMMERCIAL_FAILED',
  'TRAININGOS_LCR_E2E_PARTNER_BINDING_FAILED',
  'TRAININGOS_LCR_E2E_AGREEMENT_FAILED',
  'TRAININGOS_LCR_E2E_SOURCE_FAILED',
  'TRAININGOS_LCR_E2E_REVIEW_REQUEST_FAILED',
  'TRAININGOS_LCR_E2E_REVIEW_APPROVAL_FAILED',
  'TRAININGOS_LCR_E2E_RIGHTS_FAILED',
  'TRAININGOS_LCR_E2E_USAGE_FAILED',
  'TRAININGOS_LCR_E2E_RESOLVE_FAILED',
  'TRAININGOS_LCR_E2E_CONTENT_ASSERTIONS_FAILED',
  'TRAININGOS_LCR_E2E_REVOCATION_FAILED',
  'TRAININGOS_LCR_E2E_ROLE_DENIALS_FAILED',
  'TRAININGOS_LCR_E2E_STAGE_FAILED',
  'TRAININGOS_LCR_HISTORY_ACTIVE_EXACT_RIGHTS_ASSERTION_FAILED',
  'TRAININGOS_LCR_HISTORY_ENDED_AGREEMENT_ASSERTION_FAILED',
  'TRAININGOS_LCR_HISTORY_NO_ACTIVE_ACCOUNT_ASSERTION_FAILED',
  'TRAININGOS_LCR_HISTORY_CROSS_CLASS_ASSERTION_FAILED',
  'TRAININGOS_LCR_HISTORY_OWNER_VERSION_ASSERTION_FAILED',
  'TRAININGOS_LCR_HISTORY_TERMINATED_ASSERTION_FAILED',
  'TRAININGOS_LCR_HISTORY_REPLACED_ACCOUNT_ASSERTION_FAILED',
  'TRAININGOS_LCR_HISTORY_STATUS_ASSERTION_FAILED',
  'TRAININGOS_LCR_HISTORY_SYMMETRY_ASSERTION_FAILED',
  'TRAININGOS_LCR_HISTORY_LOCAL_CONTENT_ASSERTION_FAILED',
]);

const command = (label, executable, args, kind = 'status') => ({ label, executable, args, kind });
const COMMANDS = Object.freeze([
  command('install', 'npm', ['ci']),
  command('python-contract', 'python', ['-m', 'unittest', '-v', 'tests.test_trainingos_learning_content_resolution_projection_v1'], 'python'),
  command('database-replay', 'bash', [path.join(publicRoot, 'scripts/run-learning-content-resolution-db-profile.sh')], 'database'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
]);

function sameFiles(files, expected) {
  return files.length === expected.size && files.every((name) => expected.has(name));
}

export function selectLearningContentResolutionDbVariant(files) {
  const names = [...files].sort();
  if (sameFiles(names, VARIANTS.projection.files)) return VARIANTS.projection;
  if (sameFiles(names, VARIANTS.historyFix.files)) return VARIANTS.historyFix;
  return null;
}

function parsePython(text) {
  return [...text.matchAll(/Ran\s+(\d+)\s+tests?/g)].reduce((sum, match) => sum + Number(match[1]), 0);
}

export function sanitizeDatabaseStage(text) {
  const matches = [...text.matchAll(/LEARNING_CONTENT_RESOLUTION_DB status=FAIL stage=([a-z0-9-]+)/g)];
  const candidate = matches.at(-1)?.[1] ?? 'unknown';
  return SAFE_DATABASE_STAGES.has(candidate) ? candidate : 'unknown';
}

export function sanitizeDatabaseReason(text) {
  const matches = [...text.matchAll(/LEARNING_CONTENT_RESOLUTION_DB status=FAIL stage=[a-z0-9-]+ reason=(TRAININGOS_LCR_[A-Z0-9_]+):([A-Z0-9]{5})/g)];
  const match = matches.at(-1);
  if (!match || !SAFE_E2E_REASONS.has(match[1])) return '';
  return `${match[1]}:${match[2]}`;
}

export function sanitizeDatabaseFailure(text) {
  const stage = sanitizeDatabaseStage(text);
  const reason = sanitizeDatabaseReason(text);
  return reason ? `${stage}:${reason}` : stage;
}

async function exactChangedFiles(input) {
  const scopePath = path.join(input.runnerTemp, 'trainingos-scope-contract.env');
  const scopeText = await readFile(scopePath, 'utf8');
  const scope = Object.fromEntries(scopeText.trim().split('\n').map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const result = spawnSync('git', [
    '-C', input.privateRepoPath, 'diff', '--name-only',
    scope.expected_base_sha, input.privateExactSha,
  ], { encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error('git scope failed');
  return {
    files: result.stdout.trim() ? result.stdout.trim().split('\n').sort() : [],
    scope,
  };
}

function fixedInputContract(input, scope, variant) {
  return Number(input.expectedNodeCount) === 0
    && Number(input.expectedPythonCount) === variant.pythonCount
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(variant.canonicalMigrationCount)
    && scope.expected_changed_file_count === '4'
    && scope.migration_start === variant.migrationStart
    && scope.migration_end === variant.migrationEnd;
}

function failedContractResult(variant) {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract@not-run',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: COMMANDS.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: variant.selectedSuite,
  };
}

export async function maybeRunLearningContentResolutionDbProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  const variant = selectLearningContentResolutionDbVariant(files);
  if (!variant) return null;

  if (!fixedInputContract(input, scope, variant)) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedContractResult(variant);
  }

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let pythonTests = 0;
  let databaseStage = 'not-run';
  const failedLabels = [];

  try {
    for (const [index, item] of COMMANDS.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const result = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: {
          ...process.env,
          PRIVATE_REPO_PATH: input.privateRepoPath,
          PRIVATE_EXACT_SHA: input.privateExactSha,
          EXPECTED_MIGRATION_COUNT: String(variant.canonicalMigrationCount),
          LCR_DB_PROFILE_VARIANT: variant.key,
          RUNNER_TEMP: input.runnerTemp,
        },
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      const output = await readFile(logPath, 'utf8');
      if (item.kind === 'python') pythonTests += parsePython(output);
      if (item.kind === 'database') databaseStage = result.status === 0 ? 'complete' : sanitizeDatabaseFailure(output);
      if (result.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = pythonTests === variant.pythonCount;
  const ok = passedStepCount === COMMANDS.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}@${databaseStage}`,
    failedLabels: Object.freeze(failedLabels),
    stepCount: COMMANDS.length,
    passedStepCount,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests,
    selectedSuite: variant.selectedSuite,
  };
}
