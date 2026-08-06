import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const MARKETPLACE_SOURCE_REFRESH_EXACT_FILES = new Set([
  'docs/product/trainingos-marketplace-source-refresh-orchestration-v1.md',
  'packages/training-marketplace-source-refresh/package.json',
  'packages/training-marketplace-source-refresh/src/index.d.ts',
  'packages/training-marketplace-source-refresh/src/index.mjs',
  'tests/training-marketplace-source-refresh-orchestration-v1.test.mjs',
]);

const CANONICAL_MIGRATION_COUNT = 368;
const EXPECTED_NODE_COUNT = 13;
const EXPECTED_PYTHON_COUNT = 0;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const marketplaceSourceRefreshCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('package-syntax', 'node', ['--check', 'packages/training-marketplace-source-refresh/src/index.mjs']),
  command('focused-node-contracts', 'node', ['--test', 'tests/training-marketplace-source-refresh-orchestration-v1.test.mjs'], 'node'),
  command('declaration-typecheck', 'npx', [
    'tsc', '--noEmit', '--strict', '--skipLibCheck', 'false',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022',
    'packages/training-marketplace-source-refresh/src/index.d.ts',
  ]),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npm', ['run', 'build']),
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

export function isMarketplaceSourceRefreshScope(files) {
  const names = [...files];
  return names.length === MARKETPLACE_SOURCE_REFRESH_EXACT_FILES.size
    && names.every((name) => MARKETPLACE_SOURCE_REFRESH_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'))
    && names.every((name) => !name.startsWith('apps/training-web/'))
    && names.every((name) => !name.startsWith('lib/trainingos-agent-gateway/'));
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: marketplaceSourceRefreshCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'marketplace-source-refresh',
  };
}

export async function maybeRunMarketplaceSourceRefreshProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isMarketplaceSourceRefreshScope(files)) return null;

  const fixedInput = Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(CANONICAL_MIGRATION_COUNT)
    && scope.expected_changed_file_count === '5'
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
  if (!fixedInput) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedContractResult();
  }

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let nodeTests = 0;
  let nodePassed = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of marketplaceSourceRefreshCommands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const result = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: { ...process.env },
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

  const countsPassed = nodeTests === EXPECTED_NODE_COUNT && nodePassed === EXPECTED_NODE_COUNT;
  const ok = passedStepCount === marketplaceSourceRefreshCommands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: marketplaceSourceRefreshCommands.length,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed: nodeTests - nodePassed,
    pythonTests: 0,
    selectedSuite: 'marketplace-source-refresh',
  };
}
