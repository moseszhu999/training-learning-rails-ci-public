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

const CANONICAL_MIGRATION_COUNT = 360;
const EXPECTED_NODE_COUNT = 13;
const EXPECTED_PYTHON_COUNT = 0;

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

function parseNode(text) {
  return [...text.matchAll(/^# tests\s+(\d+)$/gm)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

function parseNodePassed(text) {
  return [...text.matchAll(/^# pass\s+(\d+)$/gm)]
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

export function isMarketplaceDiscoveryCoreScope(files) {
  const names = [...files];
  return names.length === MARKETPLACE_DISCOVERY_CORE_EXACT_FILES.size
    && names.every((name) => MARKETPLACE_DISCOVERY_CORE_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'))
    && names.every((name) => !name.startsWith('apps/training-web/'))
    && names.every((name) => !name.startsWith('lib/trainingos-agent-gateway/'));
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
    stepCount: marketplaceDiscoveryCoreCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'marketplace-discovery-core',
  };
}

export async function maybeRunMarketplaceDiscoveryCoreProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isMarketplaceDiscoveryCoreScope(files)) return null;

  if (!fixedInputContract(input, scope)) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedContractResult();
  }

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let nodeTests = 0;
  let nodePassed = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of marketplaceDiscoveryCoreCommands.entries()) {
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
        nodeTests += parseNode(output);
        nodePassed += parseNodePassed(output);
      }
      if (result.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = nodeTests === EXPECTED_NODE_COUNT
    && nodePassed === EXPECTED_NODE_COUNT;
  const ok = passedStepCount === marketplaceDiscoveryCoreCommands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: marketplaceDiscoveryCoreCommands.length,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed: nodeTests - nodePassed,
    pythonTests: 0,
    selectedSuite: 'marketplace-discovery-core',
  };
}
