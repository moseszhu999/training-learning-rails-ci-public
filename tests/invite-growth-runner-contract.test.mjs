import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const script = await readFile(new URL('../scripts/run-challenge-runtime-database.sh', import.meta.url), 'utf8');

test('Invite suite uses exact self-rollback and zero-residue sentinels', () => {
  assert.match(script, /if \[\[ "\$suite" == invite \]\]; then/);
  assert.match(script, /\\ir trainingos_invite_growth_runtime_v1_e2e\.sql/);
  assert.match(script, /TRAININGOS_INVITE_GROWTH_FIXTURE_ROLLBACK/);
  assert.match(script, /TRAININGOS_INVITE_GROWTH_ZERO_RESIDUE_FAILED/);
});

test('non-Invite Challenge suites retain explicit runner rollback contract', () => {
  assert.match(script, /else\n  grep -Eiq '\^\[\[:space:\]\]\*rollback;' "\$runner_sql"\nfi/);
});

test('Invite contract remains bound to sealed diagnostics and fixed concurrency', () => {
  assert.match(script, /scripts\/run-trainingos-invite-growth-concurrency-e2e\.sh/);
  assert.match(script, /chmod 600 "\$e2e_log"/);
  assert.match(script, /DATABASE_URL="\$url" RUNNER_TEMP="\$RUNNER_TEMP" bash "\$concurrency_runner"/);
  assert.match(script, /detail=concurrency/);
});
