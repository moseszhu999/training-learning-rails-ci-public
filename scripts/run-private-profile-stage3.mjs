import {
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

export async function runProfile(input) {
  return runStage2Profile(input);
}

export { formatProfileStatus, profileCommands };
