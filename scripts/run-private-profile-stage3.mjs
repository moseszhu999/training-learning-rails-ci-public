import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
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

const challengeWebCommands = profileCommands['challenge-web'];
const challengeWebBuild = challengeWebCommands.find((item) => item.label === 'production-build');

if (!challengeWebBuild) {
  throw new Error('challenge-web production-build command is required');
}

challengeWebBuild.executable = 'npx';
challengeWebBuild.args.splice(
  0,
  challengeWebBuild.args.length,
  'vite',
  'build',
  '--config',
  'vite.config.ts',
);

export function refineChallengeDatabaseFailure(result, sealedLogs = []) {
  if (!result?.failedLabels?.includes('database-replay')) return result;

  const refinedLabel = sealedLogs
    .map((text) => databaseFailureLabel(text))
    .find((label) => label !== 'database-replay');
  if (!refinedLabel) return result;

  const failedLabels = result.failedLabels.map((label) => (
    label === 'database-replay' ? refinedLabel : label
  ));
  const statusLabels = result.status.startsWith('FAIL:')
    ? result.status.slice(5).split(',').map((label) => (
      label === 'database-replay' ? refinedLabel : label
    ))
    : failedLabels;

  return {
    ...result,
    status: `FAIL:${[...new Set(statusLabels)].join(',')}`,
    failedLabels: Object.freeze([...new Set(failedLabels)]),
  };
}

async function readSealedProfileLogs(runnerTemp, stepCount) {
  const logs = [];
  for (let index = 1; index <= stepCount; index += 1) {
    try {
      logs.push(await readFile(path.join(runnerTemp, `trainingos-profile-${index}.log`), 'utf8'));
    } catch {
      logs.push('');
    }
  }
  return logs;
}

export async function runProfile(input) {
  const result = await runStage2Profile(input);
  if (
    input.profile !== 'challenge-runtime'
    || !result.failedLabels.includes('database-replay')
  ) {
    return result;
  }

  const sealedLogs = await readSealedProfileLogs(input.runnerTemp, result.stepCount);
  return refineChallengeDatabaseFailure(result, sealedLogs);
}

export { formatProfileStatus, profileCommands };
