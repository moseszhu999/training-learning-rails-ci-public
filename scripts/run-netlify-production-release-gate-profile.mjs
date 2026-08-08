import { closeSync, openSync } from 'node:fs';
import { readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const NETLIFY_PRODUCTION_RELEASE_GATE_EXACT_FILES = new Set([
  'docs/deployment/trainingos-netlify-production-release-gate-v1.md',
  'netlify.toml',
  'prototypes/trainingos-agent-mvp-v1/test/netlify-production-release-gate.test.mjs',
  'scripts/trainingos-netlify-production-release-gate.mjs',
  'tests/test_trainingos_netlify_production_release_gate_v1.py',
]);

const EXPECTED_NODE_COUNT = 10;
const EXPECTED_PYTHON_COUNT = 12;
const EXPECTED_CHANGED_FILE_COUNT = 5;
const EXPECTED_MIGRATION_COUNT = 369;
const PROMOTION_AUTH_ENV = 'TRAININGOS_PRODUCTION_PROMOTION_AUTHORIZED';
const PROMOTION_SHA_ENV = 'TRAININGOS_PRODUCTION_PROMOTION_SHA';

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const netlifyProductionReleaseGateCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('gate-syntax', 'node', ['--check', 'scripts/trainingos-netlify-production-release-gate.mjs']),
  command('production-default-skip', 'node', ['scripts/trainingos-netlify-production-release-gate.mjs'], 'production-skip'),
  command('deploy-preview-continues', 'node', ['scripts/trainingos-netlify-production-release-gate.mjs'], 'preview-continue'),
  command('focused-node-contracts', 'node', [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/test/netlify-production-release-gate.test.mjs',
  ], 'node'),
  command('focused-python-contracts', 'python', [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_netlify_production_release_gate_v1',
  ], 'python'),
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

function parsePython(text) {
  return [...String(text).matchAll(/Ran\s+(\d+)\s+tests?/g)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

function expectedGateLine(kind) {
  if (kind === 'production-skip') {
    return 'TRAININGOS_NETLIFY_PRODUCTION_GATE decision=SKIP_PRODUCTION reason=authorization-disabled';
  }
  if (kind === 'preview-continue') {
    return 'TRAININGOS_NETLIFY_PRODUCTION_GATE decision=CONTINUE_NON_PRODUCTION reason=non-production-context';
  }
  return '';
}

function gateEnvironment(kind, privateExactSha) {
  return {
    ...process.env,
    CONTEXT: kind === 'production-skip' ? 'production' : 'deploy-preview',
    COMMIT_REF: privateExactSha,
    [PROMOTION_AUTH_ENV]: '',
    [PROMOTION_SHA_ENV]: '',
  };
}

function gateStagePassed(item, result, output) {
  if (item.kind === 'production-skip') {
    return result.status === 0 && String(output).trim() === expectedGateLine(item.kind);
  }
  if (item.kind === 'preview-continue') {
    return result.status === 1 && String(output).trim() === expectedGateLine(item.kind);
  }
  return result.status === 0;
}

async function canonicalMigrationCount(privateRepoPath) {
  const entries = await readdir(path.join(privateRepoPath, 'supabase/migrations'));
  return entries.filter((name) => /^\d{14}_.+\.sql$/.test(name)).length;
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

export function isNetlifyProductionReleaseGateScope(files) {
  const names = [...files];
  return names.length === NETLIFY_PRODUCTION_RELEASE_GATE_EXACT_FILES.size
    && names.every((name) => NETLIFY_PRODUCTION_RELEASE_GATE_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function failedResult(reason) {
  return {
    ok: false,
    status: `FAIL:${reason}`,
    failedLabels: Object.freeze([reason]),
    stepCount: netlifyProductionReleaseGateCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'netlify-production-release-gate',
  };
}

export async function maybeRunNetlifyProductionReleaseGateProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isNetlifyProductionReleaseGateScope(files)) return null;

  let actualMigrationCount = -1;
  try {
    actualMigrationCount = await canonicalMigrationCount(input.privateRepoPath);
  } catch {
    actualMigrationCount = -1;
  }

  const fixedInputs = Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(EXPECTED_MIGRATION_COUNT)
    && actualMigrationCount === EXPECTED_MIGRATION_COUNT
    && scope.expected_changed_file_count === String(EXPECTED_CHANGED_FILE_COUNT)
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
  if (!fixedInputs) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedResult('fixed-input-contract');
  }

  let passedStepCount = 0;
  let nodeTests = 0;
  let nodePassed = 0;
  let pythonTests = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of netlifyProductionReleaseGateCommands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const env = item.kind === 'production-skip' || item.kind === 'preview-continue'
        ? gateEnvironment(item.kind, input.privateExactSha)
        : process.env;
      const result = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env,
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
      const stagePassed = gateStagePassed(item, result, output);
      if (stagePassed) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = nodeTests === EXPECTED_NODE_COUNT
    && nodePassed === EXPECTED_NODE_COUNT
    && pythonTests === EXPECTED_PYTHON_COUNT;
  const stepCount = netlifyProductionReleaseGateCommands.length;
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
    nodeFailed: nodeTests - nodePassed,
    pythonTests,
    selectedSuite: 'netlify-production-release-gate',
  };
}
