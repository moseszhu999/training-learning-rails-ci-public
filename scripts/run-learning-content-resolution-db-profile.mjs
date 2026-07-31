import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXACT_FILES = new Set([
  'docs/architecture/trainingos-learning-content-resolution-db-projection-v1.md',
  'supabase/migrations/20260731100000_trainingos_learning_content_resolution_projection_v1.sql',
  'tests/sql/trainingos_learning_content_resolution_projection_v1_e2e.sql',
  'tests/test_trainingos_learning_content_resolution_projection_v1.py',
]);
const SAFE_DATABASE_STAGES = new Set([
  'inputs','scope-contract','supabase-wrapper',
  'fresh-init','fresh-bootstrap','fresh-migration-count','fresh-start','fresh-reset-one','fresh-reset-two',
  'fresh-status','fresh-sql-e2e','fresh-zero-residue','fresh-stop',
  'upgrade-worktree','upgrade-init','upgrade-bootstrap','upgrade-migration-count','upgrade-start',
  'upgrade-base-reset','upgrade-copy-migration','upgrade-apply','upgrade-status','upgrade-sql-e2e',
  'upgrade-zero-residue','upgrade-stop','complete',
]);

const command = (label, executable, args, kind = 'status') => ({ label, executable, args, kind });
const COMMANDS = Object.freeze([
  command('install', 'npm', ['ci']),
  command('python-contract', 'python', ['-m', 'unittest', '-v', 'tests.test_trainingos_learning_content_resolution_projection_v1'], 'python'),
  command('database-replay', 'bash', [path.join(publicRoot, 'scripts/run-learning-content-resolution-db-profile.sh')], 'database'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
]);

function parsePython(text) {
  return [...text.matchAll(/Ran\s+(\d+)\s+tests?/g)].reduce((sum, match) => sum + Number(match[1]), 0);
}

export function sanitizeDatabaseStage(text) {
  const matches = [...text.matchAll(/LEARNING_CONTENT_RESOLUTION_DB status=FAIL stage=([a-z0-9-]+)/g)];
  const candidate = matches.at(-1)?.[1] ?? 'unknown';
  return SAFE_DATABASE_STAGES.has(candidate) ? candidate : 'unknown';
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
  return result.stdout.trim() ? result.stdout.trim().split('\n').sort() : [];
}

export async function maybeRunLearningContentResolutionDbProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const files = await exactChangedFiles(input);
  if (files.length !== EXACT_FILES.size || !files.every((name) => EXACT_FILES.has(name))) return null;

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
          EXPECTED_MIGRATION_COUNT: process.env.EXPECTED_MIGRATION_COUNT,
          RUNNER_TEMP: input.runnerTemp,
        },
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      const output = await readFile(logPath, 'utf8');
      if (item.kind === 'python') pythonTests += parsePython(output);
      if (item.kind === 'database') databaseStage = result.status === 0 ? 'complete' : sanitizeDatabaseStage(output);
      if (result.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = Number(input.expectedNodeCount) === 0
    && Number(input.expectedPythonCount) === 6
    && pythonTests === 6;
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
    selectedSuite: 'learning-content-resolution-db',
  };
}
