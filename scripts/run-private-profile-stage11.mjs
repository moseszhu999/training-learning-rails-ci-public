import {
  formatProfileStatus,
  profileCommands,
  runProfile as runStage10Profile,
} from './run-private-profile-stage10.mjs';

const teacherHubCommands = profileCommands['teacher-hub'];
const teacherHubPython = teacherHubCommands.find((item) => item.label === 'python-contract');

if (!teacherHubPython) {
  throw new Error('teacher-hub python-contract command is required');
}

const failureSemanticsContract = 'tests.test_trainingos_teacher_hub_failure_semantics_v1';
if (!teacherHubPython.args.includes(failureSemanticsContract)) {
  teacherHubPython.args.push(failureSemanticsContract);
}

export async function runProfile(input) {
  return runStage10Profile(input);
}

export { formatProfileStatus, profileCommands };
