import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MARKETPLACE_CAPABILITY_EXPERIENCE_EXACT_FILES,
  marketplaceCapabilityExperienceCommands,
  isMarketplaceCapabilityExperienceScope,
} from '../scripts/run-marketplace-capability-experience-profile.mjs';

test('Marketplace Capability Experience selector accepts exactly five private owner files', () => {
  assert.equal(MARKETPLACE_CAPABILITY_EXPERIENCE_EXACT_FILES.size, 5);
  assert.equal(isMarketplaceCapabilityExperienceScope(MARKETPLACE_CAPABILITY_EXPERIENCE_EXACT_FILES), true);
  assert.equal(isMarketplaceCapabilityExperienceScope([...MARKETPLACE_CAPABILITY_EXPERIENCE_EXACT_FILES, 'netlify.toml']), false);
  assert.equal(isMarketplaceCapabilityExperienceScope([...MARKETPLACE_CAPABILITY_EXPERIENCE_EXACT_FILES].slice(1)), false);
  const replaced = [...MARKETPLACE_CAPABILITY_EXPERIENCE_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260811999999_not_allowed.sql';
  assert.equal(isMarketplaceCapabilityExperienceScope(replaced), false);
});

test('Marketplace Capability Experience runs only fixed contract and repository build gates', () => {
  assert.deepEqual(marketplaceCapabilityExperienceCommands.map((item) => item.label), [
    'install',
    'contract-syntax',
    'focused-node-contracts',
    'declaration-typecheck',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(
    marketplaceCapabilityExperienceCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'tests/training-marketplace-capability-experience-v1.test.mjs'],
  );
});

test('Marketplace Capability Experience locks exact counts and compatibility input', () => {
  const source = readFileSync(new URL('../scripts/run-marketplace-capability-experience-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 10;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 378;',
    "selectedSuite: 'marketplace-capability-experience'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes Marketplace Capability Experience before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunMarketplaceCapabilityExperienceProfile } from './run-marketplace-capability-experience-profile.mjs';"), true);
  const learning = router.indexOf('maybeRunCapabilityLearningProfileCoreProfile(input)');
  const marketplace = router.indexOf('maybeRunMarketplaceCapabilityExperienceProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(learning >= 0 && marketplace > learning && fallback > marketplace);
});

test('public Marketplace Capability Experience profile contains no network deploy database or arbitrary shell primitive', () => {
  const text = JSON.stringify(marketplaceCapabilityExperienceCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'payment', 'settlement', 'wallet', 'token movement', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
