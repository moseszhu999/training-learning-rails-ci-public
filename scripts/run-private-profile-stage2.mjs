import { appendFile, mkdir, readFile, rm } from 'node:fs/promises';
import { closeSync, openSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  formatProfileStatus,
  profileCommands,
  runProfile as runBaseProfile,
} from './run-private-profile-base.mjs';
import {
  sanitizeBuildSubstage,
  sanitizeTypeScriptDiagnostics,
} from './sanitize-challenge-web-diagnostics.mjs';

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

const teacherHubCommands = profileCommands['teacher-hub'];
const unrelatedLearningWorkspaceIndex = teacherHubCommands.findIndex(
  (item) => item.label === 'learning-workspace-validation',
);
if (unrelatedLearningWorkspaceIndex >= 0) {
  teacherHubCommands.splice(unrelatedLearningWorkspaceIndex, 1);
}

export const challengeEvaluationProfileCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('syntax-evaluation', 'node', ['--check', 'packages/training-challenge-evaluation/index.mjs']),
  command('syntax-pack', 'node', ['--check', 'packages/training-challenge-packs/ai_evidence_audit_v1/pack.mjs']),
  command('syntax-gateway', 'node', ['--check', 'lib/trainingos-agent-gateway/challenge-evaluation-runtime.mjs']),
  command('node-contract', 'node', ['--test', 'packages/training-challenge-evaluation/tests/challenge-evaluation.test.mjs'], 'node'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
]);

export function isChallengeEvaluationFiles(files) {
  const flags = {
    canonical: files.some((name) => name.startsWith('packages/training-challenge/src/')),
    evaluation: files.some((name) => name.startsWith('packages/training-challenge-evaluation/')),
    proof: files.some((name) => name.startsWith('packages/training-challenge-proof/')),
    invite: files.some((name) => name.startsWith('packages/training-invite-growth/')),
  };
  const selected = Object.entries(flags).filter(([, enabled]) => enabled).map(([name]) => name);
  return selected.length === 1 && selected[0] === 'evaluation';
}

function parseNode(text) {
  return {
    tests: [...text.matchAll(/^# tests\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0),
    passed: [...text.matchAll(/^# pass\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0),
    failed: [...text.matchAll(/^# fail\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0),
  };
}

async function challengeFiles({ privateRepoPath, runnerTemp }) {
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

async function runChallengeEvaluationProfile({
  privateRepoPath,
  runnerTemp,
  expectedNodeCount,
  expectedPythonCount,
}) {
  await mkdir(runnerTemp, { recursive: true });
  let nodeTests = 0;
  let nodePassed = 0;
  let nodeFailed = 0;
  let passedSteps = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of challengeEvaluationProfileCommands.entries()) {
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
      if (result.status === 0) passedSteps += 1;
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
    && expectedPython === 0;
  const ok = passedSteps === challengeEvaluationProfileCommands.length && countsPassed;
  return {
    ok,
    status: formatProfileStatus({ ok, failedLabels, countsPassed }),
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: challengeEvaluationProfileCommands.length,
    passedStepCount: passedSteps,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests: 0,
  };
}

export async function runProfile(input) {
  if (input.profile === 'challenge-runtime') {
    const files = await challengeFiles(input);
    if (isChallengeEvaluationFiles(files)) return runChallengeEvaluationProfile(input);
  }
  return runBaseProfile(input);
}

export { formatProfileStatus, profileCommands };

async function readSealedProfileLog(runnerTemp, index) {
  try {
    return await readFile(path.join(runnerTemp, `trainingos-profile-${index}.log`), 'utf8');
  } catch {
    return '';
  }
}

async function main() {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required');
  const profile = process.env.VALIDATION_PROFILE;
  const runnerTemp = process.env.RUNNER_TEMP;
  const result = await runProfile({
    profile,
    privateRepoPath: process.env.PRIVATE_REPO_PATH,
    runnerTemp,
    expectedNodeCount: process.env.EXPECTED_NODE_COUNT,
    expectedPythonCount: process.env.EXPECTED_PYTHON_COUNT,
  });

  let typecheckDiagnostics = 'NOT_APPLICABLE';
  let buildSubstage = 'NOT_APPLICABLE';
  if (profile === 'challenge-web') {
    if (result.failedLabels.includes('typecheck')) {
      typecheckDiagnostics = sanitizeTypeScriptDiagnostics(
        await readSealedProfileLog(runnerTemp, 3),
      );
    }
    if (result.failedLabels.includes('production-build')) {
      buildSubstage = sanitizeBuildSubstage(
        await readSealedProfileLog(runnerTemp, 4),
      );
    }
  }

  await appendFile(outputPath, [
    `status=${result.status}`,
    `step_count=${result.stepCount}`,
    `passed_step_count=${result.passedStepCount}`,
    `node_tests=${result.nodeTests}`,
    `node_passed=${result.nodePassed}`,
    `python_tests=${result.pythonTests}`,
    `typecheck_diagnostics=${typecheckDiagnostics}`,
    `build_substage=${buildSubstage}`,
  ].join('\n') + '\n', 'utf8');
  console.log(
    `PROFILE_VALIDATION status=${result.status} steps=${result.passedStepCount}/${result.stepCount} node=${result.nodePassed}/${result.nodeTests} python=${result.pythonTests} typecheck=${typecheckDiagnostics} build=${buildSubstage}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`PROFILE_VALIDATION status=FAIL reason=${error.name}`);
    process.exitCode = 1;
  });
}
