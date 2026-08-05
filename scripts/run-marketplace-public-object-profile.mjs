import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const MARKETPLACE_PUBLIC_OBJECT_EXACT_FILES = new Set([
  'apps/training-marketplace-web/object/app.mjs',
  'apps/training-marketplace-web/object/fixture-read-model.mjs',
  'apps/training-marketplace-web/object/index.html',
  'apps/training-marketplace-web/object/read-model.mjs',
  'apps/training-marketplace-web/object/styles.css',
  'docs/product/trainingos-marketplace-public-object-routes-v1.md',
  'docs/testing/trainingos-marketplace-public-object-routes-v1-audit.md',
  'packages/training-marketplace-public-object/package.json',
  'packages/training-marketplace-public-object/src/index.d.ts',
  'packages/training-marketplace-public-object/src/index.mjs',
  'tests/test_trainingos_marketplace_public_object_routes_v1.py',
]);

const EXPECTED_NODE_COUNT = 0;
const EXPECTED_PYTHON_COUNT = 16;
const EXPECTED_MIGRATION_COUNT = 368;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const marketplacePublicObjectCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('python-contract', 'python', [
    '-m', 'unittest', '-v', 'tests.test_trainingos_marketplace_public_object_routes_v1',
  ], 'python'),
  command('package-syntax', 'node', [
    '--check', 'packages/training-marketplace-public-object/src/index.mjs',
  ]),
  command('object-app-syntax', 'node', [
    '--check', 'apps/training-marketplace-web/object/app.mjs',
  ]),
  command('object-read-model-syntax', 'node', [
    '--check', 'apps/training-marketplace-web/object/read-model.mjs',
  ]),
  command('object-fixture-syntax', 'node', [
    '--check', 'apps/training-marketplace-web/object/fixture-read-model.mjs',
  ]),
  command('declaration-typecheck', 'npx', [
    'tsc', '--strict', '--noEmit', '--skipLibCheck',
    '--target', 'ES2022', '--module', 'ESNext',
    '--moduleResolution', 'Bundler', '--lib', 'ES2022,DOM',
    'packages/training-marketplace-public-object/src/index.d.ts',
  ]),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npm', ['run', 'build']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

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

export function isMarketplacePublicObjectScope(files) {
  const names = [...files];
  return names.length === MARKETPLACE_PUBLIC_OBJECT_EXACT_FILES.size
    && names.every((name) => MARKETPLACE_PUBLIC_OBJECT_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function fixedInputContract(input, scope) {
  return Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(EXPECTED_MIGRATION_COUNT)
    && scope.expected_changed_file_count === '11'
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
}

export async function maybeRunMarketplacePublicObjectProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isMarketplacePublicObjectScope(files)) return null;

  if (!fixedInputContract(input, scope)) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return {
      ok: false,
      status: 'FAIL:fixed-input-contract',
      failedLabels: Object.freeze(['fixed-input-contract']),
      stepCount: marketplacePublicObjectCommands.length,
      passedStepCount: 0,
      nodeTests: 0,
      nodePassed: 0,
      nodeFailed: 0,
      pythonTests: 0,
      selectedSuite: 'marketplace-public-object',
    };
  }

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let pythonTests = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of marketplacePublicObjectCommands.entries()) {
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
      if (item.kind === 'python') pythonTests += parsePython(output);
      if (result.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = Number(input.expectedNodeCount) === 0
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && pythonTests === EXPECTED_PYTHON_COUNT;
  const ok = passedStepCount === marketplacePublicObjectCommands.length && countsPassed;
  const status = ok
    ? 'PASS'
    : `FAIL:${failedLabels.length ? failedLabels.join(',') : 'count-contract'}`;

  return {
    ok,
    status,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: marketplacePublicObjectCommands.length,
    passedStepCount,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests,
    selectedSuite: 'marketplace-public-object',
  };
}
