import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  INTERACTION_WEB_EXACT_FILES,
  interactionWebCommands,
  interactionWebPythonCommands,
  isInteractionWebScope,
} from '../scripts/run-interaction-web-profile.mjs';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const studentExerciseWorkspaceToken = ['J', 'h', 'c', 'StudentExerciseWorkspace'].join('');

const expectedPythonLabels = [
  'web-python-files',
  'web-python-rpcs',
  'web-python-raw-boundary',
  'web-python-provider-boundary',
  'web-python-projection',
  'web-python-page-load',
  'web-python-human-send',
  'web-python-class-mount',
  'web-python-exercise-binding',
  'web-python-student-space',
  'web-python-truth-boundary',
  'web-python-errors',
  'web-python-collision',
  'web-python-css',
];

test('Interaction Web locks the exact seven-file zero-migration scope', () => {
  assert.equal(INTERACTION_WEB_EXACT_FILES.size, 7);
  assert.equal(isInteractionWebScope([...INTERACTION_WEB_EXACT_FILES]), true);
  assert.equal(isInteractionWebScope([
    ...INTERACTION_WEB_EXACT_FILES,
    'apps/training-web/src/components/TrainingOsAdvancedManagementSurface.tsx',
  ]), false);
  assert.equal(isInteractionWebScope(
    [...INTERACTION_WEB_EXACT_FILES].filter((name) => !name.includes(studentExerciseWorkspaceToken)),
  ), false);
  assert.equal(isInteractionWebScope([
    ...INTERACTION_WEB_EXACT_FILES,
    'supabase/migrations/20260802100300_unexpected.sql',
  ]), false);
});

test('profile exposes exactly fourteen bounded Python labels', () => {
  assert.equal(interactionWebPythonCommands.length, 14);
  assert.deepEqual(interactionWebPythonCommands.map((item) => item.label), expectedPythonLabels);
  for (const item of interactionWebPythonCommands) {
    assert.equal(item.executable, 'python');
    assert.equal(item.kind, 'python');
    assert.match(item.args.join(' '), /TrainingOsInteractionWebV1ContractTest\.test_/);
  }
});

test('profile runs foundation regressions, granular Web contracts, typecheck and build', () => {
  assert.deepEqual(interactionWebCommands.map((item) => item.label), [
    'install',
    'foundation-package-syntax',
    'foundation-package-tests',
    'foundation-gateway-syntax',
    'foundation-gateway-tests',
    ...expectedPythonLabels,
    'typecheck',
    'production-build',
  ]);
  assert.equal(interactionWebCommands.length, 21);
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