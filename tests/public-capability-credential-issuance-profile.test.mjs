import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

import {
  CAPABILITY_CREDENTIAL_ISSUANCE_EXACT_FILES,
  capabilityCredentialIssuanceCommands,
  isCapabilityCredentialIssuanceScope,
} from '../scripts/run-capability-credential-issuance-profile.mjs';

test('profile accepts exactly the six bounded private files', () => {
  assert.equal(CAPABILITY_CREDENTIAL_ISSUANCE_EXACT_FILES.size, 6);
  assert.equal(isCapabilityCredentialIssuanceScope(CAPABILITY_CREDENTIAL_ISSUANCE_EXACT_FILES), true);
  assert.equal(isCapabilityCredentialIssuanceScope([...CAPABILITY_CREDENTIAL_ISSUANCE_EXACT_FILES].slice(1)), false);
  assert.equal(isCapabilityCredentialIssuanceScope([...CAPABILITY_CREDENTIAL_ISSUANCE_EXACT_FILES, 'src/not-owned.ts']), false);
  assert.equal([...CAPABILITY_CREDENTIAL_ISSUANCE_EXACT_FILES].filter((name) => name.startsWith('supabase/migrations/')).length, 1);
});

test('profile runs module-load focused contracts and compatibility build only', () => {
  assert.deepEqual(capabilityCredentialIssuanceCommands.map((item) => item.label), [
    'install', 'adapter-module-load', 'focused-node-contracts', 'typecheck',
    'direct-vite-production-build', 'postbuild-copy', 'bundle-verification',
  ]);
  assert.deepEqual(capabilityCredentialIssuanceCommands.find((item) => item.label === 'focused-node-contracts')?.args, [
    '--test', 'tests/training-capability-credential-issuance-v1.test.mjs',
  ]);
});

test('profile source fixes expected tests and exact migration range without runtime DB commands', () => {
  const source = readFileSync(new URL('../scripts/run-capability-credential-issuance-profile.mjs', import.meta.url), 'utf8');
  assert.match(source, /EXPECTED_NODE_COUNT = 10/);
  assert.match(source, /EXPECTED_MIGRATION_COUNT = 375/);
  assert.match(source, /MIGRATION = '20260810093000'/);
  assert.doesNotMatch(source, /supabase\s+(db|migration|link|push|reset)|psql|DATABASE_URL/i);
});

test('generic profile dispatcher tries credential issuance before unrelated marketplace scopes', () => {
  const source = readFileSync(new URL('../scripts/run-marketplace-live-page-wiring-profile.mjs', import.meta.url), 'utf8');
  assert.match(source, /maybeRunCapabilityCredentialIssuanceProfile/);
  assert.match(source, /const credentialIssuance = await maybeRunCapabilityCredentialIssuanceProfile\(input\)/);
  assert.match(source, /if \(credentialIssuance\) return credentialIssuance/);
});
