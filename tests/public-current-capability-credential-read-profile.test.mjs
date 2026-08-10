import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CURRENT_CAPABILITY_CREDENTIAL_READ_EXACT_FILES,
  currentCapabilityCredentialReadCommands,
  isCurrentCapabilityCredentialReadScope,
} from '../scripts/run-current-capability-credential-read-profile.mjs';

test('selector accepts exactly three private owner files', () => {
  assert.equal(CURRENT_CAPABILITY_CREDENTIAL_READ_EXACT_FILES.size, 3);
  assert.equal(CURRENT_CAPABILITY_CREDENTIAL_READ_EXACT_FILES.has('supabase/migrations/20260810084550_trainingos_current_capability_credential_read_v1.sql'), true);
  assert.equal(isCurrentCapabilityCredentialReadScope(CURRENT_CAPABILITY_CREDENTIAL_READ_EXACT_FILES), true);
  assert.equal(isCurrentCapabilityCredentialReadScope([...CURRENT_CAPABILITY_CREDENTIAL_READ_EXACT_FILES, 'netlify.toml']), false);
  assert.equal(isCurrentCapabilityCredentialReadScope([...CURRENT_CAPABILITY_CREDENTIAL_READ_EXACT_FILES].slice(1)), false);
});

test('profile runs focused contracts then repository build gates only', () => {
  assert.deepEqual(currentCapabilityCredentialReadCommands.map((item) => item.label), [
    'install',
    'focused-node-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(
    currentCapabilityCredentialReadCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'tests/training-current-capability-credential-read-v1.test.mjs'],
  );
});

test('profile locks Preview-generated migration and fixed counts', () => {
  const source = readFileSync(new URL('../scripts/run-current-capability-credential-read-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 3;',
    'const EXPECTED_NODE_COUNT = 8;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 377;',
    "const EXPECTED_MIGRATION_START = '20260810084550';",
    "const EXPECTED_MIGRATION_END = '20260810084550';",
    'scope.migration_start === EXPECTED_MIGRATION_START',
    'scope.migration_end === EXPECTED_MIGRATION_END',
    "selectedSuite: 'current-capability-credential-read'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes current credential read before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunCurrentCapabilityCredentialReadProfile } from './run-current-capability-credential-read-profile.mjs';"), true);
  const currentRead = router.indexOf('maybeRunCurrentCapabilityCredentialReadProfile');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(currentRead >= 0 && fallback > currentRead);
});

test('public profile contains no database deploy network or arbitrary shell primitive', () => {
  const text = JSON.stringify(currentCapabilityCredentialReadCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'payment', 'settlement', 'wallet', 'token movement', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});