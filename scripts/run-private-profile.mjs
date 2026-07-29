import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  formatProfileStatus,
  profileCommands,
  runProfile,
} from './run-private-profile-base.mjs';

const teacherHubCommands = profileCommands['teacher-hub'];
const unrelatedLearningWorkspaceIndex = teacherHubCommands.findIndex(
  (item) => item.label === 'learning-workspace-validation',
);
if (unrelatedLearningWorkspaceIndex >= 0) {
  teacherHubCommands.splice(unrelatedLearningWorkspaceIndex, 1);
}

export { formatProfileStatus, profileCommands, runProfile };

async function main() {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required');
  const result = await runProfile({
    profile: process.env.VALIDATION_PROFILE,
    privateRepoPath: process.env.PRIVATE_REPO_PATH,
    runnerTemp: process.env.RUNNER_TEMP,
    expectedNodeCount: process.env.EXPECTED_NODE_COUNT,
    expectedPythonCount: process.env.EXPECTED_PYTHON_COUNT,
  });
  await appendFile(outputPath, [
    `status=${result.status}`,
    `step_count=${result.stepCount}`,
    `passed_step_count=${result.passedStepCount}`,
    `node_tests=${result.nodeTests}`,
    `node_passed=${result.nodePassed}`,
    `python_tests=${result.pythonTests}`,
  ].join('\n') + '\n', 'utf8');
  console.log(
    `PROFILE_VALIDATION status=${result.status} steps=${result.passedStepCount}/${result.stepCount} node=${result.nodePassed}/${result.nodeTests} python=${result.pythonTests}`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`PROFILE_VALIDATION status=FAIL reason=${error.name}`);
    process.exitCode = 1;
  });
}
