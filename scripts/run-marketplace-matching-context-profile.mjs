import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MARKETPLACE_MATCHING_CONTEXT_EXACT_FILES = new Set([
  'docs/architecture/trainingos-marketplace-matching-context-projection-v1.md',
  'packages/training-marketplace-participation-client/package.json',
  'packages/training-marketplace-participation-client/src/matching-context.d.ts',
  'packages/training-marketplace-participation-client/src/matching-context.mjs',
  'packages/training-marketplace-participation-client/test/matching-context.test.mjs',
  'supabase/migrations/20260805063000_trainingos_marketplace_matching_context_projection_v1.sql',
  'tests/sql/trainingos_marketplace_matching_context_projection_v1_e2e.sql',
  'tests/test_trainingos_marketplace_matching_context_projection_v1.py',
]);

const CANONICAL_MIGRATION_COUNT = 367;
const EXPECTED_NODE_COUNT = 5;
const EXPECTED_PYTHON_COUNT = 10;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const marketplaceMatchingContextCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('client-syntax', 'node', [
    '--check',
    'packages/training-marketplace-participation-client/src/matching-context.mjs',
  ]),
  command('node-client', 'node', [
    '--test',
    'packages/training-marketplace-participation-client/test/matching-context.test.mjs',
  ], 'node'),
  command('python-static', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_marketplace_matching_context_projection_v1',
  ], 'python'),
  command('declaration-typecheck', 'npx', [
    'tsc', '--strict', '--noEmit', '--skipLibCheck',
    '--target', 'ES2022', '--module', 'ESNext',
    '--moduleResolution', 'Bundler', '--lib', 'ES2022,DOM',
    'packages/training-marketplace-participation-client/src/matching-context.d.ts',
  ]),
  command('database-replay', 'bash', [
    path.join(publicRoot, 'scripts/run-marketplace-matching-context-with-init-images.sh'),
  ], 'database'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

function parseNode(text) {
  const tests = Number(String(text).match(/# tests\s+(\d+)/)?.[1] ?? 0);
  const passed = Number(String(text).match(/# pass\s+(\d+)/)?.[1] ?? 0);
  const failed = Number(String(text).match(/# fail\s+(\d+)/)?.[1] ?? 0);
  return { tests, passed, failed };
}

function parsePython(text) {
  return [...String(text).matchAll(/Ran\s+(\d+)\s+tests?/g)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
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

export function isMarketplaceMatchingContextScope(files) {
  const names = [...files];
  return names.length === MARKETPLACE_MATCHING_CONTEXT_EXACT_FILES.size
    && names.every((name) => MARKETPLACE_MATCHING_CONTEXT_EXACT_FILES.has(name))
    && names.filter((name) => name.startsWith('supabase/migrations/')).length === 1
    && names.every((name) => !name.startsWith('apps/training-marketplace-web/object/'));
}

function fixedInputContract(input, scope) {
  return Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(CANONICAL_MIGRATION_COUNT)
    && scope.expected_changed_file_count === '8'
    && scope.migration_start === '20260805063000'
    && scope.migration_end === '20260805063000';
}

function parseDatabaseStage(text) {
  const match = [...String(text).matchAll(/MARKETPLACE_MATCHING_CONTEXT_DB status=FAIL stage=([a-z0-9-]+)/g)].at(-1);
  return match?.[1] ?? 'unknown';
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract@not-run',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: marketplaceMatchingContextCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'marketplace-matching-context',
  };
}

export async function maybeRunMarketplaceMatchingContextProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isMarketplaceMatchingContextScope(files)) return null;

  if (!fixedInputContract(input, scope)) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedContractResult();
  }

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let nodeTests = 0;
  let nodePassed = 0;
  let nodeFailed = 0;
  let pythonTests = 0;
  let databaseStage = 'not-run';
  const failedLabels = [];

  try {
    for (const [index, item] of marketplaceMatchingContextCommands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const result = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: {
          ...process.env,
          PRIVATE_REPO_PATH: input.privateRepoPath,
          PRIVATE_EXACT_SHA: input.privateExactSha,
          EXPECTED_MIGRATION_COUNT: String(CANONICAL_MIGRATION_COUNT),
          RUNNER_TEMP: input.runnerTemp,
        },
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      const output = await readFile(logPath, 'utf8');
      if (item.kind === 'node') {
        const parsed = parseNode(output);
        nodeTests += parsed.tests;
        nodePassed += parsed.passed;
        nodeFailed += parsed.failed;
      }
      if (item.kind === 'python') pythonTests += parsePython(output);
      if (item.kind === 'database') {
        databaseStage = result.status === 0 ? 'complete' : parseDatabaseStage(output);
      }
      if (result.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = nodeTests === EXPECTED_NODE_COUNT
    && nodePassed === EXPECTED_NODE_COUNT
    && nodeFailed === 0
    && pythonTests === EXPECTED_PYTHON_COUNT;
  const ok = passedStepCount === marketplaceMatchingContextCommands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}@${databaseStage}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: marketplaceMatchingContextCommands.length,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests,
    selectedSuite: 'marketplace-matching-context',
  };
}
