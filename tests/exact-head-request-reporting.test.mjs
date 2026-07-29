import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(
  new URL('../.github/workflows/trainingos-public-exact-head-request.yml', import.meta.url),
  'utf8',
);

test('optional issue reporting cannot overturn an authoritative exact-head result', () => {
  assert.match(workflow, /report_status='NOT_REQUESTED'/);
  assert.match(workflow, /if gh issue comment "\$REPORT_ISSUE_NUMBER"/);
  assert.match(workflow, /report_status='COMMENT_FAILED'/);
  assert.match(workflow, /EXACT_HEAD_REPORT status=\$report_status/);
  assert.doesNotMatch(workflow, /gh issue comment[\s\S]{0,240}\n\s+exit 1/);
});

test('authoritative enforcement remains bound only to request and dispatched run', () => {
  const enforce = workflow.slice(workflow.indexOf('- name: Enforce request and dispatched run result'));
  assert.match(enforce, /REQUEST_STATUS/);
  assert.match(enforce, /RUN_STATUS/);
  assert.match(enforce, /RUN_CONCLUSION/);
  assert.doesNotMatch(enforce, /REPORT_STATUS|COMMENT_FAILED/);
});

test('report and comment logs remain runner-local and removed', () => {
  assert.match(workflow, /exact-head-report\.md/);
  assert.match(workflow, /exact-head-comment\.log/);
  assert.match(workflow, /rm -f "\$RUNNER_TEMP"\/exact-head-request\.log/);
  assert.doesNotMatch(workflow, /upload-artifact/);
});
