import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const MARKETPLACE_SELECTION_INTENT_EXACT_FILES = new Set([
  'docs/architecture/trainingos-marketplace-selection-intent-core-v1.md',
  'packages/training-marketplace-selection-intent/package.json',
  'packages/training-marketplace-selection-intent/src/index.d.ts',
  'packages/training-marketplace-selection-intent/src/index.mjs',
  'packages/training-marketplace-selection-intent/test/selection-intent.test.mjs',
  'tests/test_trainingos_marketplace_selection_intent_core_v1.py',
]);

const CANONICAL_MIGRATION_COUNT = 367;
const EXPECTED_NODE_COUNT = 6;
const EXPECTED_PYTHON_COUNT = 5;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const marketplaceSelectionIntentCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('package-syntax', 'node', [
    '--check',
    'packages/training-marketplace-selection-intent/src/index.mjs',
  ]),
  command('node-selection-intent', 'node', [
    '--test',
    'packages/training-marketplace-selection-intent/test/selection-intent.test.mjs',
  ], 'node'),
  command('python-static', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_marketplace_selection_intent_core_v1',
  ], 'python'),
  command('declaration-typecheck', 'npx', [
    'tsc', '--strict', '--noEmit', '--skipLibCheck',
    '--target', 'ES2022', '--module', 'ESNext',
    '--moduleResolution', 'Bundler', '--lib', 'ES2022,DOM',
    'packages/training-marketplace-selection-intent/src/index.d.ts',
  ]),
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

export function isMarketplaceSelectionIntentScope(files) {
  const names = [...files];
  return names.length === MARKETPLACE_SELECTION_INTENT_EXACT_FILES.size
    && names.every((name) => MARKETPLACE_SELECTION_INTENT_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function fixedInputContract(input, scope) {
  return Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(CANONICAL_MIGRATION_COUNT)
    && scope.expected_changed_file_count === '6'
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: marketplaceSelectionIntentCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'marketplace-selection-intent',
  };
}

export async function maybeRunMarketplaceSelectionIntentProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isMarketplaceSelectionIntentScope(files)) return null;

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
    for (const [index, item] of marketplaceSelectionIntentCommands.entries()) {
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
  const ok = passedStepCount === marketplaceSelectionIntentCommands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: marketplaceSelectionIntentCommands.length,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests,
    selectedSuite: 'marketplace-selection-intent',
  };
}
