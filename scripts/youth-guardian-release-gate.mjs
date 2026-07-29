import { closeSync, openSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const YOUTH_GUARDIAN_TEST_PATTERN = 'test_trainingos_youth_guardian_*.py';
export const YOUTH_GUARDIAN_MISSING_LABEL = 'youth-guardian-contract-missing';
export const YOUTH_GUARDIAN_FAILED_LABEL = 'youth-guardian-contract-failed';

export function countYouthGuardianTests(text) {
  return [...String(text ?? '').matchAll(/Ran\s+(\d+)\s+tests?/g)]
    .reduce((total, match) => total + Number(match[1]), 0);
}

export async function runYouthGuardianReleaseGate({ privateRepoPath, runnerTemp }) {
  const logPath = path.join(runnerTemp, 'trainingos-youth-guardian-release-gate.log');
  const descriptor = openSync(logPath, 'w', 0o600);
  const result = spawnSync(
    'python',
    [
      '-m',
      'unittest',
      'discover',
      '-s',
      'tests',
      '-p',
      YOUTH_GUARDIAN_TEST_PATTERN,
      '-v',
    ],
    {
      cwd: privateRepoPath,
      stdio: ['ignore', descriptor, descriptor],
      shell: false,
    },
  );
  closeSync(descriptor);

  const text = await readFile(logPath, 'utf8').catch(() => '');
  const tests = countYouthGuardianTests(text);
  const ok = result.status === 0 && tests > 0;
  return Object.freeze({
    ok,
    tests,
    status: ok ? 'PASS' : 'FAIL',
    failureLabel: tests === 0
      ? YOUTH_GUARDIAN_MISSING_LABEL
      : YOUTH_GUARDIAN_FAILED_LABEL,
  });
}

export function applyYouthGuardianReleaseGate(profileResult, guardianGate) {
  const result = profileResult ?? {};
  const baseLabels = Array.isArray(result.failedLabels) ? result.failedLabels : [];
  const stepCount = Number(result.stepCount ?? 0) + 1;
  const passedStepCount = Number(result.passedStepCount ?? 0) + (guardianGate.ok ? 1 : 0);
  const pythonTests = Number(result.pythonTests ?? 0) + Number(guardianGate.tests ?? 0);

  if (guardianGate.ok) {
    return {
      ...result,
      stepCount,
      passedStepCount,
      pythonTests,
      youthGuardianGate: 'PASS',
    };
  }

  const failedLabels = Object.freeze([
    ...new Set([...baseLabels, guardianGate.failureLabel]),
  ]);
  return {
    ...result,
    ok: false,
    status: `FAIL:${failedLabels.join(',')}`,
    failedLabels,
    stepCount,
    passedStepCount,
    pythonTests,
    youthGuardianGate: 'FAIL',
  };
}
