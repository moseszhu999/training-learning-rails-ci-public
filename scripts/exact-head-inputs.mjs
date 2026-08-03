import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const standardValidationProfiles = Object.freeze([
  'student-learning-execution',
  'scheduling-delivery',
  'agent-recipe',
  'classroom-explanation',
  'classroom-lark',
  'classroom-agent-queue',
  'challenge-runtime',
  'challenge-web',
  'teacher-hub',
  'workspace-remediation',
  'docs-launch',
  'education-ecosystem',
  'agent-native-learning-product',
  'learning-content-resolution',
  'generic-owned',
]);

export const validationProfiles = Object.freeze([...standardValidationProfiles, 'main-release']);

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const COUNT_PATTERN = /^(0|[1-9][0-9]{0,5})$/;
const RANGE_PATTERN = /^([0-9]{14})-([0-9]{14})$/;
const FOCUSED_PATTERN = /^node=(0|[1-9][0-9]{0,5});python=(0|[1-9][0-9]{0,5})$/;
const BOOLEAN_PATTERN = /^(true|false)$/;

export function validateInputs(input) {
  const failures = [];
  const privateExactSha = input.privateExactSha ?? '';
  const expectedBaseSha = input.expectedBaseSha ?? '';
  const expectedMainSha = input.expectedMainSha ?? '';
  const validationProfile = input.validationProfile ?? '';
  const expectedChangedFileCount = input.expectedChangedFileCount ?? '';
  const expectedMigrationRange = input.expectedMigrationRange ?? '';
  const expectedFocusedTestCounts = input.expectedFocusedTestCounts ?? '';
  const expectedMigrationCount = input.expectedMigrationCount ?? '0';
  const runFlags = {
    runFreshReplay: input.runFreshReplay ?? 'false',
    runUpgradeReplay: input.runUpgradeReplay ?? 'false',
    runApplicationContracts: input.runApplicationContracts ?? 'false',
    runTypecheck: input.runTypecheck ?? 'false',
    runProductionBuild: input.runProductionBuild ?? 'false',
    runCriticalE2E: input.runCriticalE2E ?? 'false',
  };

  if (!SHA_PATTERN.test(privateExactSha)) failures.push('privateExactSha');
  if (!SHA_PATTERN.test(expectedBaseSha)) failures.push('expectedBaseSha');
  if (!validationProfiles.includes(validationProfile)) failures.push('validationProfile');
  if (!COUNT_PATTERN.test(expectedChangedFileCount)) failures.push('expectedChangedFileCount');
  if (!COUNT_PATTERN.test(String(expectedMigrationCount))) failures.push('expectedMigrationCount');

  let migrationStart = '';
  let migrationEnd = '';
  if (expectedMigrationRange === 'none') {
    migrationStart = 'none';
    migrationEnd = 'none';
  } else {
    const match = expectedMigrationRange.match(RANGE_PATTERN);
    if (!match || match[1] > match[2]) failures.push('expectedMigrationRange');
    else [migrationStart, migrationEnd] = [match[1], match[2]];
  }

  const focusedMatch = expectedFocusedTestCounts.match(FOCUSED_PATTERN);
  if (!focusedMatch) failures.push('expectedFocusedTestCounts');

  if (validationProfile === 'main-release') {
    if (!SHA_PATTERN.test(expectedMainSha)) failures.push('expectedMainSha');
    if (expectedMigrationCount === '0') failures.push('mainMigrationCount');
    for (const [name, value] of Object.entries(runFlags)) {
      if (!BOOLEAN_PATTERN.test(String(value))) failures.push(name);
    }
    if (privateExactSha !== expectedMainSha) failures.push('privateMainEquality');
    if (expectedBaseSha !== expectedMainSha) failures.push('mainBaseEquality');
    if (expectedChangedFileCount !== '0') failures.push('mainChangedFileCount');
    if (expectedMigrationRange !== 'none') failures.push('mainMigrationRange');
    if (expectedFocusedTestCounts !== 'node=0;python=0') failures.push('mainFocusedCountSentinel');
  }

  if (validationProfile === 'workspace-remediation') {
    if (expectedChangedFileCount !== '3') failures.push('workspaceRemediationChangedFileCount');
    if (expectedMigrationRange !== 'none') failures.push('workspaceRemediationMigrationRange');
    if (String(expectedMigrationCount) !== '0') failures.push('workspaceRemediationMigrationCount');
    if (expectedFocusedTestCounts !== 'node=0;python=3') {
      failures.push('workspaceRemediationFocusedTestCounts');
    }
    for (const [name, value] of Object.entries(runFlags)) {
      if (String(value) !== 'false') failures.push(`workspaceRemediation:${name}`);
    }
  }

  if (validationProfile === 'agent-native-learning-product') {
    if (expectedMigrationRange !== 'none') failures.push('agentNativeLearningMigrationRange');
    if (String(expectedMigrationCount) !== '0') failures.push('agentNativeLearningMigrationCount');
    if (expectedFocusedTestCounts !== 'node=0;python=0') failures.push('agentNativeLearningFocusedCountSentinel');
    for (const [name, value] of Object.entries(runFlags)) {
      if (String(value) !== 'false') failures.push(`agentNativeLearning:${name}`);
    }
  }

  if (validationProfile === 'learning-content-resolution') {
    if (expectedChangedFileCount !== '7') failures.push('learningContentResolutionChangedFileCount');
    if (expectedMigrationRange !== 'none') failures.push('learningContentResolutionMigrationRange');
    if (String(expectedMigrationCount) !== '0') failures.push('learningContentResolutionMigrationCount');
    if (expectedFocusedTestCounts !== 'node=7;python=8') {
      failures.push('learningContentResolutionFocusedTestCounts');
    }
    const requiredFlags = {
      runFreshReplay: 'false',
      runUpgradeReplay: 'false',
      runApplicationContracts: 'true',
      runTypecheck: 'true',
      runProductionBuild: 'true',
      runCriticalE2E: 'false',
    };
    for (const [name, expected] of Object.entries(requiredFlags)) {
      if (String(runFlags[name]) !== expected) {
        failures.push(`learningContentResolution:${name}`);
      }
    }
  }

  if (validationProfile === 'docs-launch' && expectedMigrationRange !== 'none') failures.push('docsMigrationRange');

  return {
    ok: failures.length === 0,
    failures,
    normalized: {
      privateExactSha,
      expectedBaseSha,
      expectedMainSha,
      validationProfile,
      expectedChangedFileCount,
      expectedMigrationRange,
      migrationStart,
      migrationEnd,
      expectedNodeCount: focusedMatch?.[1] ?? '',
      expectedPythonCount: focusedMatch?.[2] ?? '',
      expectedMigrationCount: String(expectedMigrationCount),
      ...Object.fromEntries(Object.entries(runFlags).map(([key, value]) => [key, String(value)])),
    },
  };
}

