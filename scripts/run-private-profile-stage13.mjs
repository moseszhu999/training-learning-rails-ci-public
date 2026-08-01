import {
  formatProfileStatus,
  profileCommands,
  runProfile as runStage12Profile,
} from './run-private-profile-stage12.mjs';

const teacherHubCommands = profileCommands['teacher-hub'];
const combinedIndex = teacherHubCommands.findIndex((item) => item.label === 'python-mount-acceptance');
if (combinedIndex < 0) throw new Error('teacher-hub mount/acceptance command is required');

const combined = teacherHubCommands[combinedIndex];
const expectedCombinedArgs = [
  '-m',
  'unittest',
  '-v',
  'tests.test_trainingos_teacher_operations_hub_mount_contract',
];
if (combined.args.join('\n') !== expectedCombinedArgs.join('\n')) {
  throw new Error('teacher-hub mount/acceptance command changed');
}

teacherHubCommands.splice(
  combinedIndex,
  1,
  {
    label: 'python-mount',
    executable: 'python',
    args: [
      '-m',
      'unittest',
      '-v',
      'tests.test_trainingos_teacher_operations_hub_mount_contract.TeacherOperationsHubMountContractTest',
    ],
    kind: 'python',
  },
  {
    label: 'python-acceptance',
    executable: 'python',
    args: [
      '-m',
      'unittest',
      '-v',
      'tests.test_trainingos_teacher_operations_hub_acceptance_contract',
    ],
    kind: 'python',
  },
);

export async function runProfile(input) {
  return runStage12Profile(input);
}

export { formatProfileStatus, profileCommands };
