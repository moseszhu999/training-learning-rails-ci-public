import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import {
  challengeOfferProfileCommands,
  isChallengeOfferFiles,
} from '../scripts/run-private-profile-stage5.mjs';

const offerFiles = [
  'packages/training-challenge-offer/package.json',
  'packages/training-challenge-offer/src/index.mjs',
  'lib/trainingos-agent-gateway/challenge-offer-entitlement.mjs',
  'supabase/migrations/20260729230000_trainingos_challenge_offer_helpers_v1.sql',
  'tests/test_trainingos_challenge_offer_entitlement_v1_contract.py',
];

test('Challenge Offer selector is exclusive to the Offer owner', () => {
  assert.equal(isChallengeOfferFiles(offerFiles), true);
  assert.equal(isChallengeOfferFiles([
    ...offerFiles,
    'packages/training-challenge/src/index.mjs',
  ]), false);
  assert.equal(isChallengeOfferFiles([
    'packages/training-challenge-proof/src/index.mjs',
  ]), false);
});

test('Challenge Offer profile is fixed and reports exact focused counts', () => {
  assert.deepEqual(
    challengeOfferProfileCommands.map((item) => item.label),
    [
      'install',
      'syntax-package',
      'syntax-gateway',
      'node-contract',
      'python-contract',
      'typecheck',
      'production-build',
      'database-replay',
    ],
  );
  const nodeCommand = challengeOfferProfileCommands.find((item) => item.label === 'node-contract');
  const pythonCommand = challengeOfferProfileCommands.find((item) => item.label === 'python-contract');
  const databaseCommand = challengeOfferProfileCommands.find((item) => item.label === 'database-replay');
  assert.ok(nodeCommand.args.includes('prototypes/trainingos-agent-mvp-v1/test/challenge-offer-entitlement-v1.test.mjs'));
  assert.ok(pythonCommand.args.includes('tests.test_trainingos_challenge_offer_entitlement_v1_contract'));
  assert.match(databaseCommand.args[0], /run-challenge-offer-database\.sh$/);
});

test('Offer database gate is syntax-valid, exact-scope, isolated and artifact-free', async () => {
  const scriptPath = new URL('../scripts/run-challenge-offer-database.sh', import.meta.url);
  const script = await readFile(scriptPath, 'utf8');
  const syntax = spawnSync('bash', ['-n', scriptPath.pathname], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  assert.match(script, /expected_changed_file_count/);
  assert.match(script, /20260729230000/);
  assert.match(script, /20260729235959/);
  assert.equal(
    [...script.matchAll(/^  supabase\/migrations\/2026072923\d{4}_trainingos_challenge_[^\n]+\.sql$/gm)].length,
    14,
  );
  assert.match(script, /trainingos_challenge_offer_entitlement_v1_e2e_runner\.sql/);
  assert.match(script, /fresh-reset-one/);
  assert.match(script, /fresh-reset-two/);
  assert.match(script, /upgrade-migrations/);
  assert.match(script, /cleanup=PASS/);
  assert.doesNotMatch(script, /upload-artifact|actions\/upload-artifact|deploy|production database/i);
});

test('shared profile entrypoint routes through stage5', async () => {
  const entrypoint = await readFile(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');
  assert.match(entrypoint, /run-private-profile-stage5\.mjs/);
  assert.doesNotMatch(entrypoint, /run-private-profile-stage3\.mjs/);
});
