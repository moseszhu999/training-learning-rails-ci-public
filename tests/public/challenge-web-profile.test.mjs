import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { profileCommands } from '../../scripts/run-private-profile.mjs';
import { profileAllowlist } from '../../scripts/verify-private-scope.mjs';

const expectedOwnedFiles = [
  'apps/training-web/src/RootApp.tsx',
  'apps/training-web/src/components/InviteChallengeProduct.tsx',
  'apps/training-web/src/invite-challenge.css',
  'apps/training-web/src/invite-challenge/contracts.ts',
  'apps/training-web/src/invite-challenge/gateway.ts',
  'apps/training-web/src/invite-challenge/routes.ts',
  'apps/training-web/src/invite-challenge/storage.ts',
  'apps/training-web/src/main.tsx',
  'docs/architecture/trainingos-invite-challenge-web-v1.md',
  'package.json',
  'playwright.config.ts',
  'tests/test_trainingos_invite_challenge_web_contract.py',
  'tests/trainingos-ui-e2e/challenge-web-role-boundaries.spec.ts',
  'tests/trainingos-ui-e2e/challenge-web-state-contracts.spec.ts',
  'tests/trainingos-ui-e2e/challenge-web.spec.ts',
];

test('challenge-web profile runs the dedicated contract and browser suites', () => {
  const commands = profileCommands['challenge-web'];
  assert.deepEqual(commands.map((item) => item.label), [
    'install',
    'python-contract',
    'typecheck',
    'production-build',
    'playwright-browser',
    'playwright',
  ]);
  const serialized = JSON.stringify(commands);
  assert.match(serialized, /test:challenge-web:contract/);
  assert.match(serialized, /test:challenge-web/);
  assert.doesNotMatch(serialized, /test:trainingos-ui:local/);
});

test('challenge-web allowlist covers its exact shared Web ownership and excludes runtime', () => {
  const rules = profileAllowlist['challenge-web'];
  for (const file of expectedOwnedFiles) {
    assert.ok(rules.some((rule) => rule.test(file)), `expected challenge-web allowlist to include ${file}`);
  }
  assert.equal(rules.some((rule) => rule.test('supabase/migrations/20260729000000_forbidden.sql')), false);
  assert.equal(rules.some((rule) => rule.test('lib/trainingos-agent-gateway/challenge-runtime.mjs')), false);
});

test('direct Supabase guard is limited to production Web source', async () => {
  const source = await readFile('scripts/verify-private-scope.mjs', 'utf8');
  assert.match(source, /name\.startsWith\('apps\/training-web\/src\/'\)/);
  assert.match(source, /input\.validationProfile === 'challenge-web'/);
  assert.doesNotMatch(source, /name\.startsWith\('tests\/'\).*directSupabase/s);
});
