import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const validationProfiles = Object.freeze([
  'student-learning-execution',
  'scheduling-delivery',
  'agent-recipe',
  'classroom-explanation',
  'classroom-lark',
  'classroom-agent-queue',
  'challenge-runtime',
  'generic-owned',
]);

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const COUNT_PATTERN = /^(0|[1-9][0-9]{0,3})$/;
const RANGE_PATTERN = /^([0-9]{14})-([0-9]{14})$/;
const FOCUSED_PATTERN = /^node=(0|[1-9][0-9]{0,3});python=(0|[1-9][0-9]{0,3})$/;

export function validateInputs(input) {
  const failures = [];
  const privateExactSha = input.privateExactSha ?? '';
  const expectedBaseSha = input.expectedBaseSha ?? '';
  const validationProfile = input.validationProfile ?? '';
  const expectedChangedFileCount = input.expectedChangedFileCount ?? '';
  const expectedMigrationRange = input.expectedMigrationRange ?? '';
  const expectedFocusedTestCounts = input.expectedFocusedTestCounts ?? '';

  if (!SHA_PATTERN.test(privateExactSha)) failures.push('privateExactSha');
  if (!SHA_PATTERN.test(expectedBaseSha)) failures.push('expectedBaseSha');
  if (!validationProfiles.includes(validationProfile)) failures.push('validationProfile');
  if (!COUNT_PATTERN.test(expectedChangedFileCount)) failures.push('expectedChangedFileCount');

  let migrationStart = '';
  let migrationEnd = '';
  if (expectedMigrationRange === 'none') {
    migrationStart = 'none';
    migrationEnd = 'none';
  } else {
    const match = expectedMigrationRange.match(RANGE_PATTERN);
    if (!match || match[1] > match[2]) {
      failures.push('expectedMigrationRange');
    } else {
      migrationStart = match[1];
      migrationEnd = match[2];
    }
  }

  const focusedMatch = expectedFocusedTestCounts.match(FOCUSED_PATTERN);
  if (!focusedMatch) failures.push('expectedFocusedTestCounts');

  return {
    ok: failures.length === 0,
    failures,
    normalized: {
      privateExactSha,
      expectedBaseSha,
      validationProfile,
      expectedChangedFileCount,
      expectedMigrationRange,
      migrationStart,
      migrationEnd,
      expectedNodeCount: focusedMatch?.[1] ?? '',
      expectedPythonCount: focusedMatch?.[2] ?? '',
    },
  };
}

async function writeOutputs(result) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required');
  const values = result.normalized;
  const lines = [
    `status=${result.ok ? 'PASS' : 'FAIL'}`,
    `profile=${values.validationProfile}`,
    `expected_changed_file_count=${values.expectedChangedFileCount}`,
    `migration_start=${values.migrationStart}`,
    `migration_end=${values.migrationEnd}`,
    `expected_node_count=${values.expectedNodeCount}`,
    `expected_python_count=${values.expectedPythonCount}`,
    `failure_count=${result.failures.length}`,
  ];
  await appendFile(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  const result = validateInputs({
    privateExactSha: process.env.PRIVATE_EXACT_SHA,
    expectedBaseSha: process.env.EXPECTED_BASE_SHA,
    validationProfile: process.env.VALIDATION_PROFILE,
    expectedChangedFileCount: process.env.EXPECTED_CHANGED_FILE_COUNT,
    expectedMigrationRange: process.env.EXPECTED_MIGRATION_RANGE,
    expectedFocusedTestCounts: process.env.EXPECTED_FOCUSED_TEST_COUNTS,
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
