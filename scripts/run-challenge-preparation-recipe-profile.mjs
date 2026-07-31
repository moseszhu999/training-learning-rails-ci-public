import { mkdir, readFile, rm } from 'node:fs/promises';
import { closeSync, openSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

const SAFE_DATABASE_STAGES = new Set([
  'scope-file', 'scope-contract',
  'fresh-init', 'fresh-bootstrap', 'fresh-manifest', 'fresh-start',
  'fresh-reset-one', 'fresh-reset-two', 'fresh-status', 'fresh-e2e', 'fresh-stop',
  'upgrade-worktree', 'upgrade-init', 'upgrade-bootstrap', 'upgrade-start',
  'upgrade-migration', 'upgrade-status', 'upgrade-e2e', 'upgrade-stop', 'complete',
]);

export const CHALLENGE_PREPARATION_EXACT_FILES = Object.freeze(new Set([
  'docs/architecture/trainingos-challenge-preparation-recipe-v1.md',
  'docs/testing/trainingos-challenge-preparation-recipe-validation-v1.md',
  'lib/trainingos-agent-gateway/challenge-preparation-recipe.mjs',
  'packages/training-challenge-preparation-recipe/package.json',
  'packages/training-challenge-preparation-recipe/src/index.mjs',
  'packages/training-recipe/src/adapters.mjs',
  'prototypes/trainingos-agent-mvp-v1/test/challenge-preparation-recipe-v1.test.mjs',
  'supabase/migrations/20260731120000_trainingos_challenge_preparation_recipe_v1.sql',
  'tests/sql/trainingos_challenge_preparation_recipe_v1_e2e.sql',
  'tests/test_trainingos_challenge_preparation_recipe_v1_contract.py',
]));

export const challengePreparationProfileCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('syntax-package', 'node', [
    '--check',
    'packages/training-challenge-preparation-recipe/src/index.mjs',
  ]),
  command('syntax-gateway', 'node', [
    '--check',
    'lib/trainingos-agent-gateway/challenge-preparation-recipe.mjs',
  ]),
  command('syntax-adapter', 'node', [
    '--check',
    'packages/training-recipe/src/adapters.mjs',
  ]),
  command('node-contract', 'node', [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/test/challenge-preparation-recipe-v1.test.mjs',
  ], 'node'),
  command('python-contract', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_challenge_preparation_recipe_v1_contract',
  ], 'python'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('database-replay', 'bash', [
    path.join(publicRoot, 'scripts/run-challenge-preparation-recipe-database.sh'),
  ], 'database'),
]);

export function isChallengePreparationRecipeFiles(files) {
  const names = [...files];
  return names.length === CHALLENGE_PREPARATION_EXACT_FILES.size
    && names.every((name) => CHALLENGE_PREPARATION_EXACT_FILES.has(name))
    && names.includes('packages/training-recipe/src/adapters.mjs')
    && names.includes('supabase/migrations/20260731120000_trainingos_challenge_preparation_recipe_v1.sql')
    && names.includes('tests/sql/trainingos_challenge_preparation_recipe_v1_e2e.sql');
}

function parseNode(text) {
  return {
    tests: [...text.matchAll(/^# tests\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0),
    passed: [...text.matchAll(/^# pass\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0),
    failed: [...text.matchAll(/^# fail\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0),
  };
}

function parsePython(text) {
  return {
    tests: [...text.matchAll(/Ran\s+(\d+)\s+tests?/g)].reduce((sum, match) => sum + Number(match[1]), 0),
  };
}

export function sanitizeChallengePreparationDatabaseStage(text) {
  const matches = [...text.matchAll(/CHALLENGE_DATABASE status=FAIL stage=([a-z0-9-]+)/g)];
  const candidate = matches.at(-1)?.[1] ?? 'unknown';
  return SAFE_DATABASE_STAGES.has(candidate) ? candidate : 'unknown';
}

async function changedFiles({ privateRepoPath, runnerTemp }) {
  const scopeText = await readFile(path.join(runnerTemp, 'trainingos-scope-contract.env'), 'utf8');
  const scope = Object.fromEntries(scopeText.trim().split('\n').map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const result = spawnSync('git', [
    '-C',
    privateRepoPath,
    'diff',
    '--name-only',
    scope.expected_base_sha,
    process.env.PRIVATE_EXACT_SHA,
  ], { encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error('git failed');
  return result.stdout.trim() ? result.stdout.trim().split('\n') : [];
}

async function runFixedProfile(input) {
  await mkdir(input.runnerTemp, { recursive: true });
  let nodeTests = 0;
  let nodePassed = 0;
  let nodeFailed = 0;
  let pythonTests = 0;
  let passedSteps = 0;
  let databaseStage = 'not-run';
  const failedLabels = [];

  try {
    for (const [index, item] of challengePreparationProfileCommands.entries()) {
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
        const parsed = parseNode(output);
        nodeTests += parsed.tests;
        nodePassed += parsed.passed;
        nodeFailed += parsed.failed;
      }
      if (item.kind === 'python') pythonTests += parsePython(output).tests;
      if (item.kind === 'database') {
        databaseStage = result.status === 0
          ? 'complete'
          : sanitizeChallengePreparationDatabaseStage(output);
      }
      if (result.status === 0) passedSteps += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const expectedNode = Number(input.expectedNodeCount);
  const expectedPython = Number(input.expectedPythonCount);
  const countsPassed = nodeTests === expectedNode
    && nodePassed === expectedNode
    && nodeFailed === 0
    && pythonTests === expectedPython;
  const ok = passedSteps === challengePreparationProfileCommands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'focused-counts';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}@${databaseStage}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: challengePreparationProfileCommands.length,
    passedStepCount: passedSteps,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests,
    selectedSuite: 'challenge-preparation-recipe',
  };
}

export async function maybeRunChallengePreparationRecipeProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const files = await changedFiles(input);
  if (!isChallengePreparationRecipeFiles(files)) return null;
  return runFixedProfile(input);
}
