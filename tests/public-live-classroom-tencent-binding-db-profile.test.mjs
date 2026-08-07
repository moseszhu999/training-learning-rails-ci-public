import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE_CLASSROOM_TENCENT_BINDING_DB_EXACT_FILES,
  isLiveClassroomTencentBindingDbScope,
  liveClassroomTencentBindingDbCommands,
} from '../scripts/run-live-classroom-tencent-binding-db-profile.mjs';

test('F3 database selector accepts exactly seven owned files', () => {
  assert.equal(LIVE_CLASSROOM_TENCENT_BINDING_DB_EXACT_FILES.size, 7);
  assert.equal(isLiveClassroomTencentBindingDbScope(LIVE_CLASSROOM_TENCENT_BINDING_DB_EXACT_FILES), true);
  assert.equal(
    isLiveClassroomTencentBindingDbScope([...LIVE_CLASSROOM_TENCENT_BINDING_DB_EXACT_FILES, 'netlify.toml']),
    false,
  );
});

test('F3 database profile hard-requires runtime contracts and database replay', () => {
  assert.deepEqual(liveClassroomTencentBindingDbCommands.map((item) => item.label), [
    'install',
    'binding-syntax',
    'endpoint-syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'database-replay',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const node = liveClassroomTencentBindingDbCommands.find((item) => item.label === 'focused-node-contracts');
  assert.equal(node?.kind, 'node');
  assert.deepEqual(node?.args, [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-binding.test.mjs',
  ]);
  const python = liveClassroomTencentBindingDbCommands.find((item) => item.label === 'focused-python-contracts');
  assert.equal(python?.kind, 'python');
  assert.deepEqual(python?.args, [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_live_classroom_tencent_binding_v1',
  ]);
  const database = liveClassroomTencentBindingDbCommands.find((item) => item.label === 'database-replay');
  assert.deepEqual(database?.args, ['scripts/run-live-classroom-tencent-binding-db-profile.sh']);
});

test('F3 runner fixes migration count/range and runs fresh plus upgrade replay', () => {
  const runner = readFileSync(new URL('../scripts/run-live-classroom-tencent-binding-db-profile.sh', import.meta.url), 'utf8');
  for (const token of [
    'canonical_migration_count=369',
    'base_migration_count=368',
    'migration_file=20260807220000_trainingos_live_classroom_tencent_binding_v1.sql',
    'fresh-reset-one',
    'fresh-reset-two',
    'upgrade-base-reset',
    'upgrade-copy-migration',
    'upgrade-apply',
    'trainingos_live_classroom_tencent_binding_v1_e2e.sql',
    'zero-residue',
    'cleanup=PASS',
  ]) {
    assert.equal(runner.includes(token), true, token);
  }
});

test('F3 runner never targets hosted or production Supabase', () => {
  const runner = readFileSync(new URL('../scripts/run-live-classroom-tencent-binding-db-profile.sh', import.meta.url), 'utf8').toLowerCase();
  const hostedEndpointMarker = ['supabase', 'com/rest'].join('.');
  for (const forbidden of [
    '--linked', '--db-url', 'supabase db push', 'supabase link',
    hostedEndpointMarker, 'curl ', 'wget ', 'ssh ', 'netlify deploy', 'vercel deploy',
  ]) {
    assert.equal(runner.includes(forbidden), false, forbidden);
  }
  assert.equal(runner.includes('db reset --local --no-seed'), true);
  assert.equal(runner.includes('migration up --local'), true);
});

test('F3 profile is routed before the generic Live Classroom selectors', () => {
  const controller = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');
  const binding = controller.indexOf('maybeRunLiveClassroomTencentBindingDbProfile(input)');
  const server = controller.indexOf('maybeRunLiveClassroomTencentServerAuthorizationProfile(input)');
  const saas = controller.indexOf('maybeRunSaasMilestoneRoadmapProfile(input)');
  assert.ok(binding >= 0 && server > binding && saas > server);
});
