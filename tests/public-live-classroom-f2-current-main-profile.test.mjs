import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE_CLASSROOM_F2_CURRENT_MAIN_EXACT_FILES,
  liveClassroomF2CurrentMainCommands,
  isLiveClassroomF2CurrentMainScope,
} from '../scripts/run-live-classroom-tencent-server-authorization-current-main-profile.mjs';

test('selector accepts only the exact six F2 files', () => {
  assert.equal(LIVE_CLASSROOM_F2_CURRENT_MAIN_EXACT_FILES.size, 6);
  assert.equal(isLiveClassroomF2CurrentMainScope(LIVE_CLASSROOM_F2_CURRENT_MAIN_EXACT_FILES), true);
  assert.equal(isLiveClassroomF2CurrentMainScope([...LIVE_CLASSROOM_F2_CURRENT_MAIN_EXACT_FILES, 'netlify.toml']), false);
});

test('profile runs signing and authorization syntax, exact contracts, and build gates', () => {
  assert.deepEqual(liveClassroomF2CurrentMainCommands.map((item) => item.label), [
    'install', 'api-syntax', 'authorization-syntax', 'endpoint-syntax',
    'focused-node-contracts', 'focused-python-contracts', 'typecheck',
    'direct-vite-production-build', 'postbuild-copy', 'bundle-verification',
  ]);
});

test('current-main F2 locks six files, node14, python11, zero migration, canonical369', () => {
  const source = readFileSync(new URL('../scripts/run-live-classroom-tencent-server-authorization-current-main-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 6;',
    'const EXPECTED_NODE_COUNT = 14;',
    'const EXPECTED_PYTHON_COUNT = 11;',
    'const EXPECTED_MIGRATION_COUNT = 369;',
    "selectedSuite: 'live-classroom-tencent-server-authorization-current-main'",
  ]) assert.equal(source.includes(token), true, token);
});

test('current-main F2 profile contains no provider/network/database/deployment execution primitive', () => {
  const text = JSON.stringify(liveClassroomF2CurrentMainCommands).toLowerCase();
  for (const forbidden of ['curl', 'wget', 'ssh', 'createroom', 'loginoriginidwithroom', 'registeruser', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql', 'playwright']) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});

test('high-level F2 router checks current-main wrapper before historical F2 input contract', () => {
  const router = readFileSync(new URL('../scripts/run-live-classroom-tencent-server-authorization-profile.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunLiveClassroomF2CurrentMainProfile } from './run-live-classroom-tencent-server-authorization-current-main-profile.mjs';"), true);
  const currentF2 = router.indexOf('maybeRunLiveClassroomF2CurrentMainProfile(input)');
  const historicalInput = router.indexOf("if (input.profile !== 'generic-owned') return null;");
  assert.ok(currentF2 >= 0 && historicalInput > currentF2);
});
