export * from './run-private-profile-stage15.mjs';
export * from './youth-guardian-release-gate.mjs';
export * from './run-agent-native-learning-product-profile.mjs';
export * from './run-workspace-remediation-profile.mjs';
export * from './run-structured-agent-preview-profile.mjs';
export * from './run-source-audit-action-receipt-profile.mjs';
export * from './run-workspace-ia-density-profile.mjs';
export * from './run-marketplace-reviewer-authority-profile.mjs';
export * from './run-marketplace-claim-review-lifecycle-profile.mjs';
export * from './run-marketplace-public-object-profile.mjs';
export * from './run-marketplace-participation-client-profile.mjs';
export * from './run-learning-content-resolution-db-profile.mjs';
export * from './run-challenge-preparation-recipe-profile.mjs';
export * from './run-learning-workspace-contract-fix-profile.mjs';
export * from './run-workbuddy-mcp-client-path-profile.mjs';
export * from './run-learning-gain-demonstrator-profile.mjs';
export * from './run-multirole-final-gate-profile.mjs';
export * from './run-interaction-foundation-profile.mjs';
export * from './run-interaction-web-profile.mjs';
export * from './run-marketplace-discovery-core-profile.mjs';
export * from './run-marketplace-participation-profile.mjs';
export * from './run-saas-milestone-roadmap-profile.mjs';

import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runProfile as runBaseProfile } from './run-private-profile-stage15.mjs';
import { runAgentNativeLearningProductProfile } from './run-agent-native-learning-product-profile.mjs';
import { runWorkspaceRemediationProfile } from './run-workspace-remediation-profile.mjs';
import { runStructuredAgentPreviewProfile } from './run-structured-agent-preview-profile.mjs';
import { runSourceAuditActionReceiptProfile } from './run-source-audit-action-receipt-profile.mjs';
import { maybeRunWorkspaceIaDensityProfile } from './run-workspace-ia-density-profile.mjs';
import { maybeRunMarketplaceReviewerAuthorityProfile } from './run-marketplace-reviewer-authority-profile.mjs';
import { maybeRunMarketplaceClaimReviewProfile } from './run-marketplace-claim-review-lifecycle-profile.mjs';
import { maybeRunMarketplacePublicObjectProfile } from './run-marketplace-public-object-profile.mjs';
import { maybeRunMarketplaceParticipationClientProfile } from './run-marketplace-participation-client-profile.mjs';
import { maybeRunLearningContentResolutionDbProfile } from './run-learning-content-resolution-db-profile.mjs';
import { maybeRunChallengePreparationRecipeProfile } from './run-challenge-preparation-recipe-profile.mjs';
import { maybeRunLearningWorkspaceContractFixProfile } from './run-learning-workspace-contract-fix-profile.mjs';
import { maybeRunWorkBuddyMcpClientPathProfile } from './run-workbuddy-mcp-client-path-profile.mjs';
import { maybeRunLearningGainDemonstratorProfile } from './run-learning-gain-demonstrator-profile.mjs';
import { maybeRunMultiroleFinalGateProfile } from './run-multirole-final-gate-profile.mjs';
import { maybeRunInteractionFoundationProfile } from './run-interaction-foundation-profile.mjs';
import { maybeRunInteractionWebProfile } from './run-interaction-web-profile.mjs';
import { maybeRunMarketplaceDiscoveryCoreProfile } from './run-marketplace-discovery-core-profile.mjs';
import { maybeRunMarketplaceParticipationProfile } from './run-marketplace-participation-profile.mjs';
import { maybeRunSaasMilestoneRoadmapProfile } from './run-saas-milestone-roadmap-profile.mjs';
import {
  applyYouthGuardianReleaseGate,
  runYouthGuardianReleaseGate,
} from './youth-guardian-release-gate.mjs';
import {
  sanitizeBuildSubstage,
  sanitizeTypeScriptDiagnostics,
} from './sanitize-challenge-web-diagnostics.mjs';
import { sanitizeTeacherHubPlaywrightFailure } from './sanitize-teacher-hub-playwright-diagnostics.mjs';

async function readSealedProfileLog(runnerTemp, index) {
  try {
    return await readFile(path.join(runnerTemp, `trainingos-profile-${index}.log`), 'utf8');
  } catch {
    return '';
  }
}

function supportsSanitizedDiagnostics(profile, selectedSuite) {
  return profile === 'challenge-web'
    || selectedSuite === 'youth-learning'
    || selectedSuite === 'student-chill-learning';
}

export function formatPublicProfileStatus({
  profile,
  selectedSuite,
  status,
  typecheckDiagnostics,
  buildSubstage,
  hasPlaywrightFailure = false,
  playwrightFailure = 'NOT_APPLICABLE',
}) {
  if (status === 'PASS') return status;
  if (supportsSanitizedDiagnostics(profile, selectedSuite)) {
    return `${status}|ts=${typecheckDiagnostics}|build=${buildSubstage}`;
  }
  if (profile === 'teacher-hub' && hasPlaywrightFailure) {
    return `${status}|pw=${playwrightFailure}`;
  }
  return status;
}

