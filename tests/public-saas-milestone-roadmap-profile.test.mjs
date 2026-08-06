import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateInputs } from '../scripts/exact-head-inputs.mjs';
import {
  MARKETPLACE_REAL_PILOT_EXACT_FILES,
  SAAS_MILESTONE_ROADMAP_EXACT_FILES,
  isMarketplaceRealPilotScope,
  isSaasMilestoneRoadmapScope,
  marketplaceRealPilotCommands,
  saasMilestoneRoadmapCommands,
} from '../scripts/run-saas-milestone-roadmap-profile.mjs';

const exactFiles = [
  'docs/product/assets/trainingos-saas-milestone-roadmap-v1.svg',
  'docs/product/trainingos-saas-milestone-roadmap-v1.md',
  'public/trainingos-marketplace-onboarding-acceptance-v1.html',
  'public/trainingos-viral-growth-loop-v1.html',
  'public/trainingos-viral-marketplace-entry-v1.html',
  'tests/test_trainingos_marketplace_onboarding_acceptance_v1.py',
  'tests/test_trainingos_viral_growth_loop_v1.py',
  'tests/test_trainingos_viral_marketplace_entry_v1.py',
];

const pilotFiles = [
  'docs/operations/trainingos-marketplace-real-pilot-operations-pack-v1.md',
  'docs/operations/trainingos-marketplace-pilot-operator-checklist-v1.md',
  'tests/fixtures/trainingos_marketplace_real_pilot_evidence_v1.json',
  'tests/test_trainingos_marketplace_real_pilot_operations_pack_v1.py',
  'public/trainingos-marketplace-real-pilot-operator-console-v1.html',
];

const profile = readFileSync(new URL('../scripts/run-saas-milestone-roadmap-profile.mjs', import.meta.url), 'utf8');
const router = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');

test('roadmap profile owns exactly eight docs prototype and test files', () => {
  assert.deepEqual([...SAAS_MILESTONE_ROADMAP_EXACT_FILES].sort(), [...exactFiles].sort());
  assert.equal(isSaasMilestoneRoadmapScope(exactFiles), true);
  assert.equal(isSaasMilestoneRoadmapScope(exactFiles.slice(1)), false);
  assert.equal(isSaasMilestoneRoadmapScope([...exactFiles, 'package.json']), false);
});

test('real pilot profile owns exactly five docs fixture test and standalone HTML files', () => {
  assert.deepEqual([...MARKETPLACE_REAL_PILOT_EXACT_FILES].sort(), [...pilotFiles].sort());
  assert.equal(isMarketplaceRealPilotScope(pilotFiles), true);
  assert.equal(isMarketplaceRealPilotScope(pilotFiles.slice(1)), false);
  assert.equal(isMarketplaceRealPilotScope([...pilotFiles, 'package.json']), false);
  assert.equal(isMarketplaceRealPilotScope([...pilotFiles, 'apps/training-web/x.ts']), false);
});

test('roadmap profile retains six fixed non-production gates', () => {
  assert.deepEqual(
    saasMilestoneRoadmapCommands.map((item) => item.label),
    ['install', 'python-contracts', 'svg-well-formed', 'typecheck', 'production-build', 'bundle-verification'],
  );
  for (const marker of [
    'expectedPythonCount: 16',
    'EXPECTED_MIGRATION_COUNT = 368',
    'import importlib.util',
    "name.startswith('test_')",
    "print(f'Ran {count} tests')",
    'test_trainingos_marketplace_onboarding_acceptance_v1.py',
    'test_trainingos_viral_growth_loop_v1.py',
    'test_trainingos_viral_marketplace_entry_v1.py',
    "suite: 'saas-milestone-roadmap'",
  ]) assert.ok(profile.includes(marker), marker);
});

test('real pilot profile runs fixed Python typecheck build and bundle gates', () => {
  assert.deepEqual(
    marketplaceRealPilotCommands.map((item) => item.label),
    ['install', 'python-contracts', 'typecheck', 'production-build', 'bundle-verification'],
  );
  for (const marker of [
    "suite: 'marketplace-real-pilot-operations-pack'",
    'expectedChangedFileCount: 5',
    'expectedPythonCount: 14',
    'test_trainingos_marketplace_real_pilot_operations_pack_v1',
    'MARKETPLACE_REAL_PILOT_EXACT_FILES',
  ]) assert.ok(profile.includes(marker), marker);
});

test('both profiles exclude deployment database and production credentials', () => {
  assert.doesNotMatch(profile, /database-replay/);
  assert.doesNotMatch(profile, /deploy-site|netlify deploy|vercel deploy|--prod/i);
  assert.doesNotMatch(profile, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
});

test('roadmap and pilot profiles are routed before generic fallback', () => {
  const roadmapIndex = router.indexOf('const saasMilestoneRoadmap');
  const baseIndex = router.indexOf('const result = await runBaseProfile');
  assert.ok(roadmapIndex >= 0);
  assert.ok(baseIndex > roadmapIndex);
});

test('generic-owned request accepts current roadmap contract', () => {
  const result = validateInputs({
    privateExactSha: 'a'.repeat(40), expectedBaseSha: 'b'.repeat(40), expectedMainSha: '',
    validationProfile: 'generic-owned', expectedChangedFileCount: '8', expectedMigrationRange: 'none',
    expectedFocusedTestCounts: 'node=0;python=16', expectedMigrationCount: '368',
    runFreshReplay: 'false', runUpgradeReplay: 'false', runApplicationContracts: 'true',
    runTypecheck: 'true', runProductionBuild: 'true', runCriticalE2E: 'false',
  });
  assert.equal(result.ok, true);
});

test('generic-owned request accepts real pilot contract', () => {
  const result = validateInputs({
    privateExactSha: 'a'.repeat(40), expectedBaseSha: 'b'.repeat(40), expectedMainSha: '',
    validationProfile: 'generic-owned', expectedChangedFileCount: '5', expectedMigrationRange: 'none',
    expectedFocusedTestCounts: 'node=0;python=14', expectedMigrationCount: '368',
    runFreshReplay: 'false', runUpgradeReplay: 'false', runApplicationContracts: 'true',
    runTypecheck: 'true', runProductionBuild: 'true', runCriticalE2E: 'false',
  });
  assert.equal(result.ok, true);
});
