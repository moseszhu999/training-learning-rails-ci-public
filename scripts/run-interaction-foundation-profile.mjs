import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const INTERACTION_FOUNDATION_EXACT_FILES = new Set([
  'docs/architecture/trainingos-interaction-foundation-v1.md',
  'docs/testing/trainingos-interaction-foundation-validation-v1.md',
  'lib/trainingos-agent-gateway/interaction.mjs',
  'packages/training-interaction/package.json',
  'packages/training-interaction/src/index.mjs',
  'packages/training-interaction/test/interaction.test.mjs',
  'prototypes/trainingos-agent-mvp-v1/test/interaction-foundation-v1.test.mjs',
  'supabase/migrations/20260802100000_trainingos_interaction_foundation_schema_v1.sql',
  'supabase/migrations/20260802100100_trainingos_interaction_foundation_rpc_v1.sql',
  'tests/sql/trainingos_interaction_foundation_v1_e2e.sql',
  'tests/test_trainingos_interaction_foundation_v1.py',
]);

const CANONICAL_MIGRATION_COUNT = 359;
const EXPECTED_NODE_COUNT = 13;
const EXPECTED_PYTHON_COUNT = 14;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const interactionFoundationCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('package-syntax', 'node', ['--check', 'packages/training-interaction/src/index.mjs']),
  command('package-tests', 'node', ['--test', 'packages/training-interaction/test/interaction.test.mjs'], 'node'),
  command('gateway-syntax', 'node', ['--check', 'lib/trainingos-agent-gateway/interaction.mjs']),
  command('gateway-tests', 'node', [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/test/interaction-foundation-v1.test.mjs',
  ], 'node'),
  command('python-static', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_interaction_foundation_v1',
  ], 'python'),
  command('database-replay', 'bash', [
    path.join(publicRoot, 'scripts/run-interaction-foundation-database.sh'),
  ], 'database'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
]);

function parseNode(text) {
  const matches = [...text.matchAll(/^# tests\s+(\d+)$/gm)];
  return matches.reduce((sum, match) => sum + Number(match[1]), 0);
}

function parseNodePassed(text) {
  const matches = [...text.matchAll(/^# pass\s+(\d+)$/gm)];
  return matches.reduce((sum, match) => sum + Number(match[1]), 0);
}

function parsePython(text) {
  return [...text.matchAll(/Ran\s+(\d+)\s+tests?/g)]
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

export function isInteractionFoundationScope(files) {
  const names = [...files];
  return names.length === INTERACTION_FOUNDATION_EXACT_FILES.size
    && names.every((name) => INTERACTION_FOUNDATION_EXACT_FILES.has(name))
    && names.filter((name) => name.startsWith('supabase/migrations/')).length === 2;
}

function fixedInputContract(input, scope) {
  return Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(CANONICAL_MIGRATION_COUNT)
    && scope.expected_changed_file_count === '11'
    && scope.migration_start === '20260802100000'
    && scope.migration_end === '20260802100100';
}

function parseDatabaseStage(text) {
  const match = [...text.matchAll(/INTERACTION_FOUNDATION_DB status=FAIL stage=([a-z0-9-]+)/g)].at(-1);
  return match?.[1] ?? 'unknown';
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract@not-run',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: interactionFoundationCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'interaction-foundation',
  };
}

export async function maybeRunInteractionFoundationProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isInteractionFoundationScope(files)) return null;

  if (!fixedInputContract(input, scope)) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedContractResult();
  }

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let nodeTests = 0;
  let nodePassed = 0;
  let pythonTests = 0;
  let databaseStage = 'not-run';
  const failedLabels = [];

  try {
    for (const [index, item] of interactionFoundationCommands.entries()) {
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

  const countsPassed = nodeTests === EXPECTED_NODE_COUNT
    && nodePassed === EXPECTED_NODE_COUNT
    && pythonTests === EXPECTED_PYTHON_COUNT;
  const ok = passedStepCount === interactionFoundationCommands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}@${databaseStage}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: interactionFoundationCommands.length,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed: nodeTests - nodePassed,
    pythonTests,
    selectedSuite: 'interaction-foundation',
  };
}
