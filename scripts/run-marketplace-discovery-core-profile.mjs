import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const MARKETPLACE_DISCOVERY_CORE_EXACT_FILES = new Set([
  'docs/architecture/trainingos-marketplace-discovery-core-v1.md',
  'packages/training-marketplace-core/examples/marketplace-demo.mjs',
  'packages/training-marketplace-core/package.json',
  'packages/training-marketplace-core/src/index.mjs',
  'packages/training-marketplace-core/test/marketplace-core.test.mjs',
]);

export const MARKETPLACE_CONTRACTS_FINDER_CORE_EXACT_FILES = new Set([
  'packages/training-marketplace-live-ingestion/package.json',
  'packages/training-marketplace-live-ingestion/src/index.d.mts',
  'packages/training-marketplace-live-ingestion/src/index.mjs',
  'tests/training-marketplace-contracts-finder-source-trust-v1.test.mjs',
  'tests/training-marketplace-live-ingestion-v1.test.mjs',
]);

const CANONICAL_MIGRATION_COUNT = 360;
const EXPECTED_NODE_COUNT = 13;
const EXPECTED_PYTHON_COUNT = 0;
const CONTRACTS_FINDER_CANONICAL_MIGRATION_COUNT = 371;
const CONTRACTS_FINDER_EXPECTED_NODE_COUNT = 7;
const CONTRACTS_FINDER_EXPECTED_PYTHON_COUNT = 0;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const marketplaceDiscoveryCoreCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('package-syntax', 'npm', ['--prefix', 'packages/training-marketplace-core', 'run', 'syntax']),
  command('package-tests', 'npm', ['--prefix', 'packages/training-marketplace-core', 'test'], 'node'),
  command('package-demo', 'npm', ['--prefix', 'packages/training-marketplace-core', 'run', 'demo']),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
]);

export const marketplaceContractsFinderCoreCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('contracts-finder-syntax', 'node', ['--check', 'packages/training-marketplace-live-ingestion/src/index.mjs']),
  command('contracts-finder-tests', 'node', [
    '--test',
    'tests/training-marketplace-live-ingestion-v1.test.mjs',
    'tests/training-marketplace-contracts-finder-source-trust-v1.test.mjs',
  ], 'node'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
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

function exactSetMatch(files, allowed) {
  const names = [...files];
  return names.length === allowed.size
    && names.every((name) => allowed.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'))
    && names.every((name) => !name.startsWith('apps/training-web/'))
    && names.every((name) => !name.startsWith('lib/trainingos-agent-gateway/'));
}

export function isMarketplaceDiscoveryCoreScope(files) {
  return exactSetMatch(files, MARKETPLACE_DISCOVERY_CORE_EXACT_FILES);
}

export function isMarketplaceContractsFinderCoreScope(files) {
  return exactSetMatch(files, MARKETPLACE_CONTRACTS_FINDER_CORE_EXACT_FILES);
}

function fixedInputContract(input, scope, config) {
  return Number(input.expectedNodeCount) === config.nodeCount
    && Number(input.expectedPythonCount) === config.pythonCount
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(config.migrationCount)
    && scope.expected_changed_file_count === String(config.changedFileCount)
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
}

function failedContractResult(config) {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: config.commands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: config.selectedSuite,
  };
}

async function runFixedScope(input, scope, config) {
  if (!fixedInputContract(input, scope, config)) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedContractResult(config);
  }

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let nodeTests = 0;
  let nodePassed = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of config.commands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const result = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: {
          ...process.env,
          PRIVATE_REPO_PATH: input.privateRepoPath,
          PRIVATE_EXACT_SHA: input.privateExactSha,
          EXPECTED_MIGRATION_COUNT: String(config.migrationCount),
          RUNNER_TEMP: input.runnerTemp,
        },
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      const output = await readFile(logPath, 'utf8');
      if (item.kind === 'node') {
        nodeTests += parseNode(output);
        nodePassed += parseNodePassed(output);
      }
      if (result.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = nodeTests === config.nodeCount && nodePassed === config.nodeCount;
  const ok = passedStepCount === config.commands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: config.commands.length,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed: nodeTests - nodePassed,
    pythonTests: 0,
    selectedSuite: config.selectedSuite,
  };
}

const historicalConfig = Object.freeze({
  commands: marketplaceDiscoveryCoreCommands,
  migrationCount: CANONICAL_MIGRATION_COUNT,
  nodeCount: EXPECTED_NODE_COUNT,
  pythonCount: EXPECTED_PYTHON_COUNT,
  changedFileCount: 5,
  selectedSuite: 'marketplace-discovery-core',
});

const contractsFinderConfig = Object.freeze({
  commands: marketplaceContractsFinderCoreCommands,
  migrationCount: CONTRACTS_FINDER_CANONICAL_MIGRATION_COUNT,
  nodeCount: CONTRACTS_FINDER_EXPECTED_NODE_COUNT,
  pythonCount: CONTRACTS_FINDER_EXPECTED_PYTHON_COUNT,
  changedFileCount: 5,
  selectedSuite: 'marketplace-contracts-finder-core',
});

export async function maybeRunMarketplaceDiscoveryCoreProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (isMarketplaceDiscoveryCoreScope(files)) return runFixedScope(input, scope, historicalConfig);
  if (isMarketplaceContractsFinderCoreScope(files)) return runFixedScope(input, scope, contractsFinderConfig);
  return null;
}
