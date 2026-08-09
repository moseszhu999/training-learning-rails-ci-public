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

export const MARKETPLACE_FIND_A_TENDER_REGISTRY_EXACT_FILES = new Set([
  'packages/training-marketplace-live-ingestion/package.json',
  'packages/training-marketplace-live-ingestion/src/find-a-tender.d.mts',
  'packages/training-marketplace-live-ingestion/src/find-a-tender.mjs',
  'packages/training-marketplace-live-ingestion/src/sources.d.mts',
  'packages/training-marketplace-live-ingestion/src/sources.mjs',
  'tests/training-marketplace-find-a-tender-v1.test.mjs',
  'tests/training-marketplace-live-ingestion-sources-v1.test.mjs',
]);

export const MARKETPLACE_SOURCE_HEALTH_CORE_EXACT_FILES = new Set([
  'packages/training-marketplace-source-health/package.json',
  'packages/training-marketplace-source-health/src/index.d.ts',
  'packages/training-marketplace-source-health/src/index.mjs',
  'packages/training-marketplace-source-health/test/source-health.test.mjs',
]);

export const MARKETPLACE_WORKSPACE_TRANSFER_CORE_EXACT_FILES = new Set([
  'packages/training-marketplace-workspace-transfer/package.json',
  'packages/training-marketplace-workspace-transfer/src/index.d.mts',
  'packages/training-marketplace-workspace-transfer/src/index.d.ts',
  'packages/training-marketplace-workspace-transfer/src/index.mjs',
  'tests/training-marketplace-workspace-agent-bridge-v1.test.mjs',
]);

const CANONICAL_MIGRATION_COUNT = 360;
const EXPECTED_NODE_COUNT = 13;
const EXPECTED_PYTHON_COUNT = 0;
const CONTRACTS_FINDER_CANONICAL_MIGRATION_COUNT = 371;
const CONTRACTS_FINDER_EXPECTED_NODE_COUNT = 7;
const CONTRACTS_FINDER_EXPECTED_PYTHON_COUNT = 0;
const FIND_A_TENDER_CANONICAL_MIGRATION_COUNT = 371;
const FIND_A_TENDER_EXPECTED_NODE_COUNT = 10;
const FIND_A_TENDER_EXPECTED_PYTHON_COUNT = 0;
const SOURCE_HEALTH_CANONICAL_MIGRATION_COUNT = 371;
const SOURCE_HEALTH_EXPECTED_NODE_COUNT = 5;
const SOURCE_HEALTH_EXPECTED_PYTHON_COUNT = 0;
const WORKSPACE_TRANSFER_CANONICAL_MIGRATION_COUNT = 371;
const WORKSPACE_TRANSFER_EXPECTED_NODE_COUNT = 8;
const WORKSPACE_TRANSFER_EXPECTED_PYTHON_COUNT = 0;

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

export const marketplaceFindATenderRegistryCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('find-a-tender-syntax', 'node', ['--check', 'packages/training-marketplace-live-ingestion/src/find-a-tender.mjs']),
  command('source-registry-syntax', 'node', ['--check', 'packages/training-marketplace-live-ingestion/src/sources.mjs']),
  command('find-a-tender-registry-tests', 'node', [
    '--test',
    'tests/training-marketplace-find-a-tender-v1.test.mjs',
    'tests/training-marketplace-live-ingestion-sources-v1.test.mjs',
  ], 'node'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('postbuild-copy', 'node', ['scripts/copy-trainingos-marketplace-web.mjs']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

export const marketplaceSourceHealthCoreCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('source-health-syntax', 'npm', ['--prefix', 'packages/training-marketplace-source-health', 'run', 'syntax']),
  command('source-health-tests', 'npm', ['--prefix', 'packages/training-marketplace-source-health', 'test'], 'node'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('postbuild-copy', 'node', ['scripts/copy-trainingos-marketplace-web.mjs']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

export const marketplaceWorkspaceTransferCoreCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('workspace-transfer-syntax', 'node', ['--check', 'packages/training-marketplace-workspace-transfer/src/index.mjs']),
  command('workspace-transfer-tests', 'node', ['--test', 'tests/training-marketplace-workspace-agent-bridge-v1.test.mjs'], 'node'),
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

export function isMarketplaceFindATenderRegistryScope(files) {
  return exactSetMatch(files, MARKETPLACE_FIND_A_TENDER_REGISTRY_EXACT_FILES);
}

export function isMarketplaceSourceHealthCoreScope(files) {
  return exactSetMatch(files, MARKETPLACE_SOURCE_HEALTH_CORE_EXACT_FILES);
}

export function isMarketplaceWorkspaceTransferCoreScope(files) {
  return exactSetMatch(files, MARKETPLACE_WORKSPACE_TRANSFER_CORE_EXACT_FILES);
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

const findATenderRegistryConfig = Object.freeze({
  commands: marketplaceFindATenderRegistryCommands,
  migrationCount: FIND_A_TENDER_CANONICAL_MIGRATION_COUNT,
  nodeCount: FIND_A_TENDER_EXPECTED_NODE_COUNT,
  pythonCount: FIND_A_TENDER_EXPECTED_PYTHON_COUNT,
  changedFileCount: 7,
  selectedSuite: 'marketplace-find-a-tender-registry',
});

const sourceHealthConfig = Object.freeze({
  commands: marketplaceSourceHealthCoreCommands,
  migrationCount: SOURCE_HEALTH_CANONICAL_MIGRATION_COUNT,
  nodeCount: SOURCE_HEALTH_EXPECTED_NODE_COUNT,
  pythonCount: SOURCE_HEALTH_EXPECTED_PYTHON_COUNT,
  changedFileCount: 4,
  selectedSuite: 'marketplace-source-health-core',
});

const workspaceTransferConfig = Object.freeze({
  commands: marketplaceWorkspaceTransferCoreCommands,
  migrationCount: WORKSPACE_TRANSFER_CANONICAL_MIGRATION_COUNT,
  nodeCount: WORKSPACE_TRANSFER_EXPECTED_NODE_COUNT,
  pythonCount: WORKSPACE_TRANSFER_EXPECTED_PYTHON_COUNT,
  changedFileCount: 5,
  selectedSuite: 'marketplace-workspace-transfer-core',
});

export async function maybeRunMarketplaceDiscoveryCoreProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (isMarketplaceDiscoveryCoreScope(files)) return runFixedScope(input, scope, historicalConfig);
  if (isMarketplaceContractsFinderCoreScope(files)) return runFixedScope(input, scope, contractsFinderConfig);
  if (isMarketplaceFindATenderRegistryScope(files)) return runFixedScope(input, scope, findATenderRegistryConfig);
  if (isMarketplaceSourceHealthCoreScope(files)) return runFixedScope(input, scope, sourceHealthConfig);
  if (isMarketplaceWorkspaceTransferCoreScope(files)) return runFixedScope(input, scope, workspaceTransferConfig);
  return null;
}
