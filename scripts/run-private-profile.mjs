export * from './run-private-profile-stage6.mjs';
export * from './youth-guardian-release-gate.mjs';

import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runProfile as runBaseProfile } from './run-private-profile-stage6.mjs';
import {
  applyYouthGuardianReleaseGate,
  runYouthGuardianReleaseGate,
} from './youth-guardian-release-gate.mjs';
import {
  sanitizeBuildSubstage,
  sanitizeTypeScriptDiagnostics,
} from './sanitize-challenge-web-diagnostics.mjs';

async function readSealedProfileLog(runnerTemp, index) {
  try {
    return await readFile(path.join(runnerTemp, `trainingos-profile-${index}.log`), 'utf8');
  } catch {
    return '';
  }
}

export function formatPublicProfileStatus({ profile, status, typecheckDiagnostics, buildSubstage }) {
  if (profile !== 'challenge-web' || status === 'PASS') return status;
  return `${status}|ts=${typecheckDiagnostics}|build=${buildSubstage}`;
}

export async function runProfile(input) {
  const result = await runBaseProfile(input);
  if (input.profile !== 'challenge-web') return result;

  const guardianGate = await runYouthGuardianReleaseGate({
    privateRepoPath: input.privateRepoPath,
    runnerTemp: input.runnerTemp,
  });
  return applyYouthGuardianReleaseGate(result, guardianGate);
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

  const publicStatus = formatPublicProfileStatus({
    profile,
    status: result.status,
    typecheckDiagnostics,
    buildSubstage,
  });
  await appendFile(outputPath, [
    `status=${publicStatus}`,
    `step_count=${result.stepCount}`,
    `passed_step_count=${result.passedStepCount}`,
    `node_tests=${result.nodeTests}`,
    `node_passed=${result.nodePassed}`,
    `python_tests=${result.pythonTests}`,
    `typecheck_diagnostics=${typecheckDiagnostics}`,
    `build_substage=${buildSubstage}`,
    `youth_guardian_gate=${result.youthGuardianGate ?? 'NOT_APPLICABLE'}`,
  ].join('\n') + '\n', 'utf8');
  console.log(
    `PROFILE_VALIDATION status=${publicStatus} steps=${result.passedStepCount}/${result.stepCount} node=${result.nodePassed}/${result.nodeTests} python=${result.pythonTests} youth_guardian=${result.youthGuardianGate ?? 'NOT_APPLICABLE'}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`PROFILE_VALIDATION status=FAIL reason=${error.name}`);
    process.exitCode = 1;
  });
}
