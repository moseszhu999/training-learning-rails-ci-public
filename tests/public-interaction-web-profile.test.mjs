import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  INTERACTION_WEB_EXACT_FILES,
  interactionWebCommands,
  isInteractionWebScope,
} from '../scripts/run-interaction-web-profile.mjs';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Interaction Web locks the exact seven-file zero-migration scope', () => {
  assert.equal(INTERACTION_WEB_EXACT_FILES.size, 7);
  assert.equal(isInteractionWebScope([...INTERACTION_WEB_EXACT_FILES]), true);
  assert.equal(isInteractionWebScope([
    ...INTERACTION_WEB_EXACT_FILES,
    'apps/training-web/src/components/TrainingOsAdvancedManagementSurface.tsx',
  ]), false);
  assert.equal(isInteractionWebScope(
    [...INTERACTION_WEB_EXACT_FILES].filter((name) => !name.includes('JhcStudentExerciseWorkspace')),
  ), false);
  assert.equal(isInteractionWebScope([
    ...INTERACTION_WEB_EXACT_FILES,
    'supabase/migrations/20260802100300_unexpected.sql',
  ]), false);
});

test('profile runs foundation regressions, Web contract, typecheck and build', () => {
  assert.deepEqual(interactionWebCommands.map((item) => item.label), [
    'install',
    'foundation-package-syntax',
    'foundation-package-tests',
    'foundation-gateway-syntax',
    'foundation-gateway-tests',
    'web-python-contract',
    'typecheck',
    'production-build',
  ]);
  const serialized = JSON.stringify(interactionWebCommands);
  assert.match(serialized, /packages\/training-interaction\/test\/interaction\.test\.mjs/);
  assert.match(serialized, /interaction-foundation-v1\.test\.mjs/);
  assert.match(serialized, /test_trainingos_interaction_web_v1/);
  assert.match(serialized, /vite/);
});

test('profile has no database, deployment or artifact stage', async () => {
  const source = await read('../scripts/run-interaction-web-profile.mjs');
  assert.match(source, /CANONICAL_MIGRATION_COUNT = 360/);
  assert.match(source, /scope\.migration_start === 'none'/);
  assert.match(source, /scope\.migration_end === 'none'/);
  assert.doesNotMatch(source, /db reset|migration up|psql|supabase start/i);
  assert.doesNotMatch(source, /deploy|upload-artifact|artifact/i);
});

test('private profile controller routes Interaction Web before Foundation fallback', async () => {
  const source = await read('../scripts/run-private-profile.mjs');
  assert.match(source, /maybeRunInteractionWebProfile/);
  assert.match(source, /run-interaction-web-profile/);
  assert.ok(source.indexOf('maybeRunInteractionWebProfile(input)') < source.indexOf('maybeRunInteractionFoundationProfile(input)'));
});
