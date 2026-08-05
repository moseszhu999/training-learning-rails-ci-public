import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MARKETPLACE_ONBOARDING_INTAKE_CANONICAL_ID_PRIVACY_FILES,
  classifyMarketplaceOnboardingIntakeScope,
  marketplaceOnboardingIntakeCommands,
  marketplaceOnboardingIntakeFixedInputContract,
} from '../scripts/run-marketplace-onboarding-intake-profile.mjs';

const exactRepairFiles = [...MARKETPLACE_ONBOARDING_INTAKE_CANONICAL_ID_PRIVACY_FILES];

function input(overrides = {}) {
  return {
    expectedNodeCount: '10',
    expectedPythonCount: '8',
    ...overrides,
  };
}

function scope(overrides = {}) {
  return {
    expected_changed_file_count: '2',
    migration_start: 'none',
    migration_end: 'none',
    ...overrides,
  };
}

test('recognizes only the exact two-file intake privacy repair scope', () => {
  assert.equal(classifyMarketplaceOnboardingIntakeScope(exactRepairFiles), 'canonicalIdPrivacy');
  assert.equal(classifyMarketplaceOnboardingIntakeScope(exactRepairFiles.slice(1)), null);
  assert.equal(classifyMarketplaceOnboardingIntakeScope([
    ...exactRepairFiles,
    'packages/training-marketplace-onboarding-intake/src/index.d.ts',
  ]), null);
  assert.equal(classifyMarketplaceOnboardingIntakeScope([
    ...exactRepairFiles,
    'supabase/migrations/20260805162000_unowned.sql',
  ]), null);
});

test('locks node 10, python 8, zero migration and canonical count 367', () => {
  const previous = process.env.EXPECTED_MIGRATION_COUNT;
  process.env.EXPECTED_MIGRATION_COUNT = '367';
  try {
    assert.equal(
      marketplaceOnboardingIntakeFixedInputContract(
        input(), scope(), 'canonicalIdPrivacy',
      ),
      true,
    );
    assert.equal(
      marketplaceOnboardingIntakeFixedInputContract(
        input({ expectedNodeCount: '9' }), scope(), 'canonicalIdPrivacy',
      ),
      false,
    );
    assert.equal(
      marketplaceOnboardingIntakeFixedInputContract(
        input({ expectedPythonCount: '7' }), scope(), 'canonicalIdPrivacy',
      ),
      false,
    );
    assert.equal(
      marketplaceOnboardingIntakeFixedInputContract(
        input(), scope({ expected_changed_file_count: '3' }), 'canonicalIdPrivacy',
      ),
      false,
    );
    assert.equal(
      marketplaceOnboardingIntakeFixedInputContract(
        input(), scope({ migration_start: '20260805162000' }), 'canonicalIdPrivacy',
      ),
      false,
    );
    process.env.EXPECTED_MIGRATION_COUNT = '368';
    assert.equal(
      marketplaceOnboardingIntakeFixedInputContract(
        input(), scope(), 'canonicalIdPrivacy',
      ),
      false,
    );
  } finally {
    if (previous === undefined) delete process.env.EXPECTED_MIGRATION_COUNT;
    else process.env.EXPECTED_MIGRATION_COUNT = previous;
  }
});

test('reuses the existing intake syntax, tests, typecheck, build and bundle gates', () => {
  const labels = marketplaceOnboardingIntakeCommands.map((item) => item.label);
  assert.deepEqual(labels, [
    'install',
    'package-syntax',
    'node-adapter',
    'python-static',
    'declaration-typecheck',
    'typecheck',
    'production-build',
    'bundle-verification',
  ]);
});
