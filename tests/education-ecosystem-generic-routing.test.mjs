import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  shouldUseEducationEcosystemProfile,
} from '../scripts/run-private-profile-stage6.mjs';

const exactEducationFiles = Object.freeze([
  'docs/architecture/trainingos-education-ecosystem-capability-adapter-v1.md',
  'docs/testing/trainingos-education-ecosystem-capability-adapter-v1.md',
  'lib/trainingos-agent-gateway/education-ecosystem-adapter.mjs',
  'packages/training-education-ecosystem/src/index.d.mts',
  'packages/training-education-ecosystem/src/index.mjs',
  'packages/training-education-ecosystem/src/marble-mock.mjs',
  'packages/training-education-ecosystem/src/openmaic-mock.mjs',
  'tests/training-education-ecosystem/education-ecosystem-adapter.test.mjs',
]);

test('generic-owned selects the fixed Education Ecosystem suite for the closed owner diff', () => {
  assert.equal(
    shouldUseEducationEcosystemProfile('generic-owned', exactEducationFiles),
    true,
  );
});

test('explicit Education profile remains supported inside the controller', () => {
  assert.equal(
    shouldUseEducationEcosystemProfile('education-ecosystem', exactEducationFiles),
    true,
  );
});

test('generic-owned rejects mixed, shared, migration and unrelated scopes', () => {
  for (const forbidden of [
    'lib/trainingos-agent-gateway/index.mjs',
    'packages/training-challenge/src/index.mjs',
    'apps/training-web/src/RootApp.tsx',
    'supabase/migrations/20260729235959_unrelated.sql',
    'package.json',
  ]) {
    assert.equal(
      shouldUseEducationEcosystemProfile('generic-owned', [...exactEducationFiles, forbidden]),
      false,
      forbidden,
    );
  }
});

test('non-Education profiles never select this suite', () => {
  for (const profile of ['challenge-runtime', 'challenge-web', 'teacher-hub', 'main-release']) {
    assert.equal(shouldUseEducationEcosystemProfile(profile, exactEducationFiles), false, profile);
  }
});

test('generic route is evaluated before the inherited generic suite', async () => {
  const source = await readFile(new URL('../scripts/run-private-profile-stage6.mjs', import.meta.url), 'utf8');
  const selector = source.indexOf("if (input.profile === 'generic-owned')");
  const inherited = source.indexOf('const result = await runStage5Profile(input);');
  assert.ok(selector >= 0);
  assert.ok(inherited > selector);
  assert.match(source, /return runEducationEcosystemProfile\(input\);/);
});
