import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  formatProfileStatus,
  profileCommands,
  runProfile as runStage3Profile,
} from './run-private-profile-stage3.mjs';

const OWNED_FAILURE_STEPS = new Set([
  'bootstrap',
  'runtime-check',
  'npm-ci',
  'python-contracts',
  'typecheck',
  'mvp-acceptance',
  'jhc-acceptance',
  'jhc-membership',
  'jhc-supabase-contracts',
  'trainingos-agent',
  'trainingos-agent-ui',
  'oauth-redirect',
  'production-build',
  'build-verification',
  'trainingos-ui-playwright',
  'complete',
]);

export function sanitizeOwnedFailureStep(step) {
  const normalized = String(step ?? '').trim();
  return OWNED_FAILURE_STEPS.has(normalized)
    ? `owned-${normalized}`
    : 'owned-validation';
}

async function readOwnedFailureLabel(privateRepoPath) {
  try {
    const reportPath = path.join(
      privateRepoPath,
      '.trainingos-ci',
      'owned-container-ci-report.json',
    );
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    return sanitizeOwnedFailureStep(report.failedOrLastStep);
  } catch {
    return 'owned-validation';
  }
}

export async function runProfile(input) {
  const result = await runStage3Profile(input);
  if (
    input.profile !== 'generic-owned'
    || result.ok
    || !result.failedLabels.includes('owned-validation')
  ) {
    return result;
  }

  const ownedFailureLabel = await readOwnedFailureLabel(input.privateRepoPath);
  const failedLabels = result.failedLabels.map((label) => (
    label === 'owned-validation' ? ownedFailureLabel : label
  ));

  return {
    ...result,
    status: result.status.replace('owned-validation', ownedFailureLabel),
    failedLabels: Object.freeze(failedLabels),
  };
}

export { formatProfileStatus, profileCommands };
