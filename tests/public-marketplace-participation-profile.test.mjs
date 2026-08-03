import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  MARKETPLACE_PARTICIPATION_EXACT_FILES,
  isMarketplaceParticipationScope,
  marketplaceParticipationCommands,
} from '../scripts/run-marketplace-participation-profile.mjs';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Marketplace Participation locks the exact four-file private database scope', () => {
  assert.equal(MARKETPLACE_PARTICIPATION_EXACT_FILES.size, 4);
  assert.equal(isMarketplaceParticipationScope([...MARKETPLACE_PARTICIPATION_EXACT_FILES]), true);
  assert.equal(isMarketplaceParticipationScope([
    ...MARKETPLACE_PARTICIPATION_EXACT_FILES,
    'apps/training-marketplace-web/src/app.mjs',
  ]), false);
  assert.equal(isMarketplaceParticipationScope(
    [...MARKETPLACE_PARTICIPATION_EXACT_FILES].filter((name) => !name.startsWith('supabase/migrations/')),
  ), false);
});

test('profile runs fixed Python, database, typecheck and build stages', () => {
  assert.deepEqual(marketplaceParticipationCommands.map((item) => item.label), [
    'install',
    'python-static',
    'database-replay',
    'typecheck',
    'production-build',
  ]);
  const serialized = JSON.stringify(marketplaceParticipationCommands);
  assert.match(serialized, /test_trainingos_marketplace_participation_v1/);
  assert.match(serialized, /run-marketplace-participation-database\.sh/);
});

test('database runner fixes migration counts, fresh replays, upgrade, rollback and zero residue', async () => {
  const source = await read('../scripts/run-marketplace-participation-database.sh');
  for (const token of [
    'canonical_migration_count=364',
    'base_migration_count=363',
    '20260803072000_trainingos_marketplace_participation_v1.sql',
    'fresh-one',
    'fresh-two',
    'worktree add --detach',
    'migration up --local --include-all',
    'trainingos_marketplace_participation_v1_e2e.sql',
    "-c 'begin;'",
    "-c 'rollback;'",
    'fixtures=0',
    'supply=0',
    'demand=0',
    'claim=0',
    'contact=0',
    'handoff=0',
    'events=0',
    'tables=6',
    'public_rpcs=7',
    'authenticated_table_privileges=0',
    'elevated_table_privileges=0',
    'rollback=PASS',
    'zero_residue=PASS',
  ]) assert.ok(source.includes(token), token);
  assert.doesNotMatch(source, /upload-artifact|production deploy/i);
  assert.doesNotMatch(source, /supabase\.co|postgres(?:ql)?:\/\//i);
  assert.doesNotMatch(source, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
});

test('database failure exposes only a bounded category, SQLSTATE, line and exit marker', async () => {
  const source = await read('../scripts/run-marketplace-participation-database.sh');
  for (const token of [
    'sanitized_failure_marker',
    'VERBOSITY=verbose',
    "trainingos_marketplace_participation_v1_e2e\\.sql:[0-9]+",
    "category=\"fatal\"",
    "category=\"error\"",
    "category=\"client\"",
    "printf '%s-%s-line%s-exit%s'",
    "CURRENT_STAGE=\"${label}-sql-e2e-${marker}\"",
  ]) assert.ok(source.includes(token), token);
  assert.doesNotMatch(source, /cat\s+.*sql-e2e|tail\s+.*sql-e2e|echo\s+.*e2e_log/);
});

test('start diagnosis compares base and exact migrations without exposing private output', async () => {
  const source = await read('../scripts/run-marketplace-participation-database.sh');
  for (const token of [
    'sanitized_start_failure_marker',
    'start_with_marker',
    'baseline-migration-count',
    'start_with_marker "$upgrade" baseline-start',
    'start_with_marker "$fresh" fresh-start',
    "migration_scope=\"marketplace\"",
    "migration_scope=\"base_history\"",
    "migration_scope=\"none\"",
    "printf '%s-%s-migration%s-exit%s'",
  ]) assert.ok(source.includes(token), token);
  assert.doesNotMatch(source, /cat\s+.*baseline-start|cat\s+.*fresh-start|echo\s+.*start_log/);
  assert.doesNotMatch(source, /migration_scope=.*[0-9]{14}_/);
});

test('private profile controller routes Marketplace Participation before generic fallback', async () => {
  const source = await read('../scripts/run-private-profile.mjs');
  assert.match(source, /maybeRunMarketplaceParticipationProfile/);
  assert.match(source, /run-marketplace-participation-profile/);
  assert.ok(source.indexOf('maybeRunMarketplaceParticipationProfile') < source.indexOf('runBaseProfile(input)'));
});
