import {
  formatProfileStatus,
  profileCommands,
  runProfile as runStage11Profile,
} from './run-private-profile-stage11.mjs';

const teacherHubCommands = profileCommands['teacher-hub'];
const combinedIndex = teacherHubCommands.findIndex((item) => item.label === 'python-contract');
if (combinedIndex < 0) throw new Error('teacher-hub combined python contract is required');

const combined = teacherHubCommands[combinedIndex];
const prefix = combined.args.slice(0, 3);
const modules = combined.args.slice(3);
const expectedModules = [
  'tests.test_trainingos_teacher_operations_hub_mount_contract',
  'tests.test_trainingos_teacher_operations_hub_adapter_contract',
  'tests.test_trainingos_teacher_operations_hub_formal_actions_contract',
  'tests.test_trainingos_teacher_hub_failure_semantics_v1',
];

if (prefix.join('\n') !== ['-m', 'unittest', '-v'].join('\n')) {
  throw new Error('teacher-hub python command prefix changed');
}
if (modules.join('\n') !== expectedModules.join('\n')) {
  throw new Error('teacher-hub python module set changed');
}

const labels = [
  'python-mount-acceptance',
  'python-adapter',
  'python-formal-actions',
  'python-failure-semantics',
];

teacherHubCommands.splice(
  combinedIndex,
  1,
  ...modules.map((moduleName, index) => ({
    label: labels[index],
    executable: 'python',
    args: [...prefix, moduleName],
    kind: 'python',
  })),
);

export async function runProfile(input) {
  return runStage11Profile(input);
}

export { formatProfileStatus, profileCommands };
