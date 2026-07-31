import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const runner = readFileSync('scripts/run-learning-content-resolution-db-profile.sh', 'utf8');

test('historical Rights E2E stage wrappers map only to the closed public-safe vocabulary', () => {
  const mappings = [
    [
      'TRAININGOS_LCR_E2E_PURPOSE_MISMATCH_FAILED',
      'TRAININGOS_LCR_PURPOSE_MISMATCH_ASSERTION_FAILED',
    ],
    [
      'TRAININGOS_LCR_E2E_REGION_MISMATCH_FAILED',
      'TRAININGOS_LCR_REGION_MISMATCH_ASSERTION_FAILED',
    ],
    [
      'TRAININGOS_LCR_E2E_AGREEMENT_ENDED_FAILED',
      'TRAININGOS_LCR_HISTORY_ENDED_AGREEMENT_ASSERTION_FAILED',
    ],
    [
      'TRAININGOS_LCR_E2E_NO_ACTIVE_COMMERCIAL_FAILED',
      'TRAININGOS_LCR_HISTORY_NO_ACTIVE_ACCOUNT_ASSERTION_FAILED',
    ],
    [
      'TRAININGOS_LCR_E2E_REPLACEMENT_ACCOUNT_FAILED',
      'TRAININGOS_LCR_HISTORY_REPLACED_ACCOUNT_ASSERTION_FAILED',
    ],
    [
      'TRAININGOS_LCR_E2E_UNRELATED_CLASS_HISTORY_FAILED',
      'TRAININGOS_LCR_HISTORY_CROSS_CLASS_ASSERTION_FAILED',
    ],
  ];
  for (const [source, target] of mappings) {
    assert.ok(runner.includes(source), source);
    assert.ok(runner.includes(target), target);
  }
  for (const source of [
    'TRAININGOS_LCR_E2E_AGE_BAND_MISMATCH_FAILED',
    'TRAININGOS_LCR_E2E_RIGHTS_SUSPENDED_FAILED',
    'TRAININGOS_LCR_E2E_USAGE_EXPIRED_FAILED',
    'TRAININGOS_LCR_E2E_RIGHTS_REVOKED_FAILED',
  ]) assert.ok(runner.includes(source), source);
  assert.match(runner, /reason='TRAININGOS_LCR_HISTORY_STATUS_ASSERTION_FAILED'/);
  assert.match(runner, /TRAININGOS_LCR_ZERO_RESIDUE_ASSERTION_FAILED[\s\S]*TRAININGOS_LCR_E2E_STAGE_FAILED/);
});

test('diagnostic normalization does not print or copy sealed SQL output', () => {
  assert.match(runner, /grep -Eo 'TRAININGOS_LCR_\[A-Z0-9_\]\+:\[A-Z0-9\]\{5\}'/);
  assert.doesNotMatch(runner, /cat\s+.*sql-e2e|tee\s+.*sql-e2e|upload-artifact/);
  assert.match(runner, /rm -rf "\$fresh" "\$upgrade" "\$base_worktree" "\$bin_dir"/);
});

test('updated database runner remains valid shell', () => {
  const bash = spawnSync('bash', ['-n', 'scripts/run-learning-content-resolution-db-profile.sh'], {
    encoding: 'utf8',
  });
  assert.equal(bash.status, 0, bash.stderr);
  const shellcheck = spawnSync('shellcheck', ['scripts/run-learning-content-resolution-db-profile.sh'], {
    encoding: 'utf8',
  });
  assert.equal(shellcheck.status, 0, shellcheck.stdout || shellcheck.stderr);
});
