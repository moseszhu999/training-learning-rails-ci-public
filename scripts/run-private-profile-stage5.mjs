import { appendFile, mkdir, readFile, rm } from 'node:fs/promises';
import { closeSync, openSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { databaseFailureLabel } from './run-private-profile-stage2.mjs';
import {
  formatProfileStatus,
  profileCommands,
  runProfile as runStage4Profile,
} from './run-private-profile-stage4.mjs';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const challengeOfferProfileCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('syntax-package', 'node', ['--check', 'packages/training-challenge-offer/src/index.mjs']),
  command('syntax-gateway', 'node', ['--check', 'lib/trainingos-agent-gateway/challenge-offer-entitlement.mjs']),
  command('node-contract', 'node', [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/test/challenge-offer-entitlement-v1.test.mjs',
  ], 'node'),
  command('python-contract', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_challenge_offer_entitlement_v1_contract',
  ], 'python'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('database-replay', 'bash', [path.join(publicRoot, 'scripts/run-challenge-offer-database.sh')]),
]);

export const youthLearningProfileCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('owned-python-contracts', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_youth_learning_product_v1',
  ], 'python'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
]);

export const youthGuardianProfileCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('syntax-package', 'node', ['--check', 'packages/training-youth-safety/src/index.mjs']),
  command('syntax-gateway', 'node', ['--check', 'lib/trainingos-agent-gateway/youth-safety-runtime.mjs']),
  command('node-contract', 'node', [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/test/youth-safety-v1.test.mjs',
  ], 'node'),
  command('python-contract', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_youth_guardian_safety_v1_contract',
  ], 'python'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('database-replay', 'bash', [path.join(publicRoot, 'scripts/run-youth-guardian-database.sh')]),
]);

const YOUTH_LEARNING_PREFIXES = Object.freeze([
  'apps/training-web/src/youth-mode/',
  'packages/training-youth-learning/',
  'docs/product/trainingos-youth-learning-',
  'docs/testing/trainingos-youth-learning-',
  'tests/test_trainingos_youth_learning_',
]);

const YOUTH_GUARDIAN_EXACT_FILES = new Set([
  'docs/architecture/trainingos-youth-safety-runtime-v1.md',
  'docs/testing/trainingos-youth-safety-runtime-v1-verification.md',
  'lib/trainingos-agent-gateway/youth-safety-runtime.mjs',
  'packages/training-youth-safety/package.json',
  'packages/training-youth-safety/src/index.mjs',
  'prototypes/trainingos-agent-mvp-v1/test/youth-safety-v1.test.mjs',
  'tests/sql/trainingos_youth_guardian_safety_v1_e2e.sql',
  'tests/sql/trainingos_youth_guardian_safety_v1_e2e_runner.sql',
  'tests/test_trainingos_youth_guardian_safety_v1_contract.py',
]);

const YOUTH_GUARDIAN_MIGRATION = /^supabase\/migrations\/2026073009[0-5][0-9]{2}_trainingos_youth_guardian_safety_v1_[a-z0-9_]+\.sql$/;

export function isChallengeOfferFiles(files) {
  const names = [...files];
  const hasOffer = names.some((name) => name.startsWith('packages/training-challenge-offer/'));
  const hasOtherChallengeOwner = names.some((name) => (
    name.startsWith('packages/training-challenge/src/')
    || name.startsWith('packages/training-challenge-evaluation/')
    || name.startsWith('packages/training-challenge-proof/')
    || name.startsWith('packages/training-invite-growth/')
  ));
  return hasOffer && !hasOtherChallengeOwner;
}

export function isYouthLearningFiles(files) {
  const names = [...files];
  if (!names.length) return false;
  const hasProductPackage = names.some((name) => (
    name.startsWith('packages/training-youth-learning/')
  ));
  const hasFocusedContract = names.includes(
    'tests/test_trainingos_youth_learning_product_v1.py',
  );
  const allOwned = names.every((name) => (
    YOUTH_LEARNING_PREFIXES.some((prefix) => name.startsWith(prefix))
  ));
  return hasProductPackage && hasFocusedContract && allOwned;
}

