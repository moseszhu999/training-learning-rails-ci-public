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

const databaseDetailAllowlist = new Set([
  'proof-assertion',
  'proof-evidence',
  'proof-residue',
  'proof-cleanup',
  'proof-attempt-missing',
  'proof-completion-required',
  'proof-internal-source',
  'proof-ownership',
  'proof-human-required',
  'proof-profile-required',
  'proof-source-missing',
  'proof-source-stale',
  'proof-idempotency',
  'proof-rollback-marker',
  'canonical-assertion',
  'invite-assertion',
  'permission-denied',
  'role-missing',
  'not-null',
  'check-constraint',
  'foreign-key',
  'unique-constraint',
  'ambiguous-column',
  'undefined-column',
  'undefined-relation',
  'undefined-function',
  'invalid-uuid',
  'invalid-json',
  'transaction-aborted',
  'concurrency',
]);

function safeDatabaseDetail(value) {
  if (databaseDetailAllowlist.has(value)) return value;
  if (/^sqlstate-[0-9a-z]{5}$/.test(value)) return value;
  return '';
}

export function databaseDiagnosticLabel(text) {
  const value = String(text);
  const detailed = [...value.matchAll(
    /CHALLENGE_DATABASE status=FAIL stage=([a-z0-9-]+) detail=([a-z0-9-]+)/g,
  )];
  for (const match of detailed) {
    const base = databaseFailureLabel(`CHALLENGE_DATABASE status=FAIL stage=${match[1]}`);
    const detail = safeDatabaseDetail(match[2]);
    if (base !== 'database-replay' && detail) return `${base}-${detail}`;
  }
  return databaseFailureLabel(value);
}

export function refineChallengeDatabaseFailure(result, sealedLogs = []) {
  const currentDatabaseLabels = result?.failedLabels?.filter((label) => (
    label === 'database-replay' || label.startsWith('database-')
  )) ?? [];
  if (currentDatabaseLabels.length === 0) return result;

  const refinedLabel = sealedLogs
    .map((text) => databaseDiagnosticLabel(text))
    .find((label) => (
      label !== 'database-replay'
      && !currentDatabaseLabels.includes(label)
    ));
  if (!refinedLabel) return result;

  const currentSet = new Set(currentDatabaseLabels);
  const failedLabels = result.failedLabels.map((label) => (
    currentSet.has(label) ? refinedLabel : label
  ));
  const statusLabels = result.status.startsWith('FAIL:')
    ? result.status.slice(5).split(',').map((label) => (
      currentSet.has(label) ? refinedLabel : label
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
    || !result.failedLabels.some((label) => label === 'database-replay' || label.startsWith('database-'))
  ) {
    return result;
  }

  const sealedLogs = await readSealedProfileLogs(input.runnerTemp, result.stepCount);
  return refineChallengeDatabaseFailure(result, sealedLogs);
}

export { formatProfileStatus, profileCommands };
