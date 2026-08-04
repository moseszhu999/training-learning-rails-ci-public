import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const MARKETPLACE_AUTHENTICATED_SUBMISSION_UI_EXACT_FILES = new Set([
  'apps/training-marketplace-web/src/authenticated-submission-runtime.mjs',
  'apps/training-marketplace-web/src/shareable-search-state.mjs',
  'apps/training-marketplace-web/test/authenticated-submission-runtime.test.mjs',
  'docs/architecture/trainingos-marketplace-authenticated-submission-ui-v1.md',
  'tests/test_trainingos_marketplace_authenticated_submission_ui_v1.py',
]);

const CANONICAL_MIGRATION_COUNT = 366;
const EXPECTED_NODE_COUNT = 8;
const EXPECTED_PYTHON_COUNT = 8;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const marketplaceAuthenticatedSubmissionUiCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('runtime-syntax', 'node', [
    '--check',
    'apps/training-marketplace-web/src/authenticated-submission-runtime.mjs',
  ]),
  command('bootstrap-syntax', 'node', [
    '--check',
    'apps/training-marketplace-web/src/shareable-search-state.mjs',
  ]),
  command('node-ui', 'node', [
    '--test',
    'apps/training-marketplace-web/test/authenticated-submission-runtime.test.mjs',
  ], 'node'),
  command('python-static', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_marketplace_authenticated_submission_ui_v1',
  ], 'python'),
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

export function isMarketplaceAuthenticatedSubmissionUiScope(files) {
  const names = [...files];
  return names.length === MARKETPLACE_AUTHENTICATED_SUBMISSION_UI_EXACT_FILES.size
    && names.every((name) => MARKETPLACE_AUTHENTICATED_SUBMISSION_UI_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'))
    && names.every((name) => !name.startsWith('apps/training-marketplace-web/object/'));
}

function fixedInputContract(input, scope) {
  return Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(CANONICAL_MIGRATION_COUNT)
    && scope.expected_changed_file_count === '5'
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: marketplaceAuthenticatedSubmissionUiCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'marketplace-authenticated-submission-ui',
  };
}

export async function maybeRunMarketplaceAuthenticatedSubmissionUiProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isMarketplaceAuthenticatedSubmissionUiScope(files)) return null;

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
  const failedLabels = [];

  try {
    for (const [index, item] of marketplaceAuthenticatedSubmissionUiCommands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const result = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: process.env,
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
  const ok = passedStepCount === marketplaceAuthenticatedSubmissionUiCommands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: marketplaceAuthenticatedSubmissionUiCommands.length,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests,
    selectedSuite: 'marketplace-authenticated-submission-ui',
  };
}
