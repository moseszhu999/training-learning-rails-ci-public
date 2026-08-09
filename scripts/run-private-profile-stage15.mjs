import {
  formatProfileStatus,
  profileCommands,
  runProfile as runStage14Profile,
} from './run-private-profile-stage14.mjs';
import { maybeRunLiveClassroomACurrentMainProfile } from './run-live-classroom-a-current-main-profile.mjs';
import { maybeRunEntitlementBillingProjectionProfile } from './run-entitlement-billing-projection-profile.mjs';
import { maybeRunProviderNeutralBillingIntentProfile } from './run-provider-neutral-billing-intent-profile.mjs';
import { maybeRunStripeTestAdapterWebhookProfile } from './run-stripe-test-adapter-webhook-profile.mjs';
import { maybeRunAgentSkillEvalFrameworkV2Profile } from './run-agent-skill-eval-framework-v2-profile.mjs';
import { maybeRunIndustryRolePackFoundationProfile } from './run-industry-role-pack-foundation-profile.mjs';
import { maybeRunIndustryRolePackRegistryProfile } from './run-industry-role-pack-registry-profile.mjs';
import { maybeRunTrainingBlueprintDraftCompilerProfile } from './run-training-blueprint-draft-compiler-profile.mjs';
import { maybeRunJavaDeveloperNewHirePilotProfile } from './run-java-developer-new-hire-pilot-blueprint-profile.mjs';
import { maybeRunTrainingBlueprintCourseAlignmentProfile } from './run-training-blueprint-course-alignment-profile.mjs';
import { maybeRunJavaPilotCourseSourceReadinessProfile } from './run-java-pilot-course-source-readiness-profile.mjs';
import { maybeRunJavaCourseCanonicalizationProfile } from './run-java-course-source-canonicalization-profile.mjs';
import { maybeRunCapabilityInitiativeProfile } from './run-capability-initiative-profile.mjs';
import { maybeRunCapabilityCredentialCoreProfile } from './run-capability-credential-core-profile.mjs';
import { maybeRunVercelMainProductionGateProfile } from './run-vercel-main-production-gate-profile.mjs';
import { maybeRunDemandScopeDeliveryReviewProfile } from './run-demand-scope-delivery-review-profile.mjs';
import { maybeRunJavaEngagementReconstructionProfile } from './run-java-engagement-reconstruction-profile.mjs';
import { maybeRunLiveClassroomTencentProviderCurrentMainProfile } from './run-live-classroom-tencent-provider-current-main-profile.mjs';
import { maybeRunLiveClassroomTeachingInteractionsCurrentMainProfile } from './run-live-classroom-teaching-interactions-current-main-profile.mjs';
import { maybeRunCanonicalNorthStarCurrentMainProfile } from './run-canonical-north-star-current-main-profile.mjs';
import { maybeRunLiveClassroomPostclassEvidenceCurrentMainProfile } from './run-live-classroom-postclass-evidence-current-main-profile.mjs';
import { maybeRunCourseDesignMcpReadV1Profile } from './run-course-design-mcp-read-v1-profile.mjs';
import { maybeRunLiveClassroomBrowserMatrixCurrentMainProfile } from './run-live-classroom-browser-matrix-current-main-profile.mjs';
import { maybeRunLiveClassroomRuntimeWiringCurrentMainProfile } from './run-live-classroom-runtime-wiring-current-main-profile.mjs';

const teacherHubCommands = profileCommands['teacher-hub'];
const roleContractsIndex = teacherHubCommands.findIndex((item) => item.label === 'role-contracts');
if (roleContractsIndex < 0) {
  throw new Error('teacher-hub role-contracts command is required');
}

const todayMasterDetail = {
  label: 'python-today-master-detail',
  moduleName: 'tests.test_trainingos_today_master_detail_v1',
};

const permissionContracts = [
  { label: 'python-role-menu-content', moduleName: 'tests.test_trainingos_role_menu_content_permissions_v1' },
  { label: 'python-advanced-settings', moduleName: 'tests.test_trainingos_advanced_settings', },
  { label: 'python-risk-intervention', moduleName: 'tests.test_trainingos_risk_intervention_ui_contract', },
  { label: 'python-zero-permission-core', moduleName: 'tests.test_trainingos_zero_permission_bridge_core_contract', },
];

for (const { label } of [todayMasterDetail, ...permissionContracts]) {
  if (teacherHubCommands.some((item) => item.label === label)) {
    throw new Error(`duplicate teacher-hub contract label: ${label}`);
  }
}

