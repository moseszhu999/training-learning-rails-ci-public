import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflowPath = new URL('../.github/workflows/private-owned-ci.yml', import.meta.url);
const source = readFileSync(workflowPath, 'utf8');

test('private owned CI is manual-only', () => {
  assert.match(source, /\bon:\s*\n\s+workflow_dispatch:/);
  assert.doesNotMatch(source, /^\s{2}(?:push|pull_request|schedule):/m);
});

test('private checkout uses an exact SHA and read credential without persistence', () => {
  assert.match(source, /PRIVATE_REPO_READ_TOKEN/);
  assert.match(source, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(source, /ref:\s*\$\{\{ inputs\.private_sha \}\}/);
  assert.match(source, /persist-credentials:\s*false/);
  assert.match(source, /git rev-parse HEAD/);
  assert.match(source, /actual_sha.*PRIVATE_SHA/s);
});

test('private output stays sealed and no artifact is published', () => {
  assert.match(source, /npm run ci:owned > "\$RUNNER_TEMP\/private-owned-ci\.log" 2>&1/);
  assert.match(source, /Raw private test output is intentionally not published or uploaded/);
  assert.match(source, /rm -rf private-repo "\$RUNNER_TEMP\/private-owned-ci\.log"/);
  assert.doesNotMatch(source, /upload-artifact/i);
  assert.doesNotMatch(source, /cat .*private-owned-ci\.log/i);
});

test('workflow keeps least privilege and a bounded execution window', () => {
  assert.match(source, /permissions:\s*\n\s+contents:\s*read/);
  assert.match(source, /timeout-minutes:\s*45/);
  assert.match(source, /TRAININGOS_CI_INSTALL:\s*always/);
  assert.match(source, /TRAININGOS_CI_INCLUDE_PLAYWRIGHT:/);
});
