import { mkdir, readFile, rm } from 'node:fs/promises';
import { closeSync, openSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  challengePostMergeProfileCommands,
  databaseFailureLabel,
  formatProfileStatus,
  profileCommands,
  runProfile as runStage2Profile,
} from './run-private-profile-stage2.mjs';

const teacherHubCommands = profileCommands['teacher-hub'];
const teacherHubPython = teacherHubCommands.find((item) => item.label === 'python-contract');
if (!teacherHubPython) {
  throw new Error('teacher-hub python-contract command is required');
}
const formalActionContract = 'tests.test_trainingos_teacher_operations_hub_formal_actions_contract';
if (!teacherHubPython.args.includes(formalActionContract)) {
  teacherHubPython.args.push(formalActionContract);
}

const challengePostMergeV2Files = Object.freeze([
  'tests/sql/trainingos_challenge_runtime_v1_e2e_runner.sql',
  'tests/test_trainingos_assessment_resume_execution_contract.py',
  'tests/test_trainingos_student_exercise_execution_contract.py',
]);

export function isChallengePostMergeV2Files(files) {
  const normalized = [...files].sort();
  return normalized.length === challengePostMergeV2Files.length
    && normalized.every((name, index) => name === challengePostMergeV2Files[index]);
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

async function runPostMergeV2Profile({
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
    for (const [index, item] of challengePostMergeProfileCommands.entries()) {
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
  const ok = passedSteps === challengePostMergeProfileCommands.length && countsPassed;
  return {
    ok,
    status: formatProfileStatus({ ok, failedLabels, countsPassed }),
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: challengePostMergeProfileCommands.length,
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
    if (isChallengePostMergeV2Files(files)) return runPostMergeV2Profile(input);
  }
  return runStage2Profile(input);
}

export { formatProfileStatus, profileCommands };
