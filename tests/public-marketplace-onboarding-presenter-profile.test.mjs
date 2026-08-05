import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MARKETPLACE_ONBOARDING_PRESENTER_EXACT_FILES,
  isMarketplaceOnboardingPresenterScope,
  marketplaceOnboardingPresenterCommands,
} from '../scripts/run-marketplace-onboarding-presenter-profile.mjs';

const exactFiles = [
  'docs/architecture/trainingos-marketplace-onboarding-presenter-v1.md',
  'packages/training-marketplace-onboarding-presenter/package.json',
  'packages/training-marketplace-onboarding-presenter/src/index.d.ts',
  'packages/training-marketplace-onboarding-presenter/src/index.mjs',
  'packages/training-marketplace-onboarding-presenter/test/onboarding-presenter.test.mjs',
  'tests/test_trainingos_marketplace_onboarding_presenter_v1.py',
];

const profile = readFileSync(
  new URL('../scripts/run-marketplace-onboarding-presenter-profile.mjs', import.meta.url),
  'utf8',
);
const router = readFileSync(
  new URL('../scripts/run-marketplace-onboarding-intake-profile.mjs', import.meta.url),
  'utf8',
);

test('onboarding presenter profile owns exactly six non-migration files', () => {
  assert.deepEqual([...MARKETPLACE_ONBOARDING_PRESENTER_EXACT_FILES].sort(), [...exactFiles].sort());
  assert.equal(isMarketplaceOnboardingPresenterScope(exactFiles), true);
  assert.equal(isMarketplaceOnboardingPresenterScope(exactFiles.slice(1)), false);
  assert.equal(isMarketplaceOnboardingPresenterScope([...exactFiles, 'package.json']), false);
  assert.equal(isMarketplaceOnboardingPresenterScope([...exactFiles.slice(0, 5), 'supabase/migrations/forbidden.sql']), false);
});

test('profile runs focused presenter, declaration, typecheck and build gates', () => {
  assert.deepEqual(
    marketplaceOnboardingPresenterCommands.map((item) => item.label),
    [
      'install',
      'package-syntax',
      'node-presenter',
      'python-static',
      'declaration-typecheck',
      'typecheck',
      'production-build',
      'bundle-verification',
    ],
  );
  for (const marker of [
    'CANONICAL_MIGRATION_COUNT = 366',
    'EXPECTED_NODE_COUNT = 6',
    'EXPECTED_PYTHON_COUNT = 5',
    'onboarding-presenter.test.mjs',
    'test_trainingos_marketplace_onboarding_presenter_v1',
    "selectedSuite: 'marketplace-onboarding-presenter'",
  ]) assert.ok(profile.includes(marker), marker);
  assert.doesNotMatch(profile, /database-replay/);
  assert.doesNotMatch(profile, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
  assert.doesNotMatch(profile, /deploy/i);
});

test('onboarding intake router invokes presenter before intake adapter profile', () => {
  assert.match(router, /maybeRunMarketplaceOnboardingPresenterProfile/);
  const presenterIndex = router.indexOf('maybeRunMarketplaceOnboardingPresenterProfile(input)');
  const intakeIndex = router.indexOf("if (input.profile !== 'generic-owned') return null;");
  assert.ok(presenterIndex >= 0 && intakeIndex > presenterIndex);
});

test('presenter profile preserves navigation-only and no-write verification scope', () => {
  for (const marker of [
    "'packages/training-marketplace-onboarding-presenter/src/index.mjs'",
    "'packages/training-marketplace-onboarding-presenter/src/index.d.ts'",
    "'tests.test_trainingos_marketplace_onboarding_presenter_v1'",
  ]) assert.ok(profile.includes(marker), marker);
  assert.doesNotMatch(profile, /supabase\/migrations/);
  assert.doesNotMatch(profile, /formalOnboardingWriteAllowed\s*=\s*true/);
  assert.doesNotMatch(profile, /workspaceCreated\s*=\s*true/);
  assert.doesNotMatch(profile, /projectCreated\s*=\s*true/);
});