export function isYouthGuardianFiles(files) {
  const names = [...files];
  if (!names.length) return false;
  const migrations = names.filter((name) => name.startsWith('supabase/migrations/'));
  const allOwned = names.every((name) => (
    YOUTH_GUARDIAN_EXACT_FILES.has(name) || YOUTH_GUARDIAN_MIGRATION.test(name)
  ));
  return allOwned
    && names.includes('packages/training-youth-safety/src/index.mjs')
    && names.includes('tests/test_trainingos_youth_guardian_safety_v1_contract.py')
    && names.includes('tests/sql/trainingos_youth_guardian_safety_v1_e2e_runner.sql')
    && migrations.length === 4;
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

async function runFixedProfile({
  commands,
  privateRepoPath,
  runnerTemp,
  expectedNodeCount,
  expectedPythonCount,
}) {
  await mkdir(runnerTemp, { recursive: true });
  let nodeTests = 0;
  let nodePassed = 0;
  let nodeFailed = 0;
  let pythonTests = 0;
  let passedSteps = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of commands.entries()) {
      const logPath = path.join(runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const result = spawnSync(item.executable, item.args, {
        cwd: privateRepoPath,
        env: process.env,
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      const text = await readFile(logPath, 'utf8');
      if (item.kind === 'node') {
        const parsed = parseNode(text);
        nodeTests += parsed.tests;
        nodePassed += parsed.passed;
        nodeFailed += parsed.failed;
      }
      if (item.kind === 'python') pythonTests += parsePython(text).tests;
      if (result.status === 0) passedSteps += 1;
      else if (item.label === 'database-replay') failedLabels.push(databaseFailureLabel(text));
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const expectedNode = Number(expectedNodeCount);
  const expectedPython = Number(expectedPythonCount);
  const countsPassed = nodeTests === expectedNode
    && nodePassed === expectedNode
    && nodeFailed === 0
    && pythonTests === expectedPython;
  const ok = passedSteps === commands.length && countsPassed;
  return {
    ok,
    status: formatProfileStatus({ ok, failedLabels, countsPassed }),
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: commands.length,
    passedStepCount: passedSteps,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests,
  };
}

export async function runProfile(input) {
  if (input.profile === 'challenge-runtime') {
    const files = await changedFiles(input);
    if (isChallengeOfferFiles(files)) {
      return runFixedProfile({ ...input, commands: challengeOfferProfileCommands });
    }
  }
  if (input.profile === 'generic-owned') {
    const files = await changedFiles(input);
    if (isYouthGuardianFiles(files)) {
      return runFixedProfile({ ...input, commands: youthGuardianProfileCommands });
    }
    if (isYouthLearningFiles(files)) {
      return runFixedProfile({ ...input, commands: youthLearningProfileCommands });
    }
  }
  return runStage4Profile(input);
}

export { formatProfileStatus, profileCommands };

async function main() {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required');
  const result = await runProfile({
    profile: process.env.VALIDATION_PROFILE,
    privateRepoPath: process.env.PRIVATE_REPO_PATH,
    runnerTemp: process.env.RUNNER_TEMP,
    expectedNodeCount: process.env.EXPECTED_NODE_COUNT,
    expectedPythonCount: process.env.EXPECTED_PYTHON_COUNT,
  });
  await appendFile(outputPath, [
    `status=${result.status}`,
    `step_count=${result.stepCount}`,
    `passed_step_count=${result.passedStepCount}`,
    `node_tests=${result.nodeTests}`,
    `node_passed=${result.nodePassed}`,
    `python_tests=${result.pythonTests}`,
  ].join('\n') + '\n', 'utf8');
  console.log(
    `PROFILE_VALIDATION status=${result.status} steps=${result.passedStepCount}/${result.stepCount} node=${result.nodePassed}/${result.nodeTests} python=${result.pythonTests}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`PROFILE_VALIDATION status=FAIL reason=${error.name}`);
    process.exitCode = 1;
  });
}
