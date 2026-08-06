import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const MARKETPLACE_PUBLIC_SOURCE_EXACT_FILES = new Set([
  'docs/product/trainingos-marketplace-public-source-observation-core-v1.md',
  'packages/training-marketplace-public-source/package.json',
  'packages/training-marketplace-public-source/src/index.d.ts',
  'packages/training-marketplace-public-source/src/index.mjs',
  'tests/training-marketplace-public-source-observation-core-v1.test.mjs',
]);

export const MARKETPLACE_FUNNEL_ANALYTICS_EXACT_FILES = new Set([
  'docs/product/trainingos-marketplace-funnel-analytics-core-v1.md',
  'packages/training-marketplace-funnel-analytics/package.json',
  'packages/training-marketplace-funnel-analytics/src/index.d.ts',
  'packages/training-marketplace-funnel-analytics/src/index.mjs',
  'tests/training-marketplace-funnel-analytics-core-v1.test.mjs',
]);

export const MARKETPLACE_ONBOARDING_ACTIVATION_EXACT_FILES = new Set([
  'docs/product/trainingos-marketplace-onboarding-activation-intent-v1.md',
  'packages/training-marketplace-onboarding-activation/package.json',
  'packages/training-marketplace-onboarding-activation/src/index.d.ts',
  'packages/training-marketplace-onboarding-activation/src/index.mjs',
  'tests/training-marketplace-onboarding-activation-intent-v1.test.mjs',
]);

export const MARKETPLACE_TEXAS_ETPL_EXACT_FILES = new Set([
  'docs/product/trainingos-texas-etpl-source-adapter-v1.md',
  'packages/training-marketplace-texas-etpl/package.json',
  'packages/training-marketplace-texas-etpl/src/index.d.ts',
  'packages/training-marketplace-texas-etpl/src/index.mjs',
  'tests/training-marketplace-texas-etpl-source-adapter-v1.test.mjs',
]);

const EXPECTED_MIGRATION_COUNT = 368;

const PROFILES = Object.freeze([
  Object.freeze({
    suite: 'marketplace-public-source-observation-core',
    files: MARKETPLACE_PUBLIC_SOURCE_EXACT_FILES,
    expectedNodeCount: 10,
    sourcePath: 'packages/training-marketplace-public-source/src/index.mjs',
    declarationPath: 'packages/training-marketplace-public-source/src/index.d.ts',
    testPath: 'tests/training-marketplace-public-source-observation-core-v1.test.mjs',
  }),
  Object.freeze({
    suite: 'marketplace-funnel-analytics-core',
    files: MARKETPLACE_FUNNEL_ANALYTICS_EXACT_FILES,
    expectedNodeCount: 11,
    sourcePath: 'packages/training-marketplace-funnel-analytics/src/index.mjs',
    declarationPath: 'packages/training-marketplace-funnel-analytics/src/index.d.ts',
    testPath: 'tests/training-marketplace-funnel-analytics-core-v1.test.mjs',
  }),
  Object.freeze({
    suite: 'marketplace-onboarding-activation-intent',
    files: MARKETPLACE_ONBOARDING_ACTIVATION_EXACT_FILES,
    expectedNodeCount: 12,
    sourcePath: 'packages/training-marketplace-onboarding-activation/src/index.mjs',
    declarationPath: 'packages/training-marketplace-onboarding-activation/src/index.d.ts',
    testPath: 'tests/training-marketplace-onboarding-activation-intent-v1.test.mjs',
  }),
  Object.freeze({
    suite: 'marketplace-texas-etpl-source-adapter',
    files: MARKETPLACE_TEXAS_ETPL_EXACT_FILES,
    expectedNodeCount: 9,
    sourcePath: 'packages/training-marketplace-texas-etpl/src/index.mjs',
    declarationPath: 'packages/training-marketplace-texas-etpl/src/index.d.ts',
    testPath: 'tests/training-marketplace-texas-etpl-source-adapter-v1.test.mjs',
  }),
]);

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export function marketplaceNextCoreCommands(profile) {
  return Object.freeze([
    command('install', 'npm', ['ci']),
    command('package-syntax', 'node', ['--check', profile.sourcePath]),
    command('focused-node-contracts', 'node', ['--test', profile.testPath], 'node'),
    command('declaration-typecheck', 'npx', [
      'tsc', '--strict', '--noEmit', '--skipLibCheck',
      '--target', 'ES2022', '--module', 'ESNext',
      '--moduleResolution', 'Bundler', '--lib', 'ES2022,DOM',
      profile.declarationPath,
    ]),
    command('typecheck', 'npm', ['run', 'typecheck']),
    command('production-build', 'npm', ['run', 'build']),
    command('bundle-verification', 'npm', ['run', 'verify:build']),
  ]);
}

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

function isExactScope(files, expected) {
  const names = [...files];
  return names.length === expected.size
    && names.every((name) => expected.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'))
    && names.every((name) => !name.startsWith('apps/'))
    && names.every((name) => !name.startsWith('lib/trainingos-agent-gateway/'));
}

export function isMarketplacePublicSourceScope(files) {
  return isExactScope(files, MARKETPLACE_PUBLIC_SOURCE_EXACT_FILES);
}

export function isMarketplaceFunnelAnalyticsScope(files) {
  return isExactScope(files, MARKETPLACE_FUNNEL_ANALYTICS_EXACT_FILES);
}

export function isMarketplaceOnboardingActivationScope(files) {
  return isExactScope(files, MARKETPLACE_ONBOARDING_ACTIVATION_EXACT_FILES);
}

export function isMarketplaceTexasEtplScope(files) {
  return isExactScope(files, MARKETPLACE_TEXAS_ETPL_EXACT_FILES);
}

function findProfile(files) {
  return PROFILES.find((profile) => isExactScope(files, profile.files));
}

function failedContractResult(profile, commands) {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: commands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: profile.suite,
  };
}

export async function maybeRunMarketplaceNextCoreProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  const profile = findProfile(files);
  if (!profile) return null;
  const commands = marketplaceNextCoreCommands(profile);
  const fixedInput = Number(input.expectedNodeCount) === profile.expectedNodeCount
    && Number(input.expectedPythonCount) === 0
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(EXPECTED_MIGRATION_COUNT)
    && scope.expected_changed_file_count === '5'
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
  if (!fixedInput) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedContractResult(profile, commands);
  }

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let nodeTests = 0;
  let nodePassed = 0;
  const failedLabels = [];
  try {
    for (const [index, item] of commands.entries()) {
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
        nodeTests += parseNode(output);
        nodePassed += parseNodePassed(output);
      }
      if (result.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = nodeTests === profile.expectedNodeCount
    && nodePassed === profile.expectedNodeCount;
  const ok = passedStepCount === commands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: commands.length,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed: nodeTests - nodePassed,
    pythonTests: 0,
    selectedSuite: profile.suite,
  };
}
