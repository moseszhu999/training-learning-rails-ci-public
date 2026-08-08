import {
  formatProfileStatus,
  profileCommands,
  runProfile as runStage14Profile,
} from './run-private-profile-stage14.mjs';
import { maybeRunLiveClassroomACurrentMainProfile } from './run-live-classroom-a-current-main-profile.mjs';
import { maybeRunEntitlementBillingProjectionProfile } from './run-entitlement-billing-projection-profile.mjs';

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
  {
    label: 'python-role-menu-content',
    moduleName: 'tests.test_trainingos_role_menu_content_permissions_v1',
  },
  {
    label: 'python-advanced-settings',
    moduleName: 'tests.test_trainingos_advanced_settings',
  },
  {
    label: 'python-risk-intervention',
    moduleName: 'tests.test_trainingos_risk_intervention_ui_contract',
  },
  {
    label: 'python-zero-permission-core',
    moduleName: 'tests.test_trainingos_zero_permission_bridge_core_contract',
  },
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
  return runStage14Profile(input);
}

export { formatProfileStatus, profileCommands };
