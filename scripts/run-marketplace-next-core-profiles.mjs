import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

export const MARKETPLACE_FIRST_PARTY_FUNNEL_RUNTIME_EXACT_FILES = new Set([
  'docs/product/trainingos-marketplace-first-party-funnel-runtime-v1.md',
  'packages/training-marketplace-funnel-runtime/package.json',
  'packages/training-marketplace-funnel-runtime/src/envelope.mjs',
  'packages/training-marketplace-funnel-runtime/src/index.d.ts',
  'packages/training-marketplace-funnel-runtime/src/index.mjs',
  'packages/training-marketplace-funnel-runtime/src/policy.mjs',
  'tests/training-marketplace-first-party-funnel-runtime-v1.test.mjs',
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

export const MARKETPLACE_ONBOARDING_WRITER_EXACT_FILES = new Set([
  'docs/product/trainingos-marketplace-onboarding-writer-v1.md',
  'packages/training-marketplace-onboarding-writer/package.json',
  'packages/training-marketplace-onboarding-writer/src/index.d.ts',
  'packages/training-marketplace-onboarding-writer/src/index.mjs',
  'supabase/migrations/20260806083000_trainingos_marketplace_onboarding_writer_v1.sql',
  'tests/sql/trainingos_marketplace_onboarding_writer_v1_e2e.sql',
  'tests/test_trainingos_marketplace_onboarding_writer_v1.py',
  'tests/training-marketplace-onboarding-writer-v1.test.mjs',
]);

const PROFILES = Object.freeze([
  Object.freeze({
    suite: 'marketplace-public-source-observation-core',
    files: MARKETPLACE_PUBLIC_SOURCE_EXACT_FILES,
    expectedChangedFileCount: 5,
    expectedMigrationCount: 368,
    migrationStart: 'none',
    migrationEnd: 'none',
    expectedNodeCount: 10,
    expectedPythonCount: 0,
    sourcePath: 'packages/training-marketplace-public-source/src/index.mjs',
    declarationPath: 'packages/training-marketplace-public-source/src/index.d.ts',
    testPath: 'tests/training-marketplace-public-source-observation-core-v1.test.mjs',
  }),
  Object.freeze({
    suite: 'marketplace-funnel-analytics-core',
    files: MARKETPLACE_FUNNEL_ANALYTICS_EXACT_FILES,
    expectedChangedFileCount: 5,
    expectedMigrationCount: 368,
    migrationStart: 'none',
    migrationEnd: 'none',
    expectedNodeCount: 11,
    expectedPythonCount: 0,
    sourcePath: 'packages/training-marketplace-funnel-analytics/src/index.mjs',
    declarationPath: 'packages/training-marketplace-funnel-analytics/src/index.d.ts',
    testPath: 'tests/training-marketplace-funnel-analytics-core-v1.test.mjs',
  }),
  Object.freeze({
    suite: 'marketplace-first-party-funnel-runtime',
    files: MARKETPLACE_FIRST_PARTY_FUNNEL_RUNTIME_EXACT_FILES,
    expectedChangedFileCount: 7,
    expectedMigrationCount: 368,
    migrationStart: 'none',
    migrationEnd: 'none',
    expectedNodeCount: 15,
    expectedPythonCount: 0,
    sourcePath: 'packages/training-marketplace-funnel-runtime/src/index.mjs',
    declarationPath: 'packages/training-marketplace-funnel-runtime/src/index.d.ts',
    testPath: 'tests/training-marketplace-first-party-funnel-runtime-v1.test.mjs',
  }),
  Object.freeze({
    suite: 'marketplace-onboarding-activation-intent',
    files: MARKETPLACE_ONBOARDING_ACTIVATION_EXACT_FILES,
    expectedChangedFileCount: 5,
    expectedMigrationCount: 368,
    migrationStart: 'none',
    migrationEnd: 'none',
    expectedNodeCount: 12,
    expectedPythonCount: 0,
    sourcePath: 'packages/training-marketplace-onboarding-activation/src/index.mjs',
    declarationPath: 'packages/training-marketplace-onboarding-activation/src/index.d.ts',
    testPath: 'tests/training-marketplace-onboarding-activation-intent-v1.test.mjs',
  }),
  Object.freeze({
    suite: 'marketplace-texas-etpl-source-adapter',
    files: MARKETPLACE_TEXAS_ETPL_EXACT_FILES,
    expectedChangedFileCount: 5,
    expectedMigrationCount: 368,
    migrationStart: 'none',
    migrationEnd: 'none',
    expectedNodeCount: 9,
    expectedPythonCount: 0,
    sourcePath: 'packages/training-marketplace-texas-etpl/src/index.mjs',
    declarationPath: 'packages/training-marketplace-texas-etpl/src/index.d.ts',
    testPath: 'tests/training-marketplace-texas-etpl-source-adapter-v1.test.mjs',
  }),
  Object.freeze({
    suite: 'marketplace-onboarding-writer',
    files: MARKETPLACE_ONBOARDING_WRITER_EXACT_FILES,
    expectedChangedFileCount: 8,
    expectedMigrationCount: 369,
    migrationStart: '20260806083000',
    migrationEnd: '20260806083000',
    expectedNodeCount: 8,
    expectedPythonCount: 13,
    sourcePath: 'packages/training-marketplace-onboarding-writer/src/index.mjs',
    declarationPath: 'packages/training-marketplace-onboarding-writer/src/index.d.ts',
    testPath: 'tests/training-marketplace-onboarding-writer-v1.test.mjs',
    pythonPath: 'tests/test_trainingos_marketplace_onboarding_writer_v1.py',
    databaseScript: path.join(publicRoot, 'scripts/run-marketplace-onboarding-writer-database.sh'),
  }),
]);

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export function marketplaceNextCoreCommands(profile) {
  const commands = [
    command('install', 'npm', ['ci']),
    command('package-syntax', 'node', ['--check', profile.sourcePath]),
    command('focused-node-contracts', 'node', ['--test', profile.testPath], 'node'),
  ];
  if (profile.pythonPath) {
    commands.push(command('python-static', 'python', [profile.pythonPath], 'python'));
  }
  if (profile.databaseScript) {
    commands.push(command('database-replay', 'bash', [profile.databaseScript], 'database'));
  }
  commands.push(
    command('declaration-typecheck', 'npx', [
      'tsc', '--strict', '--noEmit', '--skipLibCheck',
      '--target', 'ES2022', '--module', 'ESNext',
      '--moduleResolution', 'Bundler', '--lib', 'ES2022,DOM',
      profile.declarationPath,
    ]),
    command('typecheck', 'npm', ['run', 'typecheck']),
    command('production-build', 'npm', ['run', 'build']),
    command('bundle-verification', 'npm', ['run', 'verify:build']),
  );
  return Object.freeze(commands);
}

function parseNode(text) {
  return [...String(text).matchAll(/^# tests\s+(\d+)$/gm)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

function parseNodePassed(text) {
  return [...String(text).matchAll(/^# pass\s+(\d+)$/gm)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

function parsePython(text) {
  return [...String(text).matchAll(/Ran\s+(\d+)\s+tests?/g)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

function parseDatabaseStage(text) {
  const matches = [...String(text).matchAll(/MARKETPLACE_ONBOARDING_WRITER_DB status=FAIL stage=([a-z0-9-]+)/g)];
  return matches.at(-1)?.[1] ?? 'unknown';
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
    && names.every((name) => !name.startsWith('apps/'))
    && names.every((name) => !name.startsWith('lib/trainingos-agent-gateway/'));
}

export function isMarketplacePublicSourceScope(files) {
  return isExactScope(files, MARKETPLACE_PUBLIC_SOURCE_EXACT_FILES)
    && [...files].every((name) => !name.startsWith('supabase/migrations/'));
}

export function isMarketplaceFunnelAnalyticsScope(files) {
  return isExactScope(files, MARKETPLACE_FUNNEL_ANALYTICS_EXACT_FILES)
    && [...files].every((name) => !name.startsWith('supabase/migrations/'));
}

export function isMarketplaceFirstPartyFunnelRuntimeScope(files) {
  return isExactScope(files, MARKETPLACE_FIRST_PARTY_FUNNEL_RUNTIME_EXACT_FILES)
    && [...files].every((name) => !name.startsWith('supabase/migrations/'));
}

export function isMarketplaceOnboardingActivationScope(files) {
  return isExactScope(files, MARKETPLACE_ONBOARDING_ACTIVATION_EXACT_FILES)
    && [...files].every((name) => !name.startsWith('supabase/migrations/'));
}

export function isMarketplaceTexasEtplScope(files) {
  return isExactScope(files, MARKETPLACE_TEXAS_ETPL_EXACT_FILES)
    && [...files].every((name) => !name.startsWith('supabase/migrations/'));
}

export function isMarketplaceOnboardingWriterScope(files) {
  return isExactScope(files, MARKETPLACE_ONBOARDING_WRITER_EXACT_FILES)
    && [...files].filter((name) => name.startsWith('supabase/migrations/')).length === 1;
}

function findProfile(files) {
  return PROFILES.find((profile) => isExactScope(files, profile.files));
}

function fixedInputContract(input, scope, profile) {
  return Number(input.expectedNodeCount) === profile.expectedNodeCount
    && Number(input.expectedPythonCount) === profile.expectedPythonCount
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(profile.expectedMigrationCount)
    && scope.expected_changed_file_count === String(profile.expectedChangedFileCount)
    && scope.migration_start === profile.migrationStart
    && scope.migration_end === profile.migrationEnd;
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
  if (!fixedInputContract(input, scope, profile)) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedContractResult(profile, commands);
  }

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let nodeTests = 0;
  let nodePassed = 0;
  let pythonTests = 0;
  let databaseStage = 'not-run';
  const failedLabels = [];
  try {
    for (const [index, item] of commands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const result = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: {
          ...process.env,
          PRIVATE_REPO_PATH: input.privateRepoPath,
          PRIVATE_EXACT_SHA: input.privateExactSha,
          EXPECTED_MIGRATION_COUNT: String(profile.expectedMigrationCount),
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

  const countsPassed = nodeTests === profile.expectedNodeCount
    && nodePassed === profile.expectedNodeCount
    && pythonTests === profile.expectedPythonCount;
  const ok = passedStepCount === commands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  const suffix = profile.databaseScript ? `@${databaseStage}` : '';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}${suffix}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: commands.length,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed: nodeTests - nodePassed,
    pythonTests,
    selectedSuite: profile.suite,
  };
}