teacherHubCommands.splice(
  roleContractsIndex,
  0,
  {
    label: todayMasterDetail.label,
    executable: 'python',
    args: ['-m', 'unittest', '-v', todayMasterDetail.moduleName],
    kind: 'python',
  },
  ...permissionContracts.map(({ label, moduleName }) => ({
    label,
    executable: 'python',
    args: ['-m', 'unittest', '-v', moduleName],
    kind: 'python',
  })),
);

export async function runProfile(input) {
  const liveClassroomA = await maybeRunLiveClassroomACurrentMainProfile(input);
  if (liveClassroomA) return liveClassroomA;
  const entitlementProjection = await maybeRunEntitlementBillingProjectionProfile(input);
  if (entitlementProjection) return entitlementProjection;
  const providerNeutralBillingIntent = await maybeRunProviderNeutralBillingIntentProfile(input);
  if (providerNeutralBillingIntent) return providerNeutralBillingIntent;
  const stripeTestAdapter = await maybeRunStripeTestAdapterWebhookProfile(input);
  if (stripeTestAdapter) return stripeTestAdapter;
  const agentSkillEvalFrameworkV2 = await maybeRunAgentSkillEvalFrameworkV2Profile(input);
  if (agentSkillEvalFrameworkV2) return agentSkillEvalFrameworkV2;
  const industryRolePack = await maybeRunIndustryRolePackFoundationProfile(input);
  if (industryRolePack) return industryRolePack;
  const industryRolePackRegistry = await maybeRunIndustryRolePackRegistryProfile(input);
  if (industryRolePackRegistry) return industryRolePackRegistry;
  const trainingBlueprintDraftCompiler = await maybeRunTrainingBlueprintDraftCompilerProfile(input);
  if (trainingBlueprintDraftCompiler) return trainingBlueprintDraftCompiler;
  const javaDeveloperNewHirePilot = await maybeRunJavaDeveloperNewHirePilotProfile(input);
  if (javaDeveloperNewHirePilot) return javaDeveloperNewHirePilot;
  const trainingBlueprintCourseAlignment = await maybeRunTrainingBlueprintCourseAlignmentProfile(input);
  if (trainingBlueprintCourseAlignment) return trainingBlueprintCourseAlignment;
  const javaPilotCourseSourceReadiness = await maybeRunJavaPilotCourseSourceReadinessProfile(input);
  if (javaPilotCourseSourceReadiness) return javaPilotCourseSourceReadiness;
  const javaCourseCanonicalization = await maybeRunJavaCourseCanonicalizationProfile(input);
  if (javaCourseCanonicalization) return javaCourseCanonicalization;
  const capabilityInitiative = await maybeRunCapabilityInitiativeProfile(input);
  if (capabilityInitiative) return capabilityInitiative;
  const capabilityCredentialCore = await maybeRunCapabilityCredentialCoreProfile(input);
  if (capabilityCredentialCore) return capabilityCredentialCore;
  const vercelMainProductionGate = await maybeRunVercelMainProductionGateProfile(input);
  if (vercelMainProductionGate) return vercelMainProductionGate;
  const demandScopeDeliveryReview = await maybeRunDemandScopeDeliveryReviewProfile(input);
  if (demandScopeDeliveryReview) return demandScopeDeliveryReview;
  const javaEngagementReconstruction = await maybeRunJavaEngagementReconstructionProfile(input);
  if (javaEngagementReconstruction) return javaEngagementReconstruction;
  const liveClassroomTencentProvider = await maybeRunLiveClassroomTencentProviderCurrentMainProfile(input);
  if (liveClassroomTencentProvider) return liveClassroomTencentProvider;
  const liveClassroomTeachingInteractions = await maybeRunLiveClassroomTeachingInteractionsCurrentMainProfile(input);
  if (liveClassroomTeachingInteractions) return liveClassroomTeachingInteractions;
  const canonicalNorthStar = await maybeRunCanonicalNorthStarCurrentMainProfile(input);
  if (canonicalNorthStar) return canonicalNorthStar;
  const liveClassroomPostclassEvidence = await maybeRunLiveClassroomPostclassEvidenceCurrentMainProfile(input);
  if (liveClassroomPostclassEvidence) return liveClassroomPostclassEvidence;
  const courseDesignMcpRead = await maybeRunCourseDesignMcpReadV1Profile(input);
  if (courseDesignMcpRead) return courseDesignMcpRead;
  const liveClassroomBrowserMatrix = await maybeRunLiveClassroomBrowserMatrixCurrentMainProfile(input);
  if (liveClassroomBrowserMatrix) return liveClassroomBrowserMatrix;
  const liveClassroomRuntimeWiring = await maybeRunLiveClassroomRuntimeWiringCurrentMainProfile(input);
  if (liveClassroomRuntimeWiring) return liveClassroomRuntimeWiring;
  return runStage14Profile(input);
}

export { formatProfileStatus, profileCommands };