async function writeOutputs(result) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required');
  const values = result.normalized;
  await appendFile(outputPath, [
    `status=${result.ok ? 'PASS' : 'FAIL'}`,
    `profile=${values.validationProfile}`,
    `expected_changed_file_count=${values.expectedChangedFileCount}`,
    `migration_start=${values.migrationStart}`,
    `migration_end=${values.migrationEnd}`,
    `expected_node_count=${values.expectedNodeCount}`,
    `expected_python_count=${values.expectedPythonCount}`,
    `expected_main_sha=${values.expectedMainSha}`,
    `expected_migration_count=${values.expectedMigrationCount}`,
    `run_fresh_replay=${values.runFreshReplay}`,
    `run_upgrade_replay=${values.runUpgradeReplay}`,
    `run_application_contracts=${values.runApplicationContracts}`,
    `run_typecheck=${values.runTypecheck}`,
    `run_production_build=${values.runProductionBuild}`,
    `run_critical_e2e=${values.runCriticalE2E}`,
    `failure_count=${result.failures.length}`,
  ].join('\n') + '\n', 'utf8');
}

async function main() {
  const result = validateInputs({
    privateExactSha: process.env.PRIVATE_EXACT_SHA,
    expectedBaseSha: process.env.EXPECTED_BASE_SHA,
    expectedMainSha: process.env.EXPECTED_MAIN_SHA,
    validationProfile: process.env.VALIDATION_PROFILE,
    expectedChangedFileCount: process.env.EXPECTED_CHANGED_FILE_COUNT,
    expectedMigrationRange: process.env.EXPECTED_MIGRATION_RANGE,
    expectedFocusedTestCounts: process.env.EXPECTED_FOCUSED_TEST_COUNTS,
    expectedMigrationCount: process.env.EXPECTED_MIGRATION_COUNT,
    runFreshReplay: process.env.RUN_FRESH_REPLAY,
    runUpgradeReplay: process.env.RUN_UPGRADE_REPLAY,
    runApplicationContracts: process.env.RUN_APPLICATION_CONTRACTS,
    runTypecheck: process.env.RUN_TYPECHECK,
    runProductionBuild: process.env.RUN_PRODUCTION_BUILD,
    runCriticalE2E: process.env.RUN_CRITICAL_E2E,
  });
  await writeOutputs(result);
  console.log(`INPUT_VALIDATION status=${result.ok ? 'PASS' : 'FAIL'} failures=${result.failures.length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`INPUT_VALIDATION status=FAIL reason=${error.name}`);
    process.exitCode = 1;
  });
}
