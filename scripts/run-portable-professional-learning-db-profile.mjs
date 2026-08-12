import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PORTABLE_PROFESSIONAL_LEARNING_DB_RUNNER = path.join(
  publicRoot,
  'scripts/run-portable-professional-learning-db-profile.sh',
);

export const PORTABLE_PROFESSIONAL_LEARNING_DB_EXACT_FILES = new Set([
  'docs/architecture/trainingos-portable-professional-learning-state-v1.md',
  'supabase/migrations/20260812200600_trainingos_portable_professional_learning_state_v1.sql',
  'supabase/migrations/20260812200700_trainingos_portable_professional_learning_state_v1_hardening.sql',
  'tests/sql/trainingos_portable_professional_learning_state_v1_e2e.sql',
  'tests/training-portable-professional-learning-state-v1.test.mjs',
]);

const EXPECTED_NODE_COUNT = 17;
const EXPECTED_PYTHON_COUNT = 0;
const EXPECTED_CHANGED_FILE_COUNT = 5;
const EXPECTED_MIGRATION_COUNT = 380;
const MIGRATION_START = '20260812200600';
const MIGRATION_END = '20260812200700';
const SAFE_STATUS_BASENAME = 'trainingos-portable-professional-learning-db-safe-status.txt';

const SAFE_DATABASE_STAGES = new Set([
  'inputs', 'scope-contract', 'supabase-wrapper',
  'fresh-init', 'fresh-bootstrap', 'fresh-migration-count', 'fresh-start',
  'fresh-reset-one', 'fresh-reset-two', 'fresh-status', 'fresh-sql-e2e',
  'fresh-zero-residue', 'fresh-stop',
  'upgrade-worktree', 'upgrade-init', 'upgrade-bootstrap', 'upgrade-migration-count',
  'upgrade-start', 'upgrade-base-reset', 'upgrade-copy-migrations', 'upgrade-apply',
  'upgrade-status', 'upgrade-sql-e2e', 'upgrade-zero-residue', 'upgrade-stop',
  'complete',
]);

const command = (label, executable, args, kind = 'status', env = {}) => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
  env: Object.freeze(env),
});

export const portableProfessionalLearningDbCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('focused-node-contracts', 'node', [
    '--test', 'tests/training-portable-professional-learning-state-v1.test.mjs',
  ], 'node'),
  command('db-runner-shell-syntax', 'bash', ['-n', PORTABLE_PROFESSIONAL_LEARNING_DB_RUNNER]),
  command('db-runner-shellcheck', 'shellcheck', [PORTABLE_PROFESSIONAL_LEARNING_DB_RUNNER]),
  command('database-replay', 'bash', [PORTABLE_PROFESSIONAL_LEARNING_DB_RUNNER], 'database'),
  command('repository-typecheck', 'npm', ['run', 'typecheck']),
  command('direct-vite-production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('postbuild-copy', 'node', ['scripts/copy-trainingos-marketplace-web.mjs']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

const sumMatches = (text, regex) => [...String(text).matchAll(regex)]
  .reduce((sum, match) => sum + Number(match[1]), 0);

async function exactChangedFiles(input) {
  const scopePath = path.join(input.runnerTemp, 'trainingos-scope-contract.env');
  const scopeText = await readFile(scopePath, 'utf8');
  const scope = Object.fromEntries(scopeText.trim().split('\n').map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const result = spawnSync('git', [
    '-C', input.privateRepoPath,
    'diff', '--name-only', scope.expected_base_sha, input.privateExactSha,
  ], { encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error('git scope failed');
  return {
    files: result.stdout.trim() ? result.stdout.trim().split('\n').sort() : [],
    scope,
  };
}

export function isPortableProfessionalLearningDbScope(files) {
  const names = [...files];
  return names.length === PORTABLE_PROFESSIONAL_LEARNING_DB_EXACT_FILES.size
    && names.every((name) => PORTABLE_PROFESSIONAL_LEARNING_DB_EXACT_FILES.has(name));
}

export function sanitizePortableProfessionalLearningDatabaseStatusFile(text) {
  const entries = Object.fromEntries(
    String(text).split(/\r?\n/).filter(Boolean).map((line) => {
      const index = line.indexOf('=');
      return index > 0 ? [line.slice(0, index), line.slice(index + 1)] : ['', ''];
    }).filter(([key]) => key === 'stage'),
  );
  return SAFE_DATABASE_STAGES.has(entries.stage) ? entries.stage : 'unknown';
}

function failedResult(reason) {
  return {
    ok: false,
    status: `FAIL:${reason}`,
    failedLabels: Object.freeze([reason]),
    stepCount: portableProfessionalLearningDbCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'portable-professional-learning-db',
  };
}

export async function maybeRunPortableProfessionalLearningDbProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isPortableProfessionalLearningDbScope(files)) return null;

  const fixedInputs = Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(EXPECTED_MIGRATION_COUNT)
    && scope.expected_changed_file_count === String(EXPECTED_CHANGED_FILE_COUNT)
    && scope.migration_start === MIGRATION_START
    && scope.migration_end === MIGRATION_END;
  if (!fixedInputs) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedResult('fixed-input-contract');
  }

  await mkdir(input.runnerTemp, { recursive: true });
  const safeStatusPath = path.join(input.runnerTemp, SAFE_STATUS_BASENAME);
  let passedStepCount = 0;
  let nodeTests = 0;
  let nodePassed = 0;
  let nodeFailed = 0;
  let databaseStage = 'not-run';
  const failedLabels = [];

  try {
    for (const [index, item] of portableProfessionalLearningDbCommands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      if (item.kind === 'database') await rm(safeStatusPath, { force: true });
      const result = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: {
          ...process.env,
          ...item.env,
          ...(item.kind === 'database'
            ? {
                PRIVATE_REPO_PATH: input.privateRepoPath,
                PRIVATE_EXACT_SHA: input.privateExactSha,
                EXPECTED_MIGRATION_COUNT: String(EXPECTED_MIGRATION_COUNT),
                RUNNER_TEMP: input.runnerTemp,
                TRAININGOS_PORTABLE_PROFESSIONAL_LEARNING_DB_SAFE_STATUS_FILE: safeStatusPath,
              }
            : {}),
        },
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      const output = await readFile(logPath, 'utf8');
      if (item.kind === 'node') {
        nodeTests += sumMatches(output, /^# tests\s+(\d+)$/gm);
        nodePassed += sumMatches(output, /^# pass\s+(\d+)$/gm);
        nodeFailed += sumMatches(output, /^# fail\s+(\d+)$/gm);
      }
      if (item.kind === 'database') {
        if (result.status === 0) databaseStage = 'complete';
        else {
          const safeText = await readFile(safeStatusPath, 'utf8').catch(() => '');
          databaseStage = sanitizePortableProfessionalLearningDatabaseStatusFile(safeText);
        }
      }
      if (result.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    await rm(safeStatusPath, { force: true });
  }

  const countsPassed = nodeTests === EXPECTED_NODE_COUNT
    && nodePassed === EXPECTED_NODE_COUNT
    && nodeFailed === 0;
  const stepCount = portableProfessionalLearningDbCommands.length;
  const ok = passedStepCount === stepCount && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}@${databaseStage}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests: 0,
    selectedSuite: 'portable-professional-learning-db',
  };
}
