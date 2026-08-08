import { closeSync, openSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const PROVIDER_NEUTRAL_BILLING_INTENT_EXACT_FILES = new Set([
  'docs/product/trainingos-provider-neutral-billing-intent-core-v1.md',
  'packages/trainingos-billing-intent-core/package.json',
  'packages/trainingos-billing-intent-core/src/index.d.ts',
  'packages/trainingos-billing-intent-core/src/index.mjs',
  'tests/trainingos-provider-neutral-billing-intent-core-v1.test.mjs',
]);

const EXPECTED_CHANGED_FILE_COUNT = 5;
const EXPECTED_NODE_COUNT = 19;
const EXPECTED_PYTHON_COUNT = 0;
const EXPECTED_MIGRATION_COUNT = 371;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const providerNeutralBillingIntentCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('package-syntax', 'node', ['--check', 'packages/trainingos-billing-intent-core/src/index.mjs']),
  command('focused-node-contracts', 'node', ['--test', 'tests/trainingos-provider-neutral-billing-intent-core-v1.test.mjs'], 'node'),
  command('declaration-typecheck', 'npx', [
    'tsc', '--noEmit', '--strict', '--skipLibCheck', 'false',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022',
    'packages/trainingos-billing-intent-core/src/index.d.ts',
  ]),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('direct-vite-production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('postbuild-copy', 'node', ['scripts/copy-trainingos-marketplace-web.mjs']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

function parseNode(text) {
  return [...String(text).matchAll(/^# tests\s+(\d+)$/gm)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

function parseNodePassed(text) {
  return [...String(text).matchAll(/^# pass\s+(\d+)$/gm)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

function parseNodeFailed(text) {
  return [...String(text).matchAll(/^# fail\s+(\d+)$/gm)]
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
    '-C', input.privateRepoPath,
    'diff', '--name-only',
    scope.expected_base_sha,
    input.privateExactSha,
  ], { encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error('git scope failed');
  return {
    files: result.stdout.trim() ? result.stdout.trim().split('\n').sort() : [],
    scope,
  };
}

export function isProviderNeutralBillingIntentScope(files) {
  const names = [...files];
  return names.length === PROVIDER_NEUTRAL_BILLING_INTENT_EXACT_FILES.size
    && names.every((name) => PROVIDER_NEUTRAL_BILLING_INTENT_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: providerNeutralBillingIntentCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'provider-neutral-billing-intent-core',
  };
}

export async function maybeRunProviderNeutralBillingIntentProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isProviderNeutralBillingIntentScope(files)) return null;

  const fixedInputs = Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(EXPECTED_MIGRATION_COUNT)
    && scope.expected_changed_file_count === String(EXPECTED_CHANGED_FILE_COUNT)
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
  if (!fixedInputs) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedContractResult();
  }

  let passedStepCount = 0;
  let nodeTests = 0;
  let nodePassed = 0;
  let nodeFailed = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of providerNeutralBillingIntentCommands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const commandResult = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: process.env,
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      const output = await readFile(logPath, 'utf8');
      if (item.kind === 'node') {
        nodeTests += parseNode(output);
        nodePassed += parseNodePassed(output);
        nodeFailed += parseNodeFailed(output);
      }
      if (commandResult.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = nodeTests === EXPECTED_NODE_COUNT
    && nodePassed === EXPECTED_NODE_COUNT
    && nodeFailed === 0;
  const stepCount = providerNeutralBillingIntentCommands.length;
  const ok = passedStepCount === stepCount && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests: 0,
    selectedSuite: 'provider-neutral-billing-intent-core',
  };
}
