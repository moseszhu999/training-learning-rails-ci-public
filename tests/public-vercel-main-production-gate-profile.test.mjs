import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VERCEL_MAIN_PRODUCTION_GATE_EXACT_FILES,
  vercelMainProductionGateCommands,
  isVercelMainProductionGateScope,
} from '../scripts/run-vercel-main-production-gate-profile.mjs';

test('Vercel main production gate selector accepts exactly two private files', () => {
  assert.equal(VERCEL_MAIN_PRODUCTION_GATE_EXACT_FILES.size, 2);
  assert.equal(isVercelMainProductionGateScope(VERCEL_MAIN_PRODUCTION_GATE_EXACT_FILES), true);
  assert.equal(isVercelMainProductionGateScope([...VERCEL_MAIN_PRODUCTION_GATE_EXACT_FILES, 'netlify.toml']), false);
  assert.equal(isVercelMainProductionGateScope(['vercel.json']), false);
  assert.equal(isVercelMainProductionGateScope(['vercel.json', 'supabase/migrations/20260809999999_not_allowed.sql']), false);
});

test('Vercel main production gate profile runs only bounded deterministic repository checks', () => {
  assert.deepEqual(vercelMainProductionGateCommands.map((item) => item.label), [
    'install',
    'focused-node-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(
    vercelMainProductionGateCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'tests/trainingos-vercel-main-production-gate-v1.test.mjs'],
  );
});

test('Vercel main production gate profile locks exact counts and compatibility input', () => {
  const source = readFileSync(new URL('../scripts/run-vercel-main-production-gate-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 2;',
    'const EXPECTED_NODE_COUNT = 2;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 368;',
    "selectedSuite: 'vercel-main-production-gate'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes Vercel main production gate before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunVercelMainProductionGateProfile } from './run-vercel-main-production-gate-profile.mjs';"), true);
  const capabilityCredential = router.indexOf('maybeRunCapabilityCredentialCoreProfile(input)');
  const vercelGate = router.indexOf('maybeRunVercelMainProductionGateProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(capabilityCredential >= 0 && vercelGate > capabilityCredential && fallback > vercelGate);
});

test('public Vercel gate profile has no deploy database network or arbitrary shell primitive', () => {
  const text = JSON.stringify(vercelMainProductionGateCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'payment', 'settlement', 'wallet', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
