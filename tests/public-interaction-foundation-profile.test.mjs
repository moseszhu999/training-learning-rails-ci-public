import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  INTERACTION_FOUNDATION_EXACT_FILES,
  interactionFoundationCommands,
  isInteractionFoundationScope,
} from '../scripts/run-interaction-foundation-profile.mjs';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Interaction Foundation locks the exact private thirteen-file scope', () => {
  assert.equal(INTERACTION_FOUNDATION_EXACT_FILES.size, 13);
  assert.equal(isInteractionFoundationScope([...INTERACTION_FOUNDATION_EXACT_FILES]), true);
  assert.equal(isInteractionFoundationScope([
    ...INTERACTION_FOUNDATION_EXACT_FILES,
    'apps/training-web/src/components/UnexpectedInteraction.tsx',
  ]), false);
  assert.equal(isInteractionFoundationScope(
    [...INTERACTION_FOUNDATION_EXACT_FILES].filter((name) => !name.includes('direct_revocation_hardening')),
  ), false);
  assert.equal(isInteractionFoundationScope(
    [...INTERACTION_FOUNDATION_EXACT_FILES].filter((name) => !name.includes('direct_revocation_v1_e2e')),
  ), false);
});

test('profile runs fixed syntax, Node, Python, database, typecheck and build stages', () => {
  assert.deepEqual(interactionFoundationCommands.map((item) => item.label), [
    'install',
    'package-syntax',
    'package-tests',
    'gateway-syntax',
    'gateway-tests',
    'python-static',
    'database-replay',
    'typecheck',
    'production-build',
  ]);
  const serialized = JSON.stringify(interactionFoundationCommands);
  assert.match(serialized, /training-interaction\/test\/interaction\.test\.mjs/);
  assert.match(serialized, /interaction-foundation-v1\.test\.mjs/);
  assert.match(serialized, /test_trainingos_interaction_foundation_v1/);
  assert.match(serialized, /run-interaction-foundation-database\.sh/);
});

test('database runner performs two fresh replays, exact-base upgrade, and bounded revocation diagnostics', async () => {
  const source = await read('../scripts/run-interaction-foundation-database.sh');
  for (const token of [
    'canonical_migration_count=360',
    'base_migration_count=357',
    'fresh-reset-one',
    'fresh-reset-two',
    'worktree add --detach',
    'migration up --local --include-all',
    '20260802100200_trainingos_interaction_direct_revocation_hardening_v1.sql',
    'trainingos_interaction_foundation_v1_e2e.sql',
    'trainingos_interaction_direct_revocation_v1_e2e.sql',
    'agent_post_rejected',
    'outsider_read_rejected',
    'studentReadDenied',
    'studentPostDenied',
    'teacherReadDenied',
    'directRemovedFromProjection',
    'immutableHistoryRetained',
    'direct-revocation-sql',
    'direct-revocation-status',
    'direct-revocation-student-read',
    'direct-revocation-student-post',
    'direct-revocation-teacher-read',
    'direct-revocation-projection',
    'direct-revocation-history',
    'direct-revocation-cleanup',
    'formalBusinessWriteClaims',
    'fixtureCleanup',
    'tables=8',
    'public_rpcs=8',
    'direct_revocation_e2e=PASS',
    'zero_residue=PASS',
  ]) assert.ok(source.includes(token), token);
  assert.doesNotMatch(source, /upload-artifact|production deploy/i);
  assert.doesNotMatch(source, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
});

test('private profile controller routes Interaction before generic fallback', async () => {
  const source = await read('../scripts/run-private-profile.mjs');
  assert.match(source, /maybeRunInteractionFoundationProfile/);
  assert.match(source, /run-interaction-foundation-profile/);
});
