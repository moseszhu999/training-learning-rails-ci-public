import { appendFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateInputs } from './exact-head-inputs.mjs';

const REQUEST_ID = /^[a-z0-9][a-z0-9-]{7,79}$/;

export function validateRequest(input) {
  const validation = validateInputs(input);
  const reportIssueNumber = Number(input.reportIssueNumber);
  const requestId = String(input.requestId ?? '');
  const failures = [...validation.failures];
  if (!Number.isInteger(reportIssueNumber) || reportIssueNumber < 1 || reportIssueNumber > 999999) failures.push('reportIssueNumber');
  if (!REQUEST_ID.test(requestId)) failures.push('requestId');
  return {
    ok: failures.length === 0,
    failures,
    normalized: {
      ...validation.normalized,
      reportIssueNumber: String(reportIssueNumber),
      requestId,
    },
  };
}

async function main() {
  const requestPath = process.env.REQUEST_PATH || '.github/exact-head-request.json';
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) throw new Error('GITHUB_OUTPUT is required');
  const request = JSON.parse(await readFile(requestPath, 'utf8'));
  const result = validateRequest(request);
  const value = result.normalized;
  await appendFile(outputPath, [
    `status=${result.ok ? 'PASS' : 'FAIL'}`,
    `private_exact_sha=${value.privateExactSha}`,
    `expected_base_sha=${value.expectedBaseSha}`,
    `validation_profile=${value.validationProfile}`,
    `expected_changed_file_count=${value.expectedChangedFileCount}`,
    `expected_migration_range=${value.expectedMigrationRange}`,
    `expected_focused_test_counts=${request.expectedFocusedTestCounts ?? ''}`,
    `report_issue_number=${value.reportIssueNumber}`,
    `request_id=${value.requestId}`,
    `failure_count=${result.failures.length}`,
  ].join('\n') + '\n', 'utf8');
  console.log(`EXACT_HEAD_REQUEST status=${result.ok ? 'PASS' : 'FAIL'} request=${value.requestId || 'INVALID'} failures=${result.failures.length}`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`EXACT_HEAD_REQUEST status=FAIL reason=${error.name}`);
    process.exitCode = 1;
  });
}
