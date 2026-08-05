import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  MARKETPLACE_ONBOARDING_HANDOFF_PROJECTION_EXACT_FILES,
  MARKETPLACE_ONBOARDING_HANDOFF_CANONICAL_MIGRATION_COUNT,
  MARKETPLACE_ONBOARDING_HANDOFF_EXPECTED_NODE_COUNT,
  MARKETPLACE_ONBOARDING_HANDOFF_EXPECTED_PYTHON_COUNT,
  isMarketplaceOnboardingHandoffProjectionScope,
  marketplaceOnboardingHandoffFixedInputContract,
  marketplaceOnboardingHandoffProjectionCommands,
  parseMarketplaceOnboardingHandoffDatabaseStage,
} from '../scripts/run-marketplace-onboarding-handoff-projection-profile.mjs';

const exactFiles = [...MARKETPLACE_ONBOARDING_HANDOFF_PROJECTION_EXACT_FILES];

function scope(overrides = {}) {
  return {
    expected_changed_file_count: '7',
    migration_start: '20260805161000',
    migration_end: '20260805161000',
    ...overrides,
  };
}

function input(overrides = {}) {
  return {
    expectedNodeCount: '7',
    expectedPythonCount: '5',
    ...overrides,
  };
}

test('accepts only the exact seven-file onboarding handoff projection scope', () => {
  assert.equal(isMarketplaceOnboardingHandoffProjectionScope(exactFiles), true);
  assert.equal(isMarketplaceOnboardingHandoffProjectionScope(exactFiles.slice(1)), false);
  assert.equal(isMarketplaceOnboardingHandoffProjectionScope([
    ...exactFiles,
    'apps/training-marketplace-web/object/index.html',
  ]), false);
  assert.equal(isMarketplaceOnboardingHandoffProjectionScope([
    ...exactFiles.filter((name) => !name.startsWith('supabase/migrations/')),
    'supabase/migrations/20260805161001_unowned.sql',
  ]), false);
});

test('locks migration and focused-test counts', () => {
  assert.equal(MARKETPLACE_ONBOARDING_HANDOFF_CANONICAL_MIGRATION_COUNT, 368);
  assert.equal(MARKETPLACE_ONBOARDING_HANDOFF_EXPECTED_NODE_COUNT, 7);
  assert.equal(MARKETPLACE_ONBOARDING_HANDOFF_EXPECTED_PYTHON_COUNT, 5);

  const previous = process.env.EXPECTED_MIGRATION_COUNT;
  process.env.EXPECTED_MIGRATION_COUNT = '368';
  try {
    assert.equal(marketplaceOnboardingHandoffFixedInputContract(input(), scope()), true);
    assert.equal(marketplaceOnboardingHandoffFixedInputContract(
      input({ expectedNodeCount: '6' }), scope(),
    ), false);
    assert.equal(marketplaceOnboardingHandoffFixedInputContract(
      input({ expectedPythonCount: '4' }), scope(),
    ), false);
    assert.equal(marketplaceOnboardingHandoffFixedInputContract(
      input(), scope({ expected_changed_file_count: '8' }),
    ), false);
    assert.equal(marketplaceOnboardingHandoffFixedInputContract(
      input(), scope({ migration_end: '20260805161001' }),
    ), false);
    process.env.EXPECTED_MIGRATION_COUNT = '367';
    assert.equal(marketplaceOnboardingHandoffFixedInputContract(input(), scope()), false);
  } finally {
    if (previous === undefined) delete process.env.EXPECTED_MIGRATION_COUNT;
    else process.env.EXPECTED_MIGRATION_COUNT = previous;
  }
});

test('runs the bounded database, typecheck, build and bundle gates', () => {
  const byLabel = Object.fromEntries(
    marketplaceOnboardingHandoffProjectionCommands.map((item) => [item.label, item]),
  );
  assert.equal(byLabel['database-replay'].executable, 'bash');
  assert.match(byLabel['database-replay'].args[0], /onboarding-handoff-projection-database\.sh$/);
  assert.deepEqual(byLabel.typecheck.args, ['run', 'typecheck']);
  assert.deepEqual(byLabel['production-build'].args, [
    'vite', 'build', '--config', 'vite.config.ts',
  ]);
  assert.deepEqual(byLabel['bundle-verification'].args, ['run', 'verify:build']);
});

test('sanitizes only the fixed database failure stage marker', () => {
  assert.equal(
    parseMarketplaceOnboardingHandoffDatabaseStage(
      'MARKETPLACE_ONBOARDING_HANDOFF_DB status=FAIL stage=upgrade-apply',
    ),
    'upgrade-apply',
  );
  assert.equal(parseMarketplaceOnboardingHandoffDatabaseStage('private SQL text'), 'unknown');
});

test('uses an isolated pinned CLI wrapper and complete replay boundaries', async () => {
  const wrapper = await readFile(
    new URL('../scripts/run-marketplace-onboarding-handoff-projection-database.sh', import.meta.url),
    'utf8',
  );
  const core = await readFile(
    new URL('../scripts/run-marketplace-onboarding-handoff-projection-database-core.sh', import.meta.url),
    'utf8',
  );
  const router = await readFile(
    new URL('../scripts/run-marketplace-participation-profile.mjs', import.meta.url),
    'utf8',
  );

  assert.match(wrapper, /supabase@2\.109\.1/);
  assert.match(wrapper, /trainingos-marketplace-onboarding-handoff-bin/);
  assert.match(wrapper, /database-core\.sh/);

  for (const token of [
    'canonical_migration_count=368',
    'base_migration_count=367',
    '20260805161000_trainingos_marketplace_onboarding_handoff_projection_v1.sql',
    'fresh-reset-one',
    'fresh-reset-two',
    'upgrade-apply',
    'sql-e2e',
    'acl-catalog',
    'rollback-residue',
    'anon_execute=false',
    'elevated_execute=false',
    'cleanup=PASS',
  ]) {
    assert.ok(core.includes(token), `missing core contract: ${token}`);
  }

  assert.match(router, /maybeRunMarketplaceOnboardingHandoffProjectionProfile/);
  assert.match(router, /const onboardingHandoffProjection = await/);
});
