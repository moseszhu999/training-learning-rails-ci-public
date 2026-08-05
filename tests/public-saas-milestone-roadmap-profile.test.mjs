import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateInputs } from '../scripts/exact-head-inputs.mjs';
import {
  SAAS_MILESTONE_ROADMAP_EXACT_FILES,
  isSaasMilestoneRoadmapScope,
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

const profile = readFileSync(new URL('../scripts/run-saas-milestone-roadmap-profile.mjs', import.meta.url), 'utf8');
const router = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');

test('roadmap profile owns exactly eight docs prototype and test files', () => {
  assert.deepEqual([...SAAS_MILESTONE_ROADMAP_EXACT_FILES].sort(), [...exactFiles].sort());
  assert.equal(isSaasMilestoneRoadmapScope(exactFiles), true);
  assert.equal(isSaasMilestoneRoadmapScope(exactFiles.slice(1)), false);
  assert.equal(isSaasMilestoneRoadmapScope([...exactFiles, 'package.json']), false);
});

test('roadmap profile runs six fixed non-production gates', () => {
  assert.deepEqual(
    saasMilestoneRoadmapCommands.map((item) => item.label),
    [
      'install',
      'python-contracts',
      'svg-well-formed',
      'typecheck',
      'production-build',
      'bundle-verification',
    ],
  );
  for (const marker of [
    'EXPECTED_PYTHON_COUNT = 16',
    'EXPECTED_MIGRATION_COUNT = 368',
    'test_trainingos_marketplace_onboarding_acceptance_v1',
    'test_trainingos_viral_growth_loop_v1',
    'test_trainingos_viral_marketplace_entry_v1',
    "selectedSuite: 'saas-milestone-roadmap'",
  ]) assert.ok(profile.includes(marker), marker);
  assert.doesNotMatch(profile, /database-replay/);
  assert.doesNotMatch(profile, /deploy-site|--prod/);
  assert.doesNotMatch(profile, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
});

test('roadmap profile is routed before generic fallback', () => {
  const roadmapIndex = router.indexOf('const saasMilestoneRoadmap');
  const baseIndex = router.indexOf('const result = await runBaseProfile');
  assert.ok(roadmapIndex >= 0);
  assert.ok(baseIndex > roadmapIndex);
});

test('generic-owned request accepts current roadmap contract', () => {
  const result = validateInputs({
    privateExactSha: 'a'.repeat(40),
    expectedBaseSha: 'b'.repeat(40),
    expectedMainSha: '',
    validationProfile: 'generic-owned',
    expectedChangedFileCount: '8',
    expectedMigrationRange: 'none',
    expectedFocusedTestCounts: 'node=0;python=16',
    expectedMigrationCount: '368',
    runFreshReplay: 'false',
    runUpgradeReplay: 'false',
    runApplicationContracts: 'true',
    runTypecheck: 'true',
    runProductionBuild: 'true',
    runCriticalE2E: 'false',
  });
  assert.equal(result.ok, true);
});