export async function runProfile(input) {
  if (input.profile === 'agent-native-learning-product') {
    return runAgentNativeLearningProductProfile(input);
  }

  if (input.profile === 'workspace-remediation') {
    return runWorkspaceRemediationProfile(input);
  }

  if (input.profile === 'structured-agent-preview') {
    return runStructuredAgentPreviewProfile(input);
  }

  if (input.profile === 'source-audit-action-receipt') {
    return runSourceAuditActionReceiptProfile(input);
  }

  const workspaceIaDensity = await maybeRunWorkspaceIaDensityProfile(input);
  if (workspaceIaDensity) return workspaceIaDensity;

  const marketplaceReviewerAuthority = await maybeRunMarketplaceReviewerAuthorityProfile(input);
  if (marketplaceReviewerAuthority) return marketplaceReviewerAuthority;

  const marketplaceClaimReview = await maybeRunMarketplaceClaimReviewProfile(input);
  if (marketplaceClaimReview) return marketplaceClaimReview;

  const marketplacePublicObject = await maybeRunMarketplacePublicObjectProfile(input);
  if (marketplacePublicObject) return marketplacePublicObject;

  const marketplaceParticipationClient = await maybeRunMarketplaceParticipationClientProfile(input);
  if (marketplaceParticipationClient) return marketplaceParticipationClient;

  const marketplaceParticipation = await maybeRunMarketplaceParticipationProfile(input);
  if (marketplaceParticipation) return marketplaceParticipation;

  const marketplaceDiscoveryCore = await maybeRunMarketplaceDiscoveryCoreProfile(input);
  if (marketplaceDiscoveryCore) return marketplaceDiscoveryCore;

  const saasMilestoneRoadmap = await maybeRunSaasMilestoneRoadmapProfile(input);
  if (saasMilestoneRoadmap) return saasMilestoneRoadmap;

  const interactionWeb = await maybeRunInteractionWebProfile(input);
  if (interactionWeb) return interactionWeb;

  const interactionFoundation = await maybeRunInteractionFoundationProfile(input);
  if (interactionFoundation) return interactionFoundation;

  const multiroleFinalGate = await maybeRunMultiroleFinalGateProfile(input);
  if (multiroleFinalGate) return multiroleFinalGate;

  const learningGainDemonstrator = await maybeRunLearningGainDemonstratorProfile(input);
  if (learningGainDemonstrator) return learningGainDemonstrator;

  const workBuddyMcpClientPath = await maybeRunWorkBuddyMcpClientPathProfile(input);
  if (workBuddyMcpClientPath) return workBuddyMcpClientPath;

  const learningWorkspaceContractFix = await maybeRunLearningWorkspaceContractFixProfile(input);
  if (learningWorkspaceContractFix) return learningWorkspaceContractFix;

  const challengePreparation = await maybeRunChallengePreparationRecipeProfile(input);
  if (challengePreparation) return challengePreparation;

  const databaseProjection = await maybeRunLearningContentResolutionDbProfile(input);
  if (databaseProjection) return databaseProjection;

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
    privateExactSha: process.env.PRIVATE_EXACT_SHA,
    runnerTemp,
    expectedNodeCount: process.env.EXPECTED_NODE_COUNT,
    expectedPythonCount: process.env.EXPECTED_PYTHON_COUNT,
  });

  let typecheckDiagnostics = 'NOT_APPLICABLE';
  let buildSubstage = 'NOT_APPLICABLE';
  let playwrightFailure = 'NOT_APPLICABLE';
  if (supportsSanitizedDiagnostics(profile, result.selectedSuite)) {
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
  const hasPlaywrightFailure = profile === 'teacher-hub'
    && result.failedLabels.includes('playwright');
  if (hasPlaywrightFailure) {
    playwrightFailure = sanitizeTeacherHubPlaywrightFailure(
      await readSealedProfileLog(runnerTemp, result.stepCount),
    );
  }

  const publicStatus = formatPublicProfileStatus({
    profile,
    selectedSuite: result.selectedSuite,
    status: result.status,
    typecheckDiagnostics,
    buildSubstage,
    hasPlaywrightFailure,
    playwrightFailure,
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
    `playwright_failure=${playwrightFailure}`,
    `selected_suite=${result.selectedSuite ?? 'NOT_APPLICABLE'}`,
    `youth_guardian_gate=${result.youthGuardianGate ?? 'NOT_APPLICABLE'}`,
  ].join('\n') + '\n', 'utf8');
  console.log(
    `PROFILE_VALIDATION status=${publicStatus} steps=${result.passedStepCount}/${result.stepCount} node=${result.nodePassed}/${result.nodeTests} python=${result.pythonTests} playwright=${playwrightFailure} suite=${result.selectedSuite ?? 'NOT_APPLICABLE'} youth_guardian=${result.youthGuardianGate ?? 'NOT_APPLICABLE'}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`PROFILE_VALIDATION status=FAIL reason=${error.name}`);
    process.exitCode = 1;
  });
}
